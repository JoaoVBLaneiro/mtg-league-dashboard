import {
  useEffect,
  useState,
} from "react";

import {
  DeckLabels,
} from "./DeckLabels";

import type {
  DeckCategory,
} from "./deckMetadata";


const API_URL =
  "https://api.corneliomove.com.br/mtg-api/api/deck-tags";


export type SystemDeckTag =
  | "aggro"
  | "combo"
  | "tribal"
  | "universes-beyond"
  | "marvel";


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
  onSystemCategoryClick?: (
    category: SystemDeckTag,
  ) => void;
};


const SYSTEM_TAGS =
  new Set<string>([
    "aggro",
    "combo",
    "tribal",
    "universes-beyond",
    "marvel",
  ]);


const FALLBACK: TagDefinition[] = [
  "aggro",
  "combo",
  "tribal",
  "universes-beyond",
  "marvel",
].map(
  (slug, index) => ({
    slug,
    label:
      slug === "universes-beyond"
        ? "Universes Beyond"
        : slug[0]!.toUpperCase()
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
  onSystemCategoryClick,
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


  const legacy =
    visible.filter(
      (tag) =>
        tag.appearanceMode
        === "legacy"
        &&
        SYSTEM_TAGS.has(
          tag.slug,
        ),
    );


  const custom =
    visible.filter(
      (tag) =>
        !legacy.includes(
          tag,
        ),
    );


  return (
    <>
      {legacy.length ? (
        <DeckLabels
          categories={
            legacy.map(
              (tag) =>
                (tag.slug as DeckCategory),
            )
          }
          compact={compact}
          onCategoryClick={
            onSystemCategoryClick
              ? (category) =>
                  onSystemCategoryClick(
                    category as SystemDeckTag,
                  )
              : undefined
          }
        />
      ) : null}


      {custom.length ? (
        <div
          className={
            `dynamic-deck-tags${
              compact
                ? " compact"
                : ""
            }`
          }
        >
          {custom.map(
            (tag) => {
              const style = {
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

              const body = (
                <>
                  <i
                    className={
                      tag.keyruneClass
                      || "ss ss-cmd"
                    }
                  />
                  <span>
                    {tag.label}
                  </span>
                </>
              );

              if (
                onSystemCategoryClick
                &&
                SYSTEM_TAGS.has(
                  tag.slug,
                )
              ) {
                return (
                  <button
                    type="button"
                    key={tag.slug}
                    className="dynamic-deck-tag"
                    style={style}
                    onClick={() =>
                      onSystemCategoryClick(
                        (tag.slug as SystemDeckTag),
                      )
                    }
                  >
                    {body}
                  </button>
                );
              }

              return (
                <span
                  key={tag.slug}
                  className="dynamic-deck-tag"
                  style={style}
                >
                  {body}
                </span>
              );
            },
          )}
        </div>
      ) : null}
    </>
  );
}
