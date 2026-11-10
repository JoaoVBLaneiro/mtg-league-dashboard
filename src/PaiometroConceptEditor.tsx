import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PAIO_CONCEPTS, parsePaioAssignments } from "./paiometroDeck";
import "./paiometroDeck.css";

type Props = {
  value: string | number | null | undefined;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export default function PaiometroConceptEditor({ value, onChange, disabled }: Props) {
  const [concept, setConcept] = useState<string>(PAIO_CONCEPTS[0]);
  const [detail, setDetail] = useState("");
  const assignments = parsePaioAssignments(value);

  function add() {
    const clean = detail.trim().replace(/\s+/g, " ");
    if (clean.length < 2 || clean.length > 120 || assignments.length >= 30) return;
    if (assignments.some((item) => item.concept === concept && item.detail.toLowerCase() === clean.toLowerCase())) return;
    onChange(JSON.stringify([...assignments, { concept, detail: clean }]));
    setDetail("");
  }

  return (
    <div className="paio-editor">
      <h3>Conceitos do Paiômetro</h3>
      <p>Associe manualmente uma carta ou combinação a cada conceito. Use o nome exato da carta; para um combo, escreva Carta A + Carta B. As artes serão mostradas no modal do Paiômetro. Cada atribuição soma os pontos do conceito uma única vez, além das cartas identificadas automaticamente na decklist.</p>
      <div className="paio-editor-add">
        <label className="editor-field">
          <span>Conceito</span>
          <select value={concept} onChange={(event) => setConcept(event.target.value)} disabled={disabled}>
            {PAIO_CONCEPTS.map((option) => <option key={option} value={option}>{option}</option>)}
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
              <span><strong>{entry.concept}</strong><small>{entry.detail}</small></span>
              <button type="button" aria-label={`Remover ${entry.detail} de ${entry.concept}`} disabled={disabled} onClick={() => onChange(JSON.stringify(assignments.filter((_, i) => i !== index)))}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      ) : <p className="paio-editor-empty">Nenhum conceito manual atribuído.</p>}
      <small>Salve o deck para aplicar. Use uma associação por carta ou combo; não cadastre a mesma ocorrência duas vezes.</small>
    </div>
  );
}
