/** Usa somente URLs retornadas pelo Scryfall. Suporta WebP e os campos legados. */
export type ScryfallImages = {
  thumb?: string; grid?: string; display?: string; jpeg?: string;
  small?: string; normal?: string; large?: string;
};
export type ScryfallImageCard = {
  image_uris?: ScryfallImages;
  card_faces?: ReadonlyArray<{ image_uris?: ScryfallImages }>;
};

export function scryfallCardImage(card: ScryfallImageCard, size: "grid" | "display" | "thumb" = "grid"): string {
  const fields: Array<keyof ScryfallImages> = size === "thumb"
    ? ["thumb", "small", "grid", "jpeg", "normal", "display", "large"]
    : size === "display"
      ? ["display", "grid", "large", "jpeg", "normal", "thumb", "small"]
      : ["grid", "jpeg", "normal", "display", "large", "thumb", "small"];
  // Cartas de dupla face usam a frente; cartas split com imagem própria usam a imagem raiz.
  for (const images of [card.image_uris, card.card_faces?.[0]?.image_uris]) {
    for (const field of fields) {
      const url = images?.[field];
      if (url) return url;
    }
  }
  return "";
}
