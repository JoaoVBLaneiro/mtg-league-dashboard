export function normalizeDeckName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function deckNameKey(name: string) {
  return normalizeDeckName(name).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function getNewDeckNameError(name: string, existingNames: string[]) {
  if (Array.from(name).some((character) => character === "," || character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
    return "Use um nome sem vírgulas ou quebras de linha.";
  }
  const cleanName = normalizeDeckName(name);
  if (cleanName.length < 2 || cleanName.length > 80) {
    return "O nome deve ter entre 2 e 80 caracteres.";
  }
  const reserved = Object.getOwnPropertyNames(Object.prototype)
    .concat("prototype").map((value) => value.toLowerCase());
  if (/^[=+@\-']/.test(cleanName) || reserved.includes(cleanName.toLowerCase())) {
    return "Escolha outro nome, sem prefixos de fórmula.";
  }
  if (existingNames.some((value) => deckNameKey(value) === deckNameKey(cleanName))) {
    return "Esse nome já está cadastrado. Acrescente seu nome ou um apelido ao deck.";
  }
  return "";
}
