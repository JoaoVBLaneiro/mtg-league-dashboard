import { useEffect, useMemo, useState } from "react";
import { fetchPaioConfig, normalizePaioKey, paioThresholds, type PaioConfig } from "./paioConfig";
import { Plus, Trash2 } from "lucide-react";
import { PAIO_AUTO_CONCEPTS, PAIO_CONCEPTS, parsePaioAssignments } from "./paiometroDeck";
import "./paiometroDeck.css";

type Props = {
  value: string | number | null | undefined;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export default function PaiometroConceptEditor({ value, onChange, disabled }: Props) {
  const [concept, setConcept] = useState<string>(PAIO_CONCEPTS[0]);
  const [detail, setDetail] = useState("");
  const [config, setConfig] = useState<PaioConfig>({ items: [], rules: [] });
  useEffect(() => {
    let mounted = true;
    void fetchPaioConfig().then((data) => { if (mounted) setConfig(data); }).catch(() => {});
    return () => { mounted = false; };
  }, []);
  const concepts = useMemo(() => [...new Set([
    ...PAIO_CONCEPTS,
    ...config.items.filter((item) => item.kind === "concept").map((item) => item.name),
  ])].filter((name) => ![...PAIO_AUTO_CONCEPTS, ...paioThresholds(config).map((rule) => rule.concept)].some((auto) => normalizePaioKey(auto) === normalizePaioKey(name))), [config]);
  const assignments = parsePaioAssignments(value);
  const autoNames = new Set<string>([...PAIO_AUTO_CONCEPTS, ...paioThresholds(config).map((rule) => rule.concept)].map(normalizePaioKey));

  function add() {
    const clean = detail.trim().replace(/\s+/g, " ");
    if (clean.length < 2 || clean.length > 120 || assignments.length >= 30) return;
    if (assignments.some((item) => item.concept === concept && item.detail.toLowerCase() === clean.toLowerCase())) return;
    const chosenConcept = concepts.includes(concept) ? concept : (concepts[0] ?? "");
    if (!chosenConcept) return;
    onChange(JSON.stringify([...assignments, { concept: chosenConcept, detail: clean }]));
    setDetail("");
  }

  return (
    <div className="paio-editor">
      <h3>Conceitos do Paiômetro</h3>
      <p>Associe uma carta ou combinação a um conceito. Ao salvar o deck, a associação é aprendida globalmente: outros decks com essa carta receberão a pontuação automaticamente. Cada conceito conta uma única vez por deck. Combos exigem todas as cartas da combinação. Shocklands, fetchlands, triomas e categorias por quantidade de tags são automáticos.</p>
      <div className="paio-editor-add">
        <label className="editor-field">
          <span>Conceito</span>
          <select value={concepts.includes(concept) ? concept : (concepts[0] ?? "")} onChange={(event) => setConcept(event.target.value)} disabled={disabled}>
            {concepts.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label className="editor-field">
          <span>Carta / combinação responsável</span>
          <input value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="Ex.: Time Warp ou combo A + B" maxLength={120} disabled={disabled} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} />
        </label>
        <button className="editor-secondary-button" type="button" onClick={add} disabled={disabled || detail.trim().length < 2 || assignments.length >= 30}>
          <Plus size={16} /> Adicionar
        </button>
      </div>
      {assignments.length ? (
        <div className="paio-editor-list">
          {assignments.map((entry, index) => (
            <div key={`${entry.concept}-${entry.detail}`} className="paio-editor-item">
              <span><strong>{entry.concept}</strong><small>{entry.detail}</small>{autoNames.has(normalizePaioKey(entry.concept)) ? <small className="paio-editor-legacy-note">Atribuição antiga: ignorada no cálculo automático. Pode remover.</small> : null}</span>
              <button type="button" aria-label={`Remover ${entry.detail} de ${entry.concept}`} disabled={disabled} onClick={() => onChange(JSON.stringify(assignments.filter((_, i) => i !== index)))}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      ) : <p className="paio-editor-empty">Nenhum conceito manual atribuído.</p>}
      <small>Novos vínculos são compartilhados globalmente quando o deck é salvo. Remover um vínculo desta lista não o apaga da base global — o admin pode removê-lo em Administração → Paiômetro.</small>
    </div>
  );
}
