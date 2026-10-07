import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Beaker,
  Copy,
  LoaderCircle,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
} from "lucide-react";

import "./adminAchievements.css";

const API_BASE_URL = "https://api.corneliomove.com.br/mtg-api";

const TIERS = [
  ["common", "Comum"],
  ["uncommon", "Incomum"],
  ["rare", "Rara"],
  ["mythic", "Mítica"],
  ["legendary", "Lendária"],
] as const;

type Thresholds = Partial<Record<(typeof TIERS)[number][0], number>>;

type AchievementDefinition = {
  id: string;
  name: string;
  description: string;
  icon: string;
  source: "manual" | "derived";
  thresholds: Thresholds;
  scryfallUrl: string;
  ruleMode: "legacy" | "code" | "manual";
  ruleCode: string;
  isActive: boolean;
  isDeleted: boolean;
  displayOrder: number;
  persisted: boolean;
  holders: number;
  playersWithProgress: number;
};

type PlayerOption = {
  id: string;
  displayName: string;
};

type RuleContextHelp = {
  summary: string;
  example: string;
  fields: string[];
};

type AdminResponse = {
  ok?: boolean;
  error?: string;
  achievements?: AchievementDefinition[];
  players?: PlayerOption[];
  ruleContextHelp?: RuleContextHelp;
};

type Draft = Omit<AchievementDefinition, "holders" | "playersWithProgress">;

type Props = {
  token: string;
  disabled?: boolean;
  onNotice?: (kind: "success" | "error" | "info", text: string) => void;
};

const ICONS = [
  "trophy", "flame", "skull", "star", "sparkles", "sword", "swords",
  "eye", "crown", "shield", "zap", "target", "book", "hammer",
  "hourglass", "sun", "settings",
];

