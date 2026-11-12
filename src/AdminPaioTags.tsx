import { useMemo, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { findCardOnScryfall } from "./editorScryfall";
import { normalizePaioKey, paioThresholds, type PaioConfig } from "./paioConfig";

type Props = {
  config: PaioConfig;
  names: string[];
  disabled?: boolean;
  mutate: (path: string, method: string, body: object) => Promise<void>;
  onNotice?: (kind: "success" | "error" | "info", message: string) => void;
};

export default function AdminPaioTags({ config, names, disabled, mutate, onNotice }: Props) {
  const [tagName, setTagName] = useState("");
  const [selected, setSelected] = useState("");
  const [cards, setCards] = useState("");
  const [filter, setFilter] = useState("");
  const [lookup, setLookup] = useState("");
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [concept, setConcept] = useState("");
  const [ruleTag, setRuleTag] = useState("");
  const [minimum, setMinimum] = useState("9");
  const tags = config.tags ?? [];
  const tagKey = tags.some((tag) => tag.key === selected) ? selected : tags[0]?.key ?? "";
  const members = useMemo(() => (config.tagMembers ?? []).filter((member) => member.tagKey === tagKey), [config, tagKey]);
  const visible = members.filter((member) => normalizePaioKey(member.cardName).includes(normalizePaioKey(filter)));
  const thresholds = paioThresholds(config);
  const blocked = new Set(["combos de duas cartas", "shock lands no geral", "fetch lands no geral", "triomas tipais no geral"]);
  const locked = ["decks com 9 ou mais counterspells", "decks com 9 ou mais boardwipes"].includes(normalizePaioKey(concept));
  const disabledNow = disabled || busy;

  async function run(path: string, method: string, body: object, message: string) {
    if (disabledNow) return false;
    setBusy(true);
    try { await mutate(path, method, body); onNotice?.("success", message); return true; }
    catch (error) { onNotice?.("error", error instanceof Error ? error.message : "Não foi possível salvar."); return false; }
    finally { setBusy(false); }
  }
  async function create() {
    const name = tagName.trim();
    if (!name) return;
    if (await run("/api/admin/paio/tag", "POST", { name }, "Tag criada.")) {
      setSelected(normalizePaioKey(name)); setTagName("");
    }
  }
  async function addCards() {
    const list = cards.split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
    if (!tagKey || !list.length) return;
    if (await run("/api/admin/paio/tag/members", "POST", { tagKey, cards: list }, "Cartas marcadas globalmente.")) setCards("");
  }
  async function searchCard() {
    if (!lookup.trim() || searching) return;
    setSearching(true);
    try {
      const card = await findCardOnScryfall(lookup);
      setCards((current) => [...new Set([...current.split(/\r?\n/).map((name) => name.trim()).filter(Boolean), card.name])].join("\n"));
      setLookup("");
    } catch (error) { onNotice?.("error", error instanceof Error ? error.message : "Carta não encontrada."); }
    finally { setSearching(false); }
  }
  function selectConcept(name: string) {
    setConcept(name);
    const rule = thresholds.find((item) => normalizePaioKey(item.concept) === normalizePaioKey(name));
    setRuleTag(rule?.tagKey ?? tagKey);
    setMinimum(String(rule?.minimum ?? 9));
  }

  return <div className="paio-admin-rules paio-tags-panel">
    <h3>Tags de cartas e categorias por quantidade</h3>
    <p>Crie tags reutilizáveis e marque qualquer carta do Magic, mesmo que ela não tenha nota individual no formulário. As tags valem para todos os decks.</p>
    <div className="paio-tags-row">
      <input aria-label="Nome da nova tag" placeholder="Nova tag, ex.: Counterspell" value={tagName} onChange={(event) => setTagName(event.target.value)} maxLength={80} disabled={disabledNow} />
      <button type="button" className="editor-secondary-button" disabled={disabledNow || !tagName.trim()} onClick={() => void create()}><Plus size={16}/> Criar tag</button>
    </div>
    <label>Tag a editar
      <select value={tagKey} onChange={(event) => { setSelected(event.target.value); setFilter(""); }} disabled={disabledNow}>
        <option value="" disabled>Selecione uma tag</option>
        {tags.map((tag) => <option key={tag.key} value={tag.key}>{tag.name}</option>)}
      </select>
    </label>
    <div className="paio-tags-row">
      <input aria-label="Buscar carta no Scryfall" value={lookup} onChange={(event) => setLookup(event.target.value)} placeholder="Buscar carta no Scryfall" disabled={disabledNow || searching || !tagKey} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchCard(); } }} />
      <button type="button" className="editor-secondary-button" disabled={disabledNow || searching || !tagKey || !lookup.trim()} onClick={() => void searchCard()}><Search size={16}/>{searching ? "Buscando..." : "Buscar e adicionar à lista"}</button>
    </div>
    <label>Cartas para marcar (um nome exato por linha)
      <textarea rows={5} value={cards} onChange={(event) => setCards(event.target.value)} placeholder={"Counterspell\nMana Drain\nNegate"} disabled={disabledNow || !tagKey}/>
    </label>
    <button type="button" className="editor-primary-button" disabled={disabledNow || !tagKey || !cards.trim()} onClick={() => void addCards()}><Plus size={16}/> Salvar cartas na tag</button>
    <h4>{members.length} cartas marcadas</h4>
    <input aria-label="Filtrar cartas marcadas" placeholder="Filtrar cartas desta tag" value={filter} onChange={(event) => setFilter(event.target.value)}/>
    <div className="paio-admin-rules-list">
      {visible.map((member) => <div key={member.cardName}><a href={`https://scryfall.com/search?q=${encodeURIComponent(`!"${member.cardName}"`)}`} target="_blank" rel="noopener noreferrer">{member.cardName}</a><button type="button" disabled={disabledNow} aria-label={`Remover tag de ${member.cardName}`} onClick={() => void run("/api/admin/paio/tag/members", "DELETE", { tagKey, cards: [member.cardName] }, "Tag removida da carta.")}><Trash2 size={16}/></button></div>)}
      {!visible.length && <p>Nenhuma carta encontrada nesta tag.</p>}
    </div>
    <h4>Regras de quantidade</h4>
    <p>O deck soma a nota do conceito apenas uma vez ao atingir o mínimo. As duas categorias de 9 cartas já estão configuradas.</p>
    <div className="paio-admin-rules-list">
      {thresholds.map((rule) => <div key={rule.concept}><span><strong>{rule.concept}</strong><small>{tags.find((tag) => tag.key === rule.tagKey)?.name ?? rule.tagKey} · mínimo {rule.minimum}</small></span><button type="button" className="paio-tags-edit" onClick={() => selectConcept(rule.concept)}>Editar</button></div>)}
    </div>
    <div className="paio-tags-threshold-form">
      <label>Item do Paiômetro<select value={concept} onChange={(event) => selectConcept(event.target.value)} disabled={disabledNow}><option value="">Escolha o item do formulário</option>{[...new Set([...names, ...thresholds.map((rule) => rule.concept)])].filter((name) => !blocked.has(normalizePaioKey(name))).map((name) => <option key={name}>{name}</option>)}</select></label>
      <label>Tag<select value={ruleTag} onChange={(event) => setRuleTag(event.target.value)} disabled={disabledNow || locked}><option value="">Escolha uma tag</option>{tags.map((tag) => <option key={tag.key} value={tag.key}>{tag.name}</option>)}</select></label>
      <label>Mínimo de cartas<input type="number" min={1} max={1000} step={1} value={minimum} onChange={(event) => setMinimum(event.target.value)} disabled={disabledNow || locked}/></label>
      <button type="button" className="editor-primary-button" disabled={disabledNow || !concept || !ruleTag || !Number.isInteger(Number(minimum)) || Number(minimum) < 1 || Number(minimum) > 1000} onClick={() => void run("/api/admin/paio/threshold", "PUT", { concept, tagKey: ruleTag, minimum: Number(minimum) }, "Regra de quantidade salva.")}>Salvar regra</button>
    </div>
    <small>As cartas podem ter várias tags. A criação de uma tag, sozinha, não adiciona pontos.</small>
  </div>;
}
