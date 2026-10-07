import {
  useEffect,
  useState,
} from "react";

import {
  DeckCategoryIcon,
} from "./DeckLabels";

import type {
  DeckCategory,
} from "./deckMetadata";

import {
  keyruneCode,
} from "./keyruneSymbols";


const API_URL =
  "https://api.corneliomove.com.br/mtg-api/api/deck-tags";


export type DeckTagSelection = {
  slug: string;
  label: string;
  keyruneClass: string;
  color: string;
  isLegacy: boolean;
};


type AppearanceMode =
  | "legacy"
  | "custom";


type TagDefinition = {
  slug: string;
  label: string;
  keyruneClass: string;
  color: string;
  displayOrder: number;
  appearanceMode: AppearanceMode;
};


type Props = {
  categories?: readonly string[];
  compact?: boolean;
  onTagClick?: (
    tag: DeckTagSelection,
  ) => void;
};


const SYSTEM_TAGS =
  new Set<string>([
    "aggro",
    "combo",
    "tribal",
  ]);


const FALLBACK: TagDefinition[] = [
  "aggro",
  "combo",
  "tribal",
].map(
  (slug, index) => ({
    slug,
    label:
      slug[0]!.toUpperCase()
      + slug.slice(1),
    keyruneClass:
      "ss ss-cmd",
    color:
      "#8b5cf6",
    displayOrder:
      (index + 1) * 10,
    appearanceMode:
      "legacy" as const,
  }),
);


let cached:
  TagDefinition[] | null = null;

let pending:
  Promise<TagDefinition[]> | null = null;


async function loadDefinitions() {
  if (cached) {
    return cached;
  }

  if (pending) {
    return pending;
  }

  pending =
    fetch(API_URL)
      .then(
        async (response) => {
          if (!response.ok) {
            throw new Error(
              "Falha ao carregar tags.",
            );
          }

          const json =
            await response.json() as {
              ok?: boolean;
              tags?: TagDefinition[];
            };

          cached =
            json.tags
            ?? FALLBACK;

          return cached;
        },
      )
      .catch(
        () => {
          cached =
            FALLBACK;

          return cached;
        },
      )
      .finally(
        () => {
          pending = null;
        },
      );

  return pending;
}


function plainTagKeyrune(
  value: string,
) {
  const code =
    keyruneCode(value);

  return code
    ? `ss ss-${code}`
    : "ss ss-cmd";
}


function alpha(
  color: string,
  suffix: string,
) {
  return /^#[0-9a-f]{6}$/i.test(
    color,
  )
    ? `${color}${suffix}`
    : color;
}


export default function DynamicDeckTagBadges({
  categories = [],
  compact = false,
  onTagClick,
}: Props) {
  const [
    definitions,
    setDefinitions,
  ] = useState<
    TagDefinition[]
  >(
    cached
    ?? FALLBACK,
  );


  useEffect(
    () => {
      let active = true;

      void loadDefinitions()
        .then(
          (loaded) => {
            if (active) {
              setDefinitions(
                loaded,
              );
            }
          },
        );

      return () => {
        active = false;
      };
    },
    [],
  );


  if (!categories.length) {
    return null;
  }


  const bySlug =
    new Map(
      definitions.map(
        (tag) => [
          tag.slug,
          tag,
        ],
      ),
    );


  const visible =
    [
      ...new Set(
        categories,
      ),
    ]
      .map(
        (slug) =>
          bySlug.get(slug)
          ?? {
            slug,
            label:
              slug
                .split("-")
                .map(
                  (part) =>
                    part
                      ? part[0]!
                          .toUpperCase()
                        + part.slice(1)
                      : part,
                )
                .join(" "),
            keyruneClass:
              "ss ss-cmd",
            color:
              "#8b5cf6",
            displayOrder:
              9999,
            appearanceMode:
              "custom" as const,
          },
      )
      .sort(
        (a, b) =>
          a.displayOrder
          - b.displayOrder
          ||
          a.label.localeCompare(
            b.label,
            "pt-BR",
          ),
      );


  return (
    <span
      className={
        `mtg-deck-labels${
          compact
            ? " mtg-deck-labels-compact"
            : ""
        }`
      }
    >
      {visible.map(
        (tag) => {
          const isLegacy =
            tag.appearanceMode
            === "legacy"
            &&
            SYSTEM_TAGS.has(
              tag.slug,
            );

          const legacyCategory =
            isLegacy
              ? (tag.slug as DeckCategory)
              : null;

          const keyruneClass =
            plainTagKeyrune(
              tag.keyruneClass,
            );

          const selection:
            DeckTagSelection = {
              slug:
                tag.slug,
              label:
                tag.label,
              keyruneClass,
              color:
                tag.color,
              isLegacy,
            };

          const className =
            isLegacy
              ? `mtg-deck-label mtg-deck-category-button mtg-deck-category-${tag.slug}`
              : "mtg-deck-label mtg-deck-category-button";

          const customStyle =
            isLegacy
              ? undefined
              : {
                  color:
                    tag.color,
                  borderColor:
                    alpha(
                      tag.color,
                      "80",
                    ),
                  backgroundColor:
                    alpha(
                      tag.color,
                      "18",
                    ),
                };

          const icon =
            legacyCategory
              ? (
                  <DeckCategoryIcon
                    category={
                      legacyCategory
                    }
                    size={20}
                  />
                )
              : (
                  <i
                    className={
                      `${keyruneClass} mtg-deck-set-symbol`
                    }
                    style={{
                      fontSize:
                        20,
                      color:
                        tag.color,
                    }}
                    aria-hidden="true"
                  />
                );

          if (onTagClick) {
            return (
              <button
                type="button"
                className={
                  className
                }
                key={tag.slug}
                style={
                  customStyle
                }
                data-tooltip={
                  tag.label
                }
                title={
                  tag.label
                }
                aria-label={
                  `Ver decks da tag ${tag.label}`
                }
                onClick={
                  (event) => {
                    event.stopPropagation();
                    onTagClick(
                      selection,
                    );
                  }
                }
              >
                {icon}
                {!compact ? (
                  <span>
                    {tag.label}
                  </span>
                ) : null}
              </button>
            );
          }

          return (
            <span
              className={
                className
              }
              key={tag.slug}
              style={
                customStyle
              }
              title={
                tag.label
              }
              aria-label={
                tag.label
              }
            >
              {icon}
              {!compact ? (
                <span>
                  {tag.label}
                </span>
              ) : null}
            </span>
          );
        },
      )}
    </span>
  );
}
