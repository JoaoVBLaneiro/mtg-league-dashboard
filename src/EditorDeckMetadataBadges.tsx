import { useEffect, useState } from "react";
import DynamicDeckTagBadges from "./DynamicDeckTagBadges";
import { DeckLabels } from "./DeckLabels";
import { readDeckTags } from "./deckMetadata";
import {
  loadPlanarOrigins,
  PlanarOriginBadges,
  readPlanarOriginSlugs,
  type PlanarOriginDefinition,
} from "./PlanarOrigins";

type Props = {
  categories?: unknown;
  origins?: unknown;
  inactive?: boolean;
  deleted?: boolean;
};

/** Prévia das mesmas tags e origens selecionadas no editor (inclusive antes de salvar). */
export default function EditorDeckMetadataBadges({
  categories,
  origins,
  inactive = false,
  deleted = false,
}: Props) {
  const [definitions, setDefinitions] = useState<PlanarOriginDefinition[]>([]);

  useEffect(() => {
    let active = true;
    void loadPlanarOrigins()
      .then((loaded) => { if (active) setDefinitions(loaded); })
      .catch(() => { /* O seletor já sinaliza falhas na consulta de origens. */ });
    return () => { active = false; };
  }, []);

  const selectedSlugs = new Set(readPlanarOriginSlugs(origins));
  const selected = definitions.filter((item) => selectedSlugs.has(item.slug));

  return (
    <div className="editor-deck-heading-badges" aria-label="Tags e origens planares do deck">
      <DynamicDeckTagBadges categories={readDeckTags(categories)} />
      <DeckLabels inactive={inactive} deleted={deleted} />
      <PlanarOriginBadges origins={selected} compact />
    </div>
  );
}
