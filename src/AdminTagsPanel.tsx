import { useEffect, useMemo, useState } from "react";
import {
  LoaderCircle,
  Plus,
  Save,
} from "lucide-react";

import KeyrunePicker from "./KeyrunePicker";
import type { KeyruneUsage } from "./keyruneSymbols";


const API_BASE_URL =
  "https://api.corneliomove.com.br/mtg-api";


type AdminDeckTag = {
  slug: string;
  label: string;
  keyruneClass: string;
  color: string;
  displayOrder: number;
  isActive: boolean;
  isSystem: boolean;
  deckCount: number;
};


type AdminTagDeck = {
  id: number;
  name: string;
  active: boolean;
  tags: string[];
};


type AdminTagsResponse = {
  ok?: boolean;
  error?: string;
  tags?: AdminDeckTag[];
  decks?: AdminTagDeck[];
};


type TagDraft = {
  slug: string;
  label: string;
  keyruneClass: string;
  color: string;
  displayOrder: number;
  isActive: boolean;
  isSystem: boolean;
  deckIds: number[];
};


type Props = {
  token: string;
  playerId: string;
  usage?: KeyruneUsage[];
  disabled?: boolean;
  onNotice?: (
    kind: "success" | "error" | "info",
    text: string,
  ) => void;
};


function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}


async function jsonResponse(
  response: Response,
) {
  const json =
    await response.json() as {
      ok?: boolean;
      error?: string;
      slug?: string;
    };

  if (
    !response.ok
    || json.ok === false
    || json.error
  ) {
    throw new Error(
      json.error
      || "Não foi possível concluir a solicitação.",
    );
  }

  return json;
}


async function requestAdminTags(
  token: string,
) {
  const response =
    await fetch(
      `${API_BASE_URL}/api/admin/tags`,
      {
        headers:
          authHeaders(token),
      },
    );

  const json =
    (await response.json()) as AdminTagsResponse;

  if (
    !response.ok
    || json.ok === false
    || json.error
  ) {
    throw new Error(
      json.error
      || "Não foi possível carregar as tags.",
    );
  }

  return {
    tags:
      json.tags
      ?? [],
    decks:
      json.decks
      ?? [],
  };
}


async function writeTag(
  token: string,
  draft: TagDraft,
) {
  const creating =
    !draft.slug;

  const response =
    await fetch(
      creating
        ? `${API_BASE_URL}/api/admin/tags`
        : `${API_BASE_URL}/api/admin/tags/${encodeURIComponent(draft.slug)}`,
      {
        method:
          creating
            ? "POST"
            : "PUT",
        headers: {
          "Content-Type":
            "application/json",
          ...authHeaders(token),
        },
        body:
          JSON.stringify({
            label:
              draft.label,
            keyruneClass:
              draft.keyruneClass,
            color:
              draft.color,
            displayOrder:
              draft.displayOrder,
            isActive:
              draft.isActive,
          }),
      },
    );

  const json =
    await jsonResponse(
      response,
    );

  return String(
    json.slug
    || draft.slug,
  );
}


async function writeAssignments(
  token: string,
  slug: string,
  deckIds: number[],
) {
  const response =
    await fetch(
      `${API_BASE_URL}/api/admin/tags/${encodeURIComponent(slug)}/assignments`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          ...authHeaders(token),
        },
        body:
          JSON.stringify({
            deckIds,
          }),
      },
    );

  await jsonResponse(
    response,
  );
}


function emptyDraft(): TagDraft {
  return {
    slug: "",
    label: "",
    keyruneClass:
      "ss ss-cmd",
    color:
      "#8b5cf6",
    displayOrder:
      100,
    isActive:
      true,
    isSystem:
      false,
    deckIds: [],
  };
}


