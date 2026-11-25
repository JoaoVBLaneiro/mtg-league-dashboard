import { useEffect, useMemo, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { keyruneCode } from "./keyruneSymbols";
import "./planarOrigins.css";

const API_URL = "https://api.corneliomove.com.br/mtg-api/api/planar-origins";

export type PlanarOriginKind = "universe" | "origin";

export type PlanarOriginDefinition = {
  slug: string;
  label: string;
  keyruneClass: string;
  kind: PlanarOriginKind;
  displayOrder: number;
};

type PublicResponse = {
  ok?: boolean;
  error?: string;
  origins?: PlanarOriginDefinition[];
};

let cachedOrigins: PlanarOriginDefinition[] | null = null;
let pendingOrigins: Promise<PlanarOriginDefinition[]> | null = null;

export function rareKeyrune(value: string) {
  const code = keyruneCode(value);
  return code ? `ss ss-${code} ss-rare` : "ss ss-cmd ss-rare";
}

export function readPlanarOriginSlugs(value: unknown): string[] {
  let parsed = value;

  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  return [...new Set(
    parsed
      .map((item) => typeof item === "string" ? item.trim().toLowerCase() : "")
      .filter((item) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item)),
  )];
}

export function invalidatePlanarOriginsCache() {
  cachedOrigins = null;
  pendingOrigins = null;
}

export async function loadPlanarOrigins() {
  if (cachedOrigins) return cachedOrigins;
  if (pendingOrigins) return pendingOrigins;

  pendingOrigins = fetch(API_URL)
    .then(async (response) => {
      const json = await response.json() as PublicResponse;
      if (!response.ok || json.ok === false || json.error) {
        throw new Error(json.error || "Não foi possível carregar as origens planares.");
      }
      cachedOrigins = json.origins ?? [];
      return cachedOrigins;
    })
    .finally(() => {
      pendingOrigins = null;
    });

  return pendingOrigins;
}

export function PlanarOriginBadges({
  origins = [],
  compact = false,
  panel = false,
  onOriginClick,
}: {
  origins?: readonly PlanarOriginDefinition[];
  compact?: boolean;
  panel?: boolean;
  onOriginClick?: (origin: PlanarOriginDefinition) => void;
}) {
  if (!origins.length) return null;

  const ordered = [...origins].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "universe" ? -1 : 1;
    if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
    return a.label.localeCompare(b.label, "pt-BR");
  });

  const body = (
    <div className={`planar-origin-badges${compact ? " compact" : ""}`}>
      {ordered.map((origin) => {
        const content = (
          <>
            <i className={rareKeyrune(origin.keyruneClass)} aria-hidden="true" />
            <span>{origin.label}</span>
          </>
        );

        return onOriginClick ? (
          <button
            type="button"
            className={`planar-origin-badge planar-origin-${origin.kind} is-clickable`}
            key={origin.slug}
            title={`Ver decks de ${origin.label}`}
            aria-label={`Ver decks de ${origin.label}`}
            onClick={() => onOriginClick(origin)}
          >
            {content}
          </button>
        ) : (
          <span
            className={`planar-origin-badge planar-origin-${origin.kind}`}
            key={origin.slug}
            title={`${origin.kind === "universe" ? "Universo" : "Plano / origem"}: ${origin.label}`}
            aria-label={origin.label}
          >
            {content}
          </span>
        );
      })}
    </div>
  );

  if (!panel) return body;

  return (
    <aside className="deck-planar-origin-panel" aria-label="Origens planares do deck">
      {body}
    </aside>
  );
}

export function PlanarOriginSelector({
  value,
  disabled = false,
  onChange,
}: {
  value: unknown;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [origins, setOrigins] = useState<PlanarOriginDefinition[]>(cachedOrigins ?? []);
  const [loading, setLoading] = useState(!cachedOrigins);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(!cachedOrigins);

    void loadPlanarOrigins()
      .then((loaded) => {
        if (active) setOrigins(loaded);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Falha ao carregar origens planares.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selected = useMemo(() => readPlanarOriginSlugs(value), [value]);
  const universes = origins.filter((origin) => origin.kind === "universe");
  const specificOrigins = origins.filter((origin) => origin.kind === "origin");

  function toggleUniverse(slug: string) {
    const activeUniverseCount = universes.filter((origin) => selected.includes(origin.slug)).length;
    const alreadySelected = selected.includes(slug);

    // Mantém pelo menos uma classificação de universo no deck.
    if (alreadySelected && activeUniverseCount <= 1) return;

    const next = alreadySelected
      ? selected.filter((item) => item !== slug)
      : [slug, ...selected];

    onChange(JSON.stringify([...new Set(next)]));
  }

  function toggleOrigin(slug: string) {
    const next = selected.includes(slug)
      ? selected.filter((item) => item !== slug)
      : [...selected, slug];
    onChange(JSON.stringify(next));
  }

  return (
    <div className="editor-planar-origin-selector">
      <div className="editor-section-heading editor-planar-origin-title">
        <div>
          <h3>Origem Planar</h3>
          <p>Marque um ou mais universos e quantos planos/franquias forem necessários. Magic The Gathering e Universes Beyond podem coexistir. Todos os símbolos usam acabamento Raro.</p>
        </div>
        {loading ? <LoaderCircle size={18} className="spin" /> : null}
      </div>

      {error ? <p className="editor-field-hint editor-planar-origin-error">{error}</p> : null}

      <div className="editor-planar-origin-group">
        <strong>Universos</strong>
        <div className="editor-planar-origin-choices">
          {universes.map((origin) => {
            const active = selected.includes(origin.slug);
            return (
              <button
                type="button"
                key={origin.slug}
                className={`editor-planar-origin-choice universe${active ? " selected" : ""}`}
                aria-pressed={active}
                disabled={disabled}
                onClick={() => toggleUniverse(origin.slug)}
              >
                <i className={rareKeyrune(origin.keyruneClass)} aria-hidden="true" />
                <span>{origin.label}</span>
                {active ? <Check size={15} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="editor-planar-origin-group">
        <strong>Planos / franquias</strong>
        {specificOrigins.length ? (
          <div className="editor-planar-origin-choices">
            {specificOrigins.map((origin) => {
              const active = selected.includes(origin.slug);
              return (
                <button
                  type="button"
                  key={origin.slug}
                  className={`editor-planar-origin-choice${active ? " selected" : ""}`}
                  aria-pressed={active}
                  disabled={disabled}
                  onClick={() => toggleOrigin(origin.slug)}
                >
                  <i className={rareKeyrune(origin.keyruneClass)} aria-hidden="true" />
                  <span>{origin.label}</span>
                  {active ? <Check size={15} aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="editor-field-hint">Nenhum plano/franquia adicional foi cadastrado ainda.</p>
        )}
      </div>
    </div>
  );
}
