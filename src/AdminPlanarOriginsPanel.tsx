import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Plus, Save } from "lucide-react";
import KeyrunePicker from "./KeyrunePicker";
import { invalidatePlanarOriginsCache, rareKeyrune, type PlanarOriginKind } from "./PlanarOrigins";
import type { KeyruneUsage } from "./keyruneSymbols";

const API_BASE_URL = "https://api.corneliomove.com.br/mtg-api";

type AdminPlanarOrigin = {
  slug: string;
  label: string;
  keyruneClass: string;
  kind: PlanarOriginKind;
  displayOrder: number;
  isActive: boolean;
  isSystem: boolean;
  deckCount: number;
};

type AdminPlanarDeck = {
  id: number;
  name: string;
  active: boolean;
  origins: string[];
};

type ResponseShape = {
  ok?: boolean;
  error?: string;
  slug?: string;
  origins?: AdminPlanarOrigin[];
  decks?: AdminPlanarDeck[];
};

type Draft = {
  slug: string;
  label: string;
  keyruneClass: string;
  kind: PlanarOriginKind;
  displayOrder: number;
  isActive: boolean;
  isSystem: boolean;
  deckIds: number[];
};

function authHeaders(token: string, json = false) {
  return {
    Authorization: `Bearer ${token}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function parseResponse(response: Response) {
  const json = await response.json() as ResponseShape;
  if (!response.ok || json.ok === false || json.error) {
    throw new Error(json.error || "Não foi possível concluir a solicitação.");
  }
  return json;
}

async function requestAll(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/admin/planar-origins`, {
    headers: authHeaders(token),
  });
  const json = await parseResponse(response);
  return {
    origins: json.origins ?? [],
    decks: json.decks ?? [],
  };
}

function draftFrom(origin: AdminPlanarOrigin, decks: AdminPlanarDeck[]): Draft {
  return {
    slug: origin.slug,
    label: origin.label,
    keyruneClass: origin.keyruneClass,
    kind: origin.kind,
    displayOrder: origin.displayOrder,
    isActive: origin.isActive,
    isSystem: origin.isSystem,
    deckIds: decks.filter((deck) => deck.origins.includes(origin.slug)).map((deck) => deck.id),
  };
}

function newDraft(): Draft {
  return {
    slug: "",
    label: "",
    keyruneClass: "ss ss-cmd",
    kind: "origin",
    displayOrder: 100,
    isActive: true,
    isSystem: false,
    deckIds: [],
  };
}

