import { useEffect, useState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import {
  DEFAULT_VISIBILITY,
  evaluateVisibilityExpression,
  fetchVisibilityConfig,
  saveVisibilityConfig,
  type VisibilityConfig,
  type VisibilityRule,
} from "./leaderboardVisibility";
import "./adminLeaderboardVisibility.css";

type Props = {
  token: string;
  disabled?: boolean;
  onNotice?: (kind: "success" | "error" | "info", text: string) => void;
};
const sample = {
  partidas: 8, vitorias: 5, derrotas: 3, winrate: 0.625,
  mediaPartidas: 6, maxPartidas: 22, totalPartidas: 240, totalParticipantes: 40,
};

function RuleEditor({ scope, rule, onChange }: {
  scope: string;
  rule: VisibilityRule;
  onChange: (rule: VisibilityRule) => void;
}) {
  let preview = "";
  let invalid = false;
  if (rule.mode === "expression") {
    try {
      const result = evaluateVisibilityExpression(rule.expression, sample);
      preview = `Exemplo (8 partidas, média 6): ${Number.isInteger(result) ? result : result.toFixed(2)}`;
    } catch (error) {
      invalid = true;
      preview = error instanceof Error ? error.message : "Expressão inválida";
    }
  }
  return (
    <div className="leaderboard-rule-card">
      <h3>{scope}</h3>
      <label>Tipo do critério
        <select value={rule.mode} onChange={(event) => onChange({ ...rule, mode: event.target.value as VisibilityRule["mode"] })}>
          <option value="fixed">Número fixo de partidas</option>
          <option value="expression">Expressão matemática / lógica</option>
        </select>
      </label>
      {rule.mode === "fixed" ? (
        <label>Mínimo de partidas
          <input type="number" min={0} max={100000} step={1} value={rule.minimumGames} onChange={(event) => onChange({ ...rule, minimumGames: Number(event.target.value) })} />
        </label>
      ) : (
        <>
          <label>Expressão
            <input spellCheck={false} value={rule.expression} onChange={(event) => onChange({ ...rule, expression: event.target.value })} placeholder="partidas >= max(4, ceil(mediaPartidas/2))" />
          </label>
          <p className={`leaderboard-rule-preview${invalid ? " invalid" : ""}`}>{preview}</p>
          <p className="leaderboard-rule-help">Exemplos: <code>partidas &gt;= 4</code>, <code>partidas &gt;= ceil(mediaPartidas/2)</code> ou <code>max(3, mediaPartidas*0.5)</code> (limite calculado).</p>
        </>
      )}
      <p className="leaderboard-rule-help">O mínimo fixo também é usado como reserva se uma expressão se tornar inválida.</p>
    </div>
  );
}

export default function AdminLeaderboardVisibilityPanel({ token, disabled, onNotice }: Props) {
  const [settings, setSettings] = useState<VisibilityConfig>(DEFAULT_VISIBILITY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void fetchVisibilityConfig().then((value) => {
      if (active) setSettings(value);
    }).catch((error) => onNotice?.("error", error instanceof Error ? error.message : "Erro ao carregar critérios."))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);
  async function save() {
    if (busy || disabled) return;
    for (const rule of [settings.players, settings.decks]) {
      if (rule.mode !== "expression") continue;
      try { evaluateVisibilityExpression(rule.expression, sample); }
      catch (error) { onNotice?.("error", error instanceof Error ? error.message : "Expressão inválida."); return; }
    }
    setBusy(true);
    try {
      await saveVisibilityConfig(token, settings);
      onNotice?.("success", "Critérios de jogadores e decks salvos. O ranking recebe a atualização automaticamente.");
    } catch (error) {
      onNotice?.("error", error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally { setBusy(false); }
  }
  return (
    <div className="leaderboard-visibility-admin">
      <div className="editor-page-heading"><div>
        <span>Administração JBL</span><h1>Critérios da leaderboard</h1>
        <p>Configure separadamente quais jogadores e decks aparecem no ranking. O toggle “Exibir ocultos” mostra os excluídos dos critérios, inclusive decks inativos e excluídos.</p>
      </div></div>
      {loading ? <p>Carregando critérios...</p> : null}
      <div className="leaderboard-visibility-grid">
        <RuleEditor scope="Jogadores" rule={settings.players} onChange={(players) => setSettings({ ...settings, players })} />
        <RuleEditor scope="Decks" rule={settings.decks} onChange={(decks) => setSettings({ ...settings, decks })} />
      </div>
      <div className="leaderboard-visibility-reference">
        <strong>Variáveis disponíveis</strong>
        <p><code>partidas</code>, <code>vitorias</code>, <code>derrotas</code>, <code>winrate</code> (0 a 1), <code>mediaPartidas</code>, <code>maxPartidas</code>, <code>totalPartidas</code>, <code>totalParticipantes</code>. As médias e os totais são calculados separadamente entre jogadores e decks, no período selecionado.</p>
        <p>Funções: <code>min</code>, <code>max</code>, <code>ceil</code>, <code>floor</code>, <code>round</code>, <code>abs</code>. Aceita +, -, *, /, %, parênteses, comparações, && e ||. Sem executar JavaScript.</p>
      </div>
      <button className="editor-primary-button" type="button" onClick={() => void save()} disabled={loading || disabled || busy}>
        {busy ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />} Salvar critérios
      </button>
    </div>
  );
}
