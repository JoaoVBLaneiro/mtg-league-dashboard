import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Save, Plus, Trash2 } from "lucide-react";
import { fetchPaioRatings, PAIO_AUTO_CONCEPTS, PAIO_CONCEPTS } from "./paiometroDeck";
import {
  fetchPaioConfig, invalidatePaioConfig, catalogEntry,
  normalizePaioKey, paioThresholds, BUILTIN_THRESHOLDS, type PaioConfig, type PaioCatalogItem,
} from "./paioConfig";
import "./adminPaiometro.css";
import AdminPaioTags from "./AdminPaioTags";

const BASE = "https://api.corneliomove.com.br/mtg-api";
const defaultConcepts = new Set<string>([...PAIO_AUTO_CONCEPTS, ...PAIO_CONCEPTS, ...BUILTIN_THRESHOLDS.map((rule) => rule.concept)].map(normalizePaioKey));

type Draft = PaioCatalogItem;

async function adminRequest(token: string, url: string, method: string, body: object) {
  const response = await fetch(`${BASE}${url}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json() as { ok?: boolean; error?: string };
  if (!response.ok || data.ok === false) throw new Error(data.error || "Não foi possível salvar.");
}

export default function AdminPaiometroPanel({
  token, disabled = false, onNotice,
}: {
  token: string;
  disabled?: boolean;
  onNotice?: (kind: "success" | "error" | "info", message: string) => void;
}) {
  const [config, setConfig] = useState<PaioConfig>({ items: [], rules: [] });
  const [names, setNames] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [ruleConcept, setRuleConcept] = useState("");
  const [ruleExpression, setRuleExpression] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [ratings, next] = await Promise.all([fetchPaioRatings(), fetchPaioConfig()]);
      setConfig(next);
      setNames(ratings.map((rating) => rating.name));
    } catch (error) {
      onNotice?.("error", error instanceof Error ? error.message : "Não foi possível carregar o catálogo.");
    }
  }

  useEffect(() => { void load(); }, [token]);

  function select(name: string, current: PaioConfig = config) {
    const original = catalogEntry(current, name);
    setSelectedName(name);
    setDraft(original ? { ...original } : {
      name, kind: (defaultConcepts.has(normalizePaioKey(name)) || paioThresholds(current).some((rule) => normalizePaioKey(rule.concept) === normalizePaioKey(name))) ? "concept" : "card",
      artCard: "", linkUrl: "",
    });
  }

  const filteredNames = useMemo(() => names.filter((name) => name.toLowerCase().includes(filter.toLowerCase())), [names, filter]);
  const thresholdNames = new Set(paioThresholds(config).map((rule) => normalizePaioKey(rule.concept)));
  const conceptNames = names.filter((name) => !thresholdNames.has(normalizePaioKey(name)) && (
    catalogEntry(config, name)?.kind === "concept" ||
    (!catalogEntry(config, name) && defaultConcepts.has(normalizePaioKey(name)))
  ));

  async function save() {
    if (!draft || busy || disabled) return;
    setBusy(true);
    try {
      await adminRequest(token, "/api/admin/paio/item", "PUT", { ...draft, kind: thresholdNames.has(normalizePaioKey(draft.name)) ? "concept" : draft.kind });
      invalidatePaioConfig();
      const next = await fetchPaioConfig();
      setConfig(next);
      select(draft.name, next);
      onNotice?.("success", `${draft.name} atualizado no Paiômetro.`);
    } catch (error) {
      onNotice?.("error", error instanceof Error ? error.message : "Falha ao salvar item.");
    } finally { setBusy(false); }
  }

  async function addRule() {
    if (!ruleConcept || thresholdNames.has(normalizePaioKey(ruleConcept)) || !ruleExpression.trim() || busy || disabled) return;
    setBusy(true);
    try {
      await adminRequest(token, "/api/admin/paio/rule", "POST", { concept: ruleConcept, expression: ruleExpression });
      setRuleExpression("");
      invalidatePaioConfig();
      setConfig(await fetchPaioConfig());
      onNotice?.("success", "Associação global adicionada.");
    } catch (error) {
      onNotice?.("error", error instanceof Error ? error.message : "Falha ao cadastrar associação.");
    } finally { setBusy(false); }
  }

  async function removeRule(concept: string, expression: string) {
    if (busy || disabled || !window.confirm(`Remover a associação global ${expression} → ${concept}?`)) return;
    setBusy(true);
    try {
      await adminRequest(token, "/api/admin/paio/rule", "DELETE", { concept, expression });
      invalidatePaioConfig();
      setConfig(await fetchPaioConfig());
      onNotice?.("success", "Associação global removida.");
    } catch (error) {
      onNotice?.("error", error instanceof Error ? error.message : "Falha ao remover associação.");
    } finally { setBusy(false); }
  }

  return (
    <div className="paio-admin-panel">
      <div className="editor-page-heading">
        <div>
          <span>Administração JBL</span>
          <h1>Paiômetro — Catálogo e famílias</h1>
          <p>Defina o que é carta ou conceito, escolha a arte representativa e gerencie vínculos que valem para todos os decks.</p>
        </div>
      </div>
      <div className="paio-admin-layout">
        <div className="paio-admin-list">
          <label>Procurar item</label>
          <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Nome no Google Sheets" />
          <div className="paio-admin-list-scroll">
            {filteredNames.map((name) => (
              <button type="button" key={name} className={selectedName === name ? "active" : ""} onClick={() => select(name)}>
                {name} <small>{thresholdNames.has(normalizePaioKey(name)) || catalogEntry(config, name)?.kind === "concept" || (!catalogEntry(config, name) && defaultConcepts.has(normalizePaioKey(name))) ? "Conceito" : "Carta"}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="paio-admin-settings">
          {draft ? (
            <>
              <h3>{draft.name}</h3>
              <label>Tipo do item
                <select value={thresholdNames.has(normalizePaioKey(draft.name)) ? "concept" : draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as Draft["kind"] })} disabled={disabled || busy || thresholdNames.has(normalizePaioKey(draft.name))}>
                  <option value="card">Carta específica</option>
                  <option value="concept">Conceito / Família</option>
                </select>
              </label>
              <label>Arte representativa (nome exato de uma carta)
                <input value={draft.artCard} onChange={(event) => setDraft({ ...draft, artCard: event.target.value })} placeholder="Ex.: Fynn, the Fangbearer" disabled={disabled || busy} />
              </label>
              <label>Link de destino (opcional)
                <input value={draft.linkUrl} onChange={(event) => setDraft({ ...draft, linkUrl: event.target.value })} placeholder="https://scryfall.com/search?..." disabled={disabled || busy} />
              </label>
              <p className="paio-admin-hint">Para conceitos, a arte é usada na aba Paiômetro e no card da família no modal. O link pode ser do Scryfall ou EDHREC.</p>
              <button className="editor-primary-button" type="button" disabled={disabled || busy} onClick={() => void save()}>
                {busy ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />} Salvar item
              </button>
            </>
          ) : <p>Selecione um item do formulário à esquerda.</p>}
        </div>
      </div>
      <AdminPaioTags config={config} names={names} disabled={disabled || busy} onNotice={onNotice}
        mutate={async (path, method, body) => {
          await adminRequest(token, path, method, body);
          invalidatePaioConfig();
          setConfig(await fetchPaioConfig());
        }} />
      <div className="paio-admin-rules">
        <h3>Associações globais de cartas e conceitos</h3>
        <p>Quando um autor marca uma carta como parte de um conceito e salva o deck, a associação é aprendida automaticamente. Você também pode adicioná-la ou removê-la aqui.</p>
        <div className="paio-admin-add-rule">
          <select value={ruleConcept} onChange={(event) => setRuleConcept(event.target.value)} disabled={busy || disabled}>
            <option value="">Escolha um conceito</option>
            {conceptNames.map((name) => <option value={name} key={name}>{name}</option>)}
          </select>
          <input value={ruleExpression} onChange={(event) => setRuleExpression(event.target.value)} placeholder="Ex.: Seize the Day ou Carta A + Carta B" disabled={busy || disabled} maxLength={120} />
          <button className="editor-secondary-button" type="button" disabled={!ruleConcept || !ruleExpression.trim() || busy || disabled} onClick={() => void addRule()}><Plus size={16} /> Adicionar</button>
        </div>
        <div className="paio-admin-rules-list">
          {config.rules.map((rule) => (
            <div key={`${rule.concept}:${rule.expression}`}>
              <span><strong>{rule.expression}</strong><small>{rule.concept}</small></span>
              <button type="button" title="Remover vínculo global" aria-label={`Remover ${rule.expression}`} disabled={disabled || busy} onClick={() => void removeRule(rule.concept, rule.expression)}><Trash2 size={17} /></button>
            </div>
          ))}
          {!config.rules.length ? <p>Nenhum vínculo global cadastrado ainda.</p> : null}
        </div>
      </div>
    </div>
  );
}
