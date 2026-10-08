import { useEffect, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { DeckCategoryIcon } from "./DeckLabels";
import { readDeckTags } from "./deckMetadata";
import { keyruneCode } from "./keyruneSymbols";

const API_URL = "https://api.corneliomove.com.br/mtg-api/api/deck-tags";

export type DeckTagDefinition = {
  slug: string;
  label: string;
  keyruneClass: string;
  color: string;
  displayOrder: number;
  appearanceMode: "legacy" | "custom";
};

function plainKeyrune(value: string) {
  const code = keyruneCode(value);
  return code ? `ss ss-${code}` : "ss ss-cmd";
}

export default function DeckTagSelector({
  value,
  disabled = false,
  onChange,
}: {
  value: unknown;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [tags, setTags] = useState<DeckTagDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    void fetch(`${API_URL}?t=${Date.now()}`)
      .then(async (response) => {
        const json = await response.json() as {
          ok?: boolean;
          error?: string;
          tags?: DeckTagDefinition[];
        };

        if (!response.ok || json.ok === false || json.error) {
          throw new Error(json.error || "Não foi possível carregar as tags.");
        }

        if (active) setTags(json.tags ?? []);
      })
      .catch((reason) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Não foi possível carregar as tags.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selected = readDeckTags(value);

  function toggle(slug: string) {
    const next = selected.includes(slug)
      ? selected.filter((item) => item !== slug)
      : [...selected, slug];

    onChange(JSON.stringify(next));
  }

  return (
    <div className="editor-dynamic-tag-selector">
      <div className="editor-dynamic-tag-heading">
        <strong>Tags do deck</strong>
        {loading ? <LoaderCircle size={16} className="spin" /> : null}
      </div>

      {error ? <p className="editor-field-hint editor-dynamic-tag-error">{error}</p> : null}

      <div className="editor-category-choices" role="group" aria-label="Tags do deck">
        {tags.map((tag) => {
          const active = selected.includes(tag.slug);
          const legacy = tag.appearanceMode === "legacy" && ["aggro", "combo", "tribal"].includes(tag.slug);

          return (
            <button
              type="button"
              key={tag.slug}
              aria-pressed={active}
              disabled={disabled}
              className={`editor-category-choice${legacy ? ` mtg-deck-category-${tag.slug}` : " editor-dynamic-tag-choice"}${active ? " selected" : ""}`}
              style={!legacy ? ({
                "--deck-tag-color": tag.color,
              } as React.CSSProperties) : undefined}
              onClick={() => toggle(tag.slug)}
            >
              {legacy ? (
                <DeckCategoryIcon category={tag.slug as "aggro" | "combo" | "tribal"} size={20} />
              ) : (
                <i className={plainKeyrune(tag.keyruneClass)} aria-hidden="true" />
              )}
              <span>{tag.label}</span>
              {active ? <Check size={15} aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>

      {!loading && !error && !tags.length ? (
        <p className="editor-field-hint">Nenhuma tag ativa cadastrada.</p>
      ) : null}
    </div>
  );
}
