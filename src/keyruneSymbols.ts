export type KeyruneSymbol = { code: string; name: string };
export type KeyruneUsage = { playerId: string; displayName: string; keyruneClass: string };
const modifiers = new Set(['common', 'uncommon', 'rare', 'mythic', 'grad', 'foil', 'fw', 'duo', 'border', '2x', '3x', '4x', '5x']);

export function keyruneCode(value: string) {
  return value.split(/\s+/).find(part => /^ss-[a-z0-9]{1,16}$/.test(part) && !modifiers.has(part.slice(3)))?.slice(3) || '';
}

export function mythicKeyrune(value: string) {
  const code = keyruneCode(value);
  return code ? `ss ss-${code} ss-mythic ss-grad` : '';
}

export function symbolUsers(code: string, usage: KeyruneUsage[]) {
  return usage.filter(player => keyruneCode(player.keyruneClass) === code);
}

// Nomes de sets para leitura e busca. O CSS Keyrune completa outros símbolos.
export const KEYRUNE_SYMBOLS: KeyruneSymbol[] = `
lea|Alpha
leb|Beta
2ed|Unlimited
3ed|Revised
4ed|Fourth Edition
5ed|Fifth Edition
6ed|Sixth Edition
7ed|Seventh Edition
8ed|Eighth Edition
9ed|Ninth Edition
10e|Tenth Edition
m10|Magic 2010
m11|Magic 2011
m12|Magic 2012
m13|Magic 2013
m14|Magic 2014
m15|Magic 2015
ori|Magic Origins
m19|Core Set 2019
m20|Core Set 2020
m21|Core Set 2021
afr|Adventures in the Forgotten Realms
fdn|Foundations
arn|Arabian Nights
atq|Antiquities
leg|Legends
drk|The Dark
fem|Fallen Empires
hml|Homelands
ice|Ice Age
all|Alliances
csp|Coldsnap
mir|Mirage
vis|Visions
wth|Weatherlight
tmp|Tempest
sth|Stronghold
exo|Exodus
usg|Urza’s Saga
ulg|Urza’s Legacy
uds|Urza’s Destiny
mmq|Mercadian Masques
nem|Nemesis
pcy|Prophecy
inv|Invasion
pls|Planeshift
apc|Apocalypse
ody|Odyssey
tor|Torment
jud|Judgment
ons|Onslaught
lgn|Legions
scg|Scourge
mrd|Mirrodin
dst|Darksteel
5dn|Fifth Dawn
chk|Champions of Kamigawa
bok|Betrayers of Kamigawa
sok|Saviors of Kamigawa
rav|Ravnica
gpt|Guildpact
dis|Dissension
tsp|Time Spiral
plc|Planar Chaos
fut|Future Sight
lrw|Lorwyn
mor|Morningtide
shm|Shadowmoor
eve|Eventide
ala|Shards of Alara
con|Conflux
arb|Alara Reborn
zen|Zendikar
wwk|Worldwake
roe|Rise of the Eldrazi
som|Scars of Mirrodin
mbs|Mirrodin Besieged
nph|New Phyrexia
isd|Innistrad
dka|Dark Ascension
avr|Avacyn Restored
rtr|Return to Ravnica
gtc|Gatecrash
dgm|Dragon’s Maze
ths|Theros
bng|Born of the Gods
jou|Journey into Nyx
ktk|Khans of Tarkir
frf|Fate Reforged
dtk|Dragons of Tarkir
bfz|Battle for Zendikar
ogw|Oath of the Gatewatch
soi|Shadows Over Innistrad
emn|Eldritch Moon
kld|Kaladesh
aer|Aether Revolt
akh|Amonkhet
hou|Hour of Devastation
xln|Ixalan
rix|Rivals of Ixalan
dom|Dominaria
grn|Guilds of Ravnica
rna|Ravnica Allegiance
war|War of the Spark
eld|Throne of Eldraine
thb|Theros Beyond Death
iko|Ikoria: Lair of Behemoths
znr|Zendikar Rising
khm|Kaldheim
stx|Strixhaven
mid|Innistrad Midnight Hunt
vow|Innistrad Crimson Vow
neo|Kamigawa Neon Dynasty
snc|Streets of New Capenna
dmu|Dominaria United
bro|The Brothers’ War
one|Phyrexia All Will Be One
mom|March of the Machine
mat|March of the Machine Aftermath
woe|Wilds of Eldraine
lci|Lost Caverns of Ixalan
mkm|Murders at Karlov Manor
otj|Outlaws of Thunder Junction
big|The Big Score
blb|Bloomburrow
dsk|Duskmourn
dft|Aetherdrift
tdm|Tarkir Dragonstorm
fin|Final Fantasy
eoe|Edge of Eternities
spm|Marvel Spider-Man
tla|Avatar The Last Airbender
ecl|Lorwyn Eclipsed
tmt|Teenage Mutant Ninja Turtles
sos|Secrets of Strixhaven
msh|Marvel Super Heroes
cmd|Commander
cm1|Commander’s Arsenal
c13|Commander 2013
c14|Commander 2014
c15|Commander 2015
c16|Commander 2016
c17|Commander 2017
c18|Commander 2018
c19|Commander 2019
c20|Commander 2020
c21|Commander 2021
cmr|Commander Legends
clb|Battle for Baldur’s Gate
cmm|Commander Masters
40k|Warhammer 40,000
who|Doctor Who
pip|Fallout
ltr|The Lord of the Rings
ltc|The Lord of the Rings Commander
m3c|Modern Horizons 3 Commander
fic|Final Fantasy Commander
mh1|Modern Horizons
mh2|Modern Horizons 2
mh3|Modern Horizons 3
mma|Modern Masters
mm2|Modern Masters 2015
mm3|Modern Masters 2017
ema|Eternal Masters
ima|Iconic Masters
a25|Masters 25
uma|Ultimate Masters
2xm|Double Masters
2x2|Double Masters 2022
jmp|Jumpstart
j22|Jumpstart 2022
j25|Jumpstart 2025
sta|Strixhaven Mystical Archive
brr|The Brothers’ War Retro Artifacts
mul|Multiverse Legends
wot|Wilds of Eldraine Enchanting Tales
spg|Special Guests
cns|Conspiracy
cn2|Conspiracy Take the Crown
bbd|Battlebond
hop|Planechase
pc2|Planechase 2012
arc|Archenemy
ugl|Unglued
unh|Unhinged
ust|Unstable
und|Unsanctioned
unf|Unfinity
sld|Secret Lair
`.trim().split('\n').map(line => { const [code, name] = line.split('|'); return { code, name }; });

export function parseKeyruneCss(css: string): KeyruneSymbol[] {
  const codes = [...new Set(Array.from(css.matchAll(/\.ss-([a-z0-9]{1,16})::?before\b/g), match => match[1]))];
  return codes.filter(code => !modifiers.has(code)).map(code => ({ code, name: KEYRUNE_SYMBOLS.find(item => item.code === code)?.name || `Set ${code.toUpperCase()}` }));
}

let catalogueRequest: Promise<KeyruneSymbol[]> | null = null;
export function loadKeyruneSymbols() {
  if (!catalogueRequest) catalogueRequest = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('https://cdn.jsdelivr.net/npm/keyrune@latest/css/keyrune.css', { signal: controller.signal });
      if (!response.ok) throw new Error('Catálogo extra indisponível.');
      const symbols = parseKeyruneCss(await response.text());
      if (!symbols.length) throw new Error('Catálogo extra vazio.');
      return symbols;
    } catch (error) { catalogueRequest = null; throw error; }
    finally { clearTimeout(timeout); }
  })();
  return catalogueRequest;
}