export default function AdminPlanarOriginsPanel({
  token,
  playerId,
  usage = [],
  disabled = false,
  onNotice,
}: {
  token: string;
  playerId: string;
  usage?: KeyruneUsage[];
  disabled?: boolean;
  onNotice?: (kind: "success" | "error" | "info", text: string) => void;
}) {
  const [origins, setOrigins] = useState<AdminPlanarOrigin[]>([]);
  const [decks, setDecks] = useState<AdminPlanarDeck[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [query, setQuery] = useState("");
  const [deckQuery, setDeckQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load(selectSlug?: string) {
    try {
      setLoading(true);
      const next = await requestAll(token);
      setOrigins(next.origins);
      setDecks(next.decks);

      const wanted = selectSlug || draft?.slug;
      if (wanted) {
        const selected = next.origins.find((origin) => origin.slug === wanted);
        setDraft(selected ? draftFrom(selected, next.decks) : null);
      }
    } catch (error) {
      onNotice?.("error", error instanceof Error ? error.message : "Falha ao carregar origens planares.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  const filteredOrigins = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    if (!needle) return origins;
    return origins.filter((origin) => `${origin.label} ${origin.slug} ${origin.kind}`.toLocaleLowerCase("pt-BR").includes(needle));
  }, [origins, query]);

  const filteredDecks = useMemo(() => {
    const needle = deckQuery.trim().toLocaleLowerCase("pt-BR");
    if (!needle) return decks;
    return decks.filter((deck) => deck.name.toLocaleLowerCase("pt-BR").includes(needle));
  }, [decks, deckQuery]);

  function selectOrigin(origin: AdminPlanarOrigin) {
    setDraft(draftFrom(origin, decks));
    setDeckQuery("");
  }

  function toggleDeck(deckId: number) {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        deckIds: current.deckIds.includes(deckId)
          ? current.deckIds.filter((id) => id !== deckId)
          : [...current.deckIds, deckId],
      };
    });
  }

  async function save() {
    if (!draft || saving || disabled) return;
    if (!draft.label.trim()) {
      onNotice?.("error", "Informe o nome da origem planar.");
      return;
    }

    try {
      setSaving(true);
      const body = {
        label: draft.label,
        keyruneClass: draft.keyruneClass,
        kind: draft.kind,
        displayOrder: draft.displayOrder,
        isActive: draft.isActive,
      };

      let slug = draft.slug;
      if (slug) {
        await parseResponse(await fetch(`${API_BASE_URL}/api/admin/planar-origins/${encodeURIComponent(slug)}`, {
          method: "PUT",
          headers: authHeaders(token, true),
          body: JSON.stringify(body),
        }));
      } else {
        const created = await parseResponse(await fetch(`${API_BASE_URL}/api/admin/planar-origins`, {
          method: "POST",
          headers: authHeaders(token, true),
          body: JSON.stringify(body),
        }));
        slug = created.slug || "";
      }

      if (slug && draft.kind === "origin") {
        await parseResponse(await fetch(`${API_BASE_URL}/api/admin/planar-origins/${encodeURIComponent(slug)}/assignments`, {
          method: "POST",
          headers: authHeaders(token, true),
          body: JSON.stringify({ deckIds: draft.deckIds }),
        }));
      }

      invalidatePlanarOriginsCache();
      await load(slug);
      onNotice?.("success", `${draft.label} salva com sucesso.`);
    } catch (error) {
      onNotice?.("error", error instanceof Error ? error.message : "Falha ao salvar origem planar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="editor-admin-planar-panel">
      <div className="editor-page-heading">
        <div>
          <span>Administração JBL</span>
          <h1>Origens Planares</h1>
          <p>Universos podem ser combinados no mesmo deck; planos e franquias também podem ser múltiplos. Todo Keyrune é exibido com acabamento Raro.</p>
        </div>
        <button className="editor-primary-button" type="button" disabled={disabled || saving} onClick={() => setDraft(newDraft())}>
          <Plus size={17} /> Nova origem
        </button>
      </div>

      <div className="editor-admin-planar-layout">
        <div className="editor-admin-planar-list-wrap">
          <label className="editor-field">
            <span>Buscar origem</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ravnica, Marvel..." />
          </label>

          <div className="editor-admin-planar-list">
            {loading && !origins.length ? <p className="editor-field-hint">Carregando...</p> : null}
            {filteredOrigins.map((origin) => (
              <button
                type="button"
                key={origin.slug}
                className={`editor-admin-planar-card${draft?.slug === origin.slug ? " selected" : ""}${!origin.isActive ? " inactive" : ""}`}
                onClick={() => selectOrigin(origin)}
              >
                <i className={rareKeyrune(origin.keyruneClass)} aria-hidden="true" />
                <span>
                  <strong>{origin.label}</strong>
                  <small>{origin.kind === "universe" ? "Universo" : "Plano / franquia"} · {origin.deckCount} deck{origin.deckCount === 1 ? "" : "s"}{origin.isSystem ? " · sistema" : ""}{!origin.isActive ? " · inativa" : ""}</small>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="editor-admin-planar-editor">
          {!draft ? (
            <div className="editor-form-section">
              <div className="editor-section-heading">
                <h2>Selecione uma origem</h2>
                <p>Edite uma definição existente ou crie uma nova.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="editor-form-section">
                <div className="editor-section-heading">
                  <h2>{draft.slug ? "Editar origem" : "Nova origem"}</h2>
                  <p>{draft.isSystem ? "Classificação de universo protegida: nome, tipo e ativação não podem ser alterados." : "O identificador é criado pelo nome e permanece estável depois do cadastro."}</p>
                </div>

                <div className="editor-admin-planar-preview">
                  <i className={rareKeyrune(draft.keyruneClass)} aria-hidden="true" />
                  <div>
                    <strong>{draft.label || "Nova origem"}</strong>
                    <small>Acabamento Raro · {draft.kind === "universe" ? "Universo" : "Plano / franquia"}</small>
                  </div>
                </div>

                <div className="editor-form-grid">
                  <label className="editor-field">
                    <span>Nome</span>
                    <input value={draft.label} disabled={draft.isSystem} onChange={(event) => setDraft({ ...draft, label: event.target.value })} />
                  </label>

                  <label className="editor-field">
                    <span>Tipo</span>
                    <select value={draft.kind} disabled={draft.isSystem} onChange={(event) => setDraft({ ...draft, kind: event.target.value as PlanarOriginKind })}>
                      <option value="origin">Plano / franquia</option>
                      <option value="universe">Universo</option>
                    </select>
                  </label>

                  <label className="editor-field">
                    <span>Ordem</span>
                    <input type="number" min={0} max={9999} value={draft.displayOrder} onChange={(event) => setDraft({ ...draft, displayOrder: Number(event.target.value) })} />
                  </label>

                  <label className="editor-field editor-admin-planar-active">
                    <span>Ativa</span>
                    <input type="checkbox" checked={draft.isActive} disabled={draft.isSystem} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} />
                  </label>
                </div>

                <KeyrunePicker
                  label="Ícone Keyrune"
                  value={draft.keyruneClass}
                  usage={usage}
                  playerId={playerId}
                  finish="rare"
                  disabled={disabled || saving}
                  onChange={(value) => setDraft({ ...draft, keyruneClass: value })}
                />
              </div>

              {draft.kind === "origin" ? (
                <div className="editor-form-section">
                  <div className="editor-section-heading">
                    <h2>Decks associados</h2>
                    <p>Um deck pode possuir várias origens deste tipo.</p>
                  </div>
                  <label className="editor-field">
                    <span>Buscar deck</span>
                    <input value={deckQuery} onChange={(event) => setDeckQuery(event.target.value)} placeholder="Nome do deck" />
                  </label>
                  <div className="editor-admin-planar-decks">
                    {filteredDecks.map((deck) => (
                      <label key={deck.id} className="editor-admin-planar-deck-option">
                        <input type="checkbox" checked={draft.deckIds.includes(deck.id)} onChange={() => toggleDeck(deck.id)} />
                        <span><strong>{deck.name}</strong>{!deck.active ? <small>Inativo</small> : null}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="editor-form-section">
                  <div className="editor-section-heading">
                    <h2>Classificação de universo</h2>
                    <p>A atribuição de universos é feita no editor de cada deck. Cada deck deve ter pelo menos um universo e pode combinar Magic The Gathering + Universes Beyond.</p>
                  </div>
                </div>
              )}

              <div className="editor-form-actions">
                <button className="editor-primary-button" type="button" disabled={disabled || saving} onClick={() => void save()}>
                  {saving ? <LoaderCircle size={17} className="spin" /> : <Save size={17} />}
                  {saving ? "Salvando..." : draft.slug ? "Salvar origem" : "Criar origem"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