export default function AdminTagsPanel({
  token,
  playerId,
  usage,
  disabled = false,
  onNotice,
}: Props) {
  const [
    tags,
    setTags,
  ] = useState<
    AdminDeckTag[]
  >([]);

  const [
    decks,
    setDecks,
  ] = useState<
    AdminTagDeck[]
  >([]);

  const [
    draft,
    setDraft,
  ] = useState<
    TagDraft | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);


  const selectedSlug =
    draft?.slug
    ?? "";


  const selectedTag =
    useMemo(
      () =>
        tags.find(
          (tag) =>
            tag.slug
            === selectedSlug,
        )
        ?? null,
      [
        tags,
        selectedSlug,
      ],
    );


  function draftFromTag(
    tag: AdminDeckTag,
    availableDecks =
      decks,
  ): TagDraft {
    return {
      slug:
        tag.slug,
      label:
        tag.label,
      keyruneClass:
        tag.keyruneClass,
      color:
        tag.color,
      displayOrder:
        tag.displayOrder,
      isActive:
        tag.isActive,
      isSystem:
        tag.isSystem,
      deckIds:
        availableDecks
          .filter(
            (deck) =>
              deck.tags.includes(
                tag.slug,
              ),
          )
          .map(
            (deck) =>
              deck.id,
          ),
    };
  }


  async function load(
    preserveSelection = true,
  ) {
    try {
      setLoading(true);

      const result =
        await requestAdminTags(
          token,
        );

      setTags(
        result.tags,
      );

      setDecks(
        result.decks,
      );

      if (
        preserveSelection
        && draft?.slug
      ) {
        const refreshed =
          result.tags.find(
            (tag) =>
              tag.slug
              === draft.slug,
          );

        if (refreshed) {
          setDraft(
            draftFromTag(
              refreshed,
              result.decks,
            ),
          );
        }
      }

    } catch (error) {
      onNotice?.(
        "error",
        error instanceof Error
          ? error.message
          : "Erro ao carregar tags.",
      );

    } finally {
      setLoading(false);
    }
  }


  useEffect(
    () => {
      void load(false);
    },
    // Carrega apenas quando o painel entra na árvore.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );


  function selectTag(
    tag: AdminDeckTag,
  ) {
    setDraft(
      draftFromTag(tag),
    );
  }


  function toggleDeck(
    deckId: number,
    checked: boolean,
  ) {
    setDraft(
      (current) => {
        if (!current) {
          return current;
        }

        const next =
          checked
            ? [
                ...current.deckIds,
                deckId,
              ]
            : current.deckIds.filter(
                (id) =>
                  id !== deckId,
              );

        return {
          ...current,
          deckIds:
            Array.from(
              new Set(next),
            ),
        };
      },
    );
  }


  async function save() {
    if (
      !draft
      || saving
      || disabled
    ) {
      return;
    }

    if (
      !draft.label.trim()
    ) {
      onNotice?.(
        "error",
        "Informe o nome da tag.",
      );

      return;
    }

    try {
      setSaving(true);

      const wasNew =
        !draft.slug;

      const slug =
        await writeTag(
          token,
          draft,
        );

      await writeAssignments(
        token,
        slug,
        draft.deckIds,
      );

      setDraft(
        {
          ...draft,
          slug,
        },
      );

      await load(true);

      onNotice?.(
        "success",
        wasNew
          ? `Tag ${draft.label} criada.`
          : `Tag ${draft.label} atualizada.`,
      );

    } catch (error) {
      onNotice?.(
        "error",
        error instanceof Error
          ? error.message
          : "Erro ao salvar a tag.",
      );

    } finally {
      setSaving(false);
    }
  }


  return (
    <>
      <div className="editor-page-heading">
        <div>
          <span>
            Administração JBL
          </span>

          <h1>
            Tags de decks
          </h1>

          <p>
            Crie tags, altere ícone e cor e escolha quais decks recebem cada uma.
          </p>
        </div>

        <button
          className="editor-primary-button"
          type="button"
          disabled={
            disabled
            || saving
          }
          onClick={() =>
            setDraft(
              emptyDraft(),
            )
          }
        >
          <Plus size={17} />
          Criar tag
        </button>
      </div>


      <div className="editor-admin-tags-layout">
        <div className="editor-admin-tags-list">
          <div className="editor-admin-tags-list-heading">
            <strong>
              Tags existentes
            </strong>

            <button
              type="button"
              className="editor-secondary-button"
              disabled={
                disabled
                || loading
                || saving
              }
              onClick={() =>
                void load(true)
              }
            >
              {loading ? (
                <LoaderCircle
                  size={16}
                  className="spin"
                />
              ) : null}
              Atualizar
            </button>
          </div>


          {tags.map(
            (tag) => (
              <button
                type="button"
                key={tag.slug}
                className={
                  `editor-admin-tag-card${
                    selectedTag?.slug
                    === tag.slug
                      ? " selected"
                      : ""
                  }`
                }
                onClick={() =>
                  selectTag(tag)
                }
              >
                <span
                  className="editor-admin-tag-icon"
                  style={{
                    color:
                      tag.color,
                    borderColor:
                      tag.color,
                    backgroundColor:
                      `${tag.color}18`,
                  }}
                >
                  <i
                    className={
                      tag.keyruneClass
                      || "ss ss-cmd"
                    }
                  />
                </span>

                <span className="editor-admin-tag-card-copy">
                  <strong>
                    {tag.label}
                  </strong>

                  <small>
                    {tag.deckCount}{" "}
                    {
                      tag.deckCount
                      === 1
                        ? "deck"
                        : "decks"
                    }
                    {
                      tag.isSystem
                        ? " · sistema"
                        : ""
                    }
                    {
                      !tag.isActive
                        ? " · inativa"
                        : ""
                    }
                  </small>
                </span>
              </button>
            ),
          )}
        </div>


        <div className="editor-admin-tag-editor">
          {!draft ? (
            <div className="editor-form-section">
              <div className="editor-section-heading">
                <h2>
                  Selecione uma tag
                </h2>

                <p>
                  Escolha uma tag existente ou clique em Criar tag.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="editor-form-section">
                <div className="editor-section-heading">
                  <h2>
                    {
                      draft.slug
                        ? "Editar tag"
                        : "Nova tag"
                    }
                  </h2>

                  <p>
                    {
                      draft.isSystem
                        ? "Tag de sistema: o identificador e a ativação são protegidos porque conquistas dependem dela."
                        : "O identificador é criado automaticamente a partir do nome e não muda depois."
                    }
                  </p>
                </div>


                <div className="editor-admin-tag-preview">
                  <span
                    className="editor-admin-tag-preview-badge"
                    style={{
                      color:
                        draft.color,
                      borderColor:
                        draft.color,
                      backgroundColor:
                        `${draft.color}18`,
                    }}
                  >
                    <i
                      className={
                        draft.keyruneClass
                        || "ss ss-cmd"
                      }
                    />

                    {
                      draft.label
                      || "Nova tag"
                    }
                  </span>
                </div>


                <div className="editor-admin-tags-fields">
                  <label className="editor-field">
                    <span>
                      Nome da tag
                    </span>

                    <input
                      type="text"
                      value={draft.label}
                      disabled={
                        disabled
                        || saving
                      }
                      placeholder="Ex.: Controle"
                      onChange={(event) =>
                        setDraft(
                          (current) =>
                            current
                              ? {
                                  ...current,
                                  label:
                                    event.target.value,
                                }
                              : current,
                        )
                      }
                    />
                  </label>


                  <label className="editor-field">
                    <span>
                      Identificador
                    </span>

                    <input
                      type="text"
                      value={
                        draft.slug
                        || "gerado ao salvar"
                      }
                      readOnly
                    />
                  </label>


                  <label className="editor-field">
                    <span>
                      Cor
                    </span>

                    <div className="editor-admin-color-field">
                      <input
                        type="color"
                        value={draft.color}
                        disabled={
                          disabled
                          || saving
                        }
                        onChange={(event) =>
                          setDraft(
                            (current) =>
                              current
                                ? {
                                    ...current,
                                    color:
                                      event.target.value,
                                  }
                                : current,
                          )
                        }
                      />

                      <input
                        type="text"
                        value={draft.color}
                        disabled={
                          disabled
                          || saving
                        }
                        onChange={(event) =>
                          setDraft(
                            (current) =>
                              current
                                ? {
                                    ...current,
                                    color:
                                      event.target.value,
                                  }
                                : current,
                          )
                        }
                      />
                    </div>
                  </label>


                  <label className="editor-field">
                    <span>
                      Ordem de exibição
                    </span>

                    <input
                      type="number"
                      min={0}
                      max={9999}
                      value={
                        draft.displayOrder
                      }
                      disabled={
                        disabled
                        || saving
                      }
                      onChange={(event) =>
                        setDraft(
                          (current) =>
                            current
                              ? {
                                  ...current,
                                  displayOrder:
                                    Number(
                                      event.target.value,
                                    )
                                    || 0,
                                }
                              : current,
                        )
                      }
                    />
                  </label>


                  <KeyrunePicker
                    label="Ícone da tag"
                    value={
                      draft.keyruneClass
                    }
                    usage={usage}
                    playerId={playerId}
                    disabled={
                      disabled
                      || saving
                    }
                    onChange={(value) =>
                      setDraft(
                        (current) =>
                          current
                            ? {
                                ...current,
                                keyruneClass:
                                  value,
                              }
                            : current,
                      )
                    }
                  />
                </div>


                {!draft.isSystem ? (
                  <label className="editor-admin-tag-active">
                    <input
                      type="checkbox"
                      checked={
                        draft.isActive
                      }
                      disabled={
                        disabled
                        || saving
                      }
                      onChange={(event) =>
                        setDraft(
                          (current) =>
                            current
                              ? {
                                  ...current,
                                  isActive:
                                    event.target.checked,
                                }
                              : current,
                        )
                      }
                    />
                    Tag ativa
                  </label>
                ) : null}
              </div>


              <div className="editor-form-section">
                <div className="editor-section-heading">
                  <h2>
                    Decks com esta tag
                  </h2>

                  <p>
                    Pode marcar qualquer deck cadastrado, inclusive decks inativos.
                  </p>
                </div>


                <div className="editor-admin-tag-decks">
                  {decks.map(
                    (deck) => {
                      const checked =
                        draft.deckIds.includes(
                          deck.id,
                        );

                      return (
                        <label
                          className={
                            `editor-admin-tag-deck${
                              checked
                                ? " selected"
                                : ""
                            }`
                          }
                          key={deck.id}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={
                              disabled
                              || saving
                            }
                            onChange={(event) =>
                              toggleDeck(
                                deck.id,
                                event.target.checked,
                              )
                            }
                          />

                          <span>
                            <strong>
                              {deck.name}
                            </strong>

                            {!deck.active ? (
                              <small>
                                Inativo
                              </small>
                            ) : null}
                          </span>
                        </label>
                      );
                    },
                  )}
                </div>
              </div>


              <div className="editor-form-actions">
                <button
                  type="button"
                  className="editor-primary-button"
                  disabled={
                    disabled
                    || saving
                  }
                  onClick={() =>
                    void save()
                  }
                >
                  {saving ? (
                    <LoaderCircle
                      size={17}
                      className="spin"
                    />
                  ) : (
                    <Save size={17} />
                  )}

                  {
                    draft.slug
                      ? "Salvar tag"
                      : "Criar tag"
                  }
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