function authHeaders(token: string, json = false) {
  return {
    Authorization: `Bearer ${token}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function readJson(response: Response) {
  const json = await response.json() as { ok?: boolean; error?: string; message?: string };
  if (!response.ok || json.ok === false || json.error) {
    throw new Error(json.error || "Não foi possível concluir a solicitação.");
  }
  return json;
}

function blankDraft(): Draft {
  return {
    id: "",
    name: "",
    description: "",
    icon: "star",
    source: "derived",
    thresholds: { common: 1 },
    scryfallUrl: "",
    ruleMode: "code",
    ruleCode: `return ctx.matches.filter((match) =>\n  match.won\n).length;`,
    isActive: true,
    isDeleted: false,
    displayOrder: 0,
    persisted: false,
  };
}

function definitionDraft(item: AchievementDefinition): Draft {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    icon: item.icon,
    source: item.source,
    thresholds: { ...(item.thresholds || {}) },
    scryfallUrl: item.scryfallUrl || "",
    ruleMode: item.ruleMode,
    ruleCode: item.ruleCode || "",
    isActive: item.isActive,
    isDeleted: item.isDeleted,
    displayOrder: Number(item.displayOrder || 0),
    persisted: item.persisted,
  };
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function AdminAchievementsPanel({
  token,
  disabled = false,
  onNotice,
}: Props) {
  const [items, setItems] = useState<AchievementDefinition[]>([]);
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [help, setHelp] = useState<RuleContextHelp | null>(null);
  const [draft, setDraft] = useState<Draft>(() => blankDraft());
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "automatic" | "manual" | "inactive" | "deleted">("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPlayer, setTestPlayer] = useState("");
  const [testResult, setTestResult] = useState<any>(null);

  async function load(preferId = "") {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/achievements?t=${Date.now()}`, {
        headers: authHeaders(token),
      });
      const json = await response.json() as AdminResponse;
      if (!response.ok || json.ok === false || json.error) {
        throw new Error(json.error || "Não foi possível carregar as conquistas.");
      }

      const nextItems = json.achievements ?? [];
      setItems(nextItems);
      setPlayers(json.players ?? []);
      setHelp(json.ruleContextHelp ?? null);
      setTestPlayer((current) => current || json.players?.[0]?.id || "");

      const wanted = preferId || selectedId;
      const selected = nextItems.find((item) => item.id === wanted);
      if (selected) {
        setSelectedId(selected.id);
        setDraft(definitionDraft(selected));
      } else if (nextItems[0]) {
        setSelectedId(nextItems[0].id);
        setDraft(definitionDraft(nextItems[0]));
      }
    } catch (error) {
      onNotice?.("error", error instanceof Error ? error.message : "Falha ao carregar conquistas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // token identifica a sessão; recarregar quando ela mudar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const visible = useMemo(() => {
    const words = normalizeSearch(query).trim().split(/\s+/).filter(Boolean);
    return items.filter((item) => {
      if (filter === "automatic" && item.source !== "derived") return false;
      if (filter === "manual" && item.source !== "manual") return false;
      if (filter === "inactive" && (item.isActive || item.isDeleted)) return false;
      if (filter === "deleted" && !item.isDeleted) return false;
      if (filter === "all" && (!item.isActive || item.isDeleted)) return false;

      const haystack = normalizeSearch(`${item.name} ${item.id} ${item.description}`);
      return words.every((word) => haystack.includes(word));
    });
  }, [filter, items, query]);

  function select(item: AchievementDefinition) {
    setSelectedId(item.id);
    setDraft(definitionDraft(item));
    setTestResult(null);
  }

  function newAchievement() {
    setSelectedId("");
    setDraft(blankDraft());
    setTestResult(null);
  }

  function duplicate() {
    const copy = {
      ...draft,
      id: draft.id ? `${draft.id}_copy` : "",
      name: draft.name ? `${draft.name} (cópia)` : "",
      persisted: false,
      isDeleted: false,
      isActive: true,
      ruleMode: draft.source === "manual" ? "manual" : draft.ruleMode === "legacy" ? "code" : draft.ruleMode,
      ruleCode: draft.ruleMode === "legacy" ? (help?.example || blankDraft().ruleCode) : draft.ruleCode,
    } satisfies Draft;
    setSelectedId("");
    setDraft(copy);
    setTestResult(null);
  }

  function updateThreshold(tier: string, value: string) {
    const amount = Math.max(0, Math.floor(Number(value || 0)));
    setDraft((current) => ({
      ...current,
      thresholds: {
        ...current.thresholds,
        [tier]: amount || undefined,
      },
    }));
  }

  async function save() {
    setSaving(true);
    setTestResult(null);
    try {
      const payload = {
        ...draft,
        ruleMode: draft.source === "manual" ? "manual" : draft.ruleMode,
      };
      const editing = Boolean(selectedId);
      const response = await fetch(
        editing
          ? `${API_BASE_URL}/api/admin/achievements/${encodeURIComponent(selectedId)}`
          : `${API_BASE_URL}/api/admin/achievements`,
        {
          method: editing ? "PUT" : "POST",
          headers: authHeaders(token, true),
          body: JSON.stringify(payload),
        },
      );
      const json = await readJson(response);
      onNotice?.("success", json.message || "Conquista salva.");
      await load(draft.id);
    } catch (error) {
      onNotice?.("error", error instanceof Error ? error.message : "Falha ao salvar conquista.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!selectedId) return;
    setSaving(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/achievements/${encodeURIComponent(selectedId)}`,
        {
          method: "DELETE",
          headers: authHeaders(token),
        },
      );
      const json = await readJson(response);
      onNotice?.("success", json.message || "Conquista excluída.");
      await load(selectedId);
    } catch (error) {
      onNotice?.("error", error instanceof Error ? error.message : "Falha ao excluir conquista.");
    } finally {
      setSaving(false);
    }
  }

  async function restore() {
    if (!selectedId) return;
    setSaving(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/achievements/${encodeURIComponent(selectedId)}/restore`,
        {
          method: "POST",
          headers: authHeaders(token),
        },
      );
      const json = await readJson(response);
      onNotice?.("success", json.message || "Conquista restaurada.");
      await load(selectedId);
    } catch (error) {
      onNotice?.("error", error instanceof Error ? error.message : "Falha ao restaurar conquista.");
    } finally {
      setSaving(false);
    }
  }

  async function testRule() {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/achievements/test`, {
        method: "POST",
        headers: authHeaders(token, true),
        body: JSON.stringify({
          ruleCode: draft.ruleCode,
          thresholds: draft.thresholds,
          player: testPlayer,
        }),
      });
      const json = await readJson(response) as any;
      setTestResult(json);
    } catch (error) {
      onNotice?.("error", error instanceof Error ? error.message : "Falha ao testar regra.");
    } finally {
      setTesting(false);
    }
  }

  const busy = disabled || saving || loading;

  return (
    <div className="editor-admin-achievements">
      <div className="editor-page-heading">
        <div>
          <span>Catálogo dinâmico</span>
          <h1>Conquistas</h1>
          <p>Edite o catálogo, crie regras automáticas e teste a lógica sem reiniciar o servidor.</p>
        </div>
        <button type="button" className="editor-primary-button" disabled={busy} onClick={newAchievement}>
          <Plus size={17} /> Nova conquista
        </button>
      </div>

      <div className="admin-achievements-layout">
        <aside className="admin-achievements-sidebar">
          <label className="admin-achievements-search">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar conquista..." />
          </label>

          <div className="admin-achievements-filters">
            {([
              ["all", "Ativas"],
              ["automatic", "Automáticas"],
              ["manual", "Manuais"],
              ["inactive", "Inativas"],
              ["deleted", "Excluídas"],
            ] as const).map(([value, label]) => (
              <button key={value} type="button" className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>
                {label}
              </button>
            ))}
          </div>

          <div className="admin-achievements-list">
            {loading ? <p className="editor-field-hint">Carregando...</p> : null}
            {!loading && !visible.length ? <p className="editor-field-hint">Nenhuma conquista encontrada.</p> : null}
            {visible.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`admin-achievement-list-item${selectedId === item.id ? " selected" : ""}${item.isDeleted ? " deleted" : ""}`}
                onClick={() => select(item)}
              >
                <span className="admin-achievement-list-icon">{item.icon || "★"}</span>
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.id}</small>
                  <em>{item.source === "manual" ? "Manual" : item.ruleMode === "code" ? "Código" : "Legada"} · {item.holders} desbloqueios</em>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="admin-achievement-editor">
          <div className="admin-achievement-editor-topline">
            <div>
              <span>{selectedId ? "EDITAR CONQUISTA" : "NOVA CONQUISTA"}</span>
              <h2>{draft.name || "Sem nome"}</h2>
            </div>
            {selectedId ? (
              <button type="button" className="editor-secondary-button" disabled={busy} onClick={duplicate}>
                <Copy size={16} /> Duplicar
              </button>
            ) : null}
          </div>

          <div className="editor-form-grid admin-achievement-basic-grid">
            <label className="editor-field">
              <span>ID interno</span>
              <input
                value={draft.id}
                disabled={Boolean(selectedId)}
                onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") }))}
                placeholder="minha_conquista"
              />
              <small>Não muda depois de criada.</small>
            </label>

            <label className="editor-field">
              <span>Nome</span>
              <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
            </label>

            <label className="editor-field">
              <span>Ícone</span>
              <input list="achievement-icon-options" value={draft.icon} onChange={(event) => setDraft((current) => ({ ...current, icon: event.target.value }))} />
              <datalist id="achievement-icon-options">
                {ICONS.map((icon) => <option value={icon} key={icon} />)}
              </datalist>
            </label>

            <label className="editor-field">
              <span>Ordem</span>
              <input type="number" min="0" value={draft.displayOrder} onChange={(event) => setDraft((current) => ({ ...current, displayOrder: Math.max(0, Number(event.target.value || 0)) }))} />
            </label>
          </div>

          <label className="editor-field">
            <span>Descrição</span>
            <textarea rows={3} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
          </label>

          <label className="editor-field">
            <span>Link Scryfall</span>
            <input value={draft.scryfallUrl} onChange={(event) => setDraft((current) => ({ ...current, scryfallUrl: event.target.value }))} placeholder="https://scryfall.com/..." />
          </label>

          <div className="admin-achievement-mode-row">
            <label className="editor-field">
              <span>Tipo</span>
              <select
                value={draft.source}
                disabled={Boolean(selectedId)}
                onChange={(event) => {
                  const source = event.target.value as "manual" | "derived";
                  setDraft((current) => ({
                    ...current,
                    source,
                    ruleMode: source === "manual" ? "manual" : current.ruleMode === "manual" ? "code" : current.ruleMode,
                  }));
                }}
              >
                <option value="derived">Automática</option>
                <option value="manual">Manual</option>
              </select>
            </label>

            {draft.source === "derived" ? (
              <label className="editor-field">
                <span>Lógica</span>
                <select value={draft.ruleMode} onChange={(event) => setDraft((current) => ({ ...current, ruleMode: event.target.value as "legacy" | "code" }))}>
                  <option value="legacy">Legada</option>
                  <option value="code">Código personalizado</option>
                </select>
              </label>
            ) : null}

            <label className="admin-achievement-toggle">
              <input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))} />
              <span>Conquista ativa</span>
            </label>
          </div>

          <div className="admin-achievement-thresholds">
            <div className="editor-section-heading">
              <div>
                <h3>Progressão</h3>
                <p>Deixe 0/vazio para não usar uma raridade.</p>
              </div>
            </div>
            <div className="admin-achievement-threshold-grid">
              {TIERS.map(([tier, label]) => (
                <label className={`admin-achievement-threshold tier-${tier}`} key={tier}>
                  <span>{label}</span>
                  <input type="number" min="0" value={draft.thresholds[tier] || ""} onChange={(event) => updateThreshold(tier, event.target.value)} placeholder="—" />
                </label>
              ))}
            </div>
          </div>

          {draft.source === "derived" && draft.ruleMode === "code" ? (
            <div className="admin-achievement-code-section">
              <div className="editor-section-heading">
                <div>
                  <h3>Regra personalizada</h3>
                  <p>{help?.summary || "Retorne um número ou um objeto de resultado."}</p>
                </div>
              </div>

              <textarea
                className="admin-achievement-code"
                spellCheck={false}
                value={draft.ruleCode}
                onChange={(event) => setDraft((current) => ({ ...current, ruleCode: event.target.value }))}
              />

              <details className="admin-achievement-code-help">
                <summary>Contexto disponível no código</summary>
                <code>{help?.example || "return ctx.stats.wins;"}</code>
                <ul>
                  {(help?.fields || []).map((field) => <li key={field}>{field}</li>)}
                </ul>
              </details>

              <div className="admin-achievement-test-row">
                <label className="editor-field">
                  <span>Testar como</span>
                  <select value={testPlayer} onChange={(event) => setTestPlayer(event.target.value)}>
                    {players.map((player) => <option key={player.id} value={player.id}>{player.displayName} ({player.id})</option>)}
                  </select>
                </label>
                <button type="button" className="editor-secondary-button" disabled={busy || testing || !draft.ruleCode.trim()} onClick={() => void testRule()}>
                  {testing ? <LoaderCircle size={16} className="spin" /> : <Beaker size={16} />}
                  Testar regra
                </button>
              </div>

              {testResult?.achievement ? (
                <div className="admin-achievement-test-result">
                  <strong>{testResult.displayName || testResult.player}</strong>
                  <span>Valor <b>{testResult.achievement.value}</b></span>
                  <span>Tier <b>{testResult.achievement.tier}</b></span>
                  <span>Alvo <b>{testResult.achievement.target}</b></span>
                  <span>Progresso <b>{Math.round(testResult.achievement.progress)}%</b></span>
                  <span>Desbloqueada <b>{testResult.achievement.unlocked ? "sim" : "não"}</b></span>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="editor-form-actions admin-achievement-actions">
            <button type="button" className="editor-primary-button" disabled={busy || !draft.id || !draft.name || !draft.description} onClick={() => void save()}>
              {saving ? <LoaderCircle size={17} className="spin" /> : <Save size={17} />}
              Salvar conquista
            </button>

            {selectedId && draft.isDeleted ? (
              <button type="button" className="editor-secondary-button" disabled={busy} onClick={() => void restore()}>
                <RotateCcw size={16} /> Restaurar
              </button>
            ) : selectedId ? (
              <button type="button" className="editor-danger-button" disabled={busy || !draft.persisted} onClick={() => void remove()}>
                <Trash2 size={16} /> Excluir
              </button>
            ) : null}
          </div>

          {selectedId && !draft.persisted ? (
            <p className="editor-field-hint">Esta conquista veio do engine legado e ainda não tinha registro próprio no catálogo. Salve uma vez para persistir as configurações administrativas.</p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
