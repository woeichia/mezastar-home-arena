import { writeFile } from "node:fs/promises";

const SERIES = [
  { series: "Version 3", url: "https://world.pokemonmezastar.com/sg/tag/33112/", prefix: "1-3" },
  { series: "Version 4", url: "https://world.pokemonmezastar.com/sg/tag/34928/", prefix: "1-4" },
  { series: "Galaxy Version 1", url: "https://world.pokemonmezastar.com/sg/tag/36251/", prefix: "2-1" },
  { series: "Galaxy Version 2", url: "https://world.pokemonmezastar.com/sg/tag/37860/", prefix: "2-2" },
];

const SLUG_BY_NAME = {
  Keldeo: "keldeo-ordinary",
  Mimikyu: "mimikyu-disguised",
  Zygarde: "zygarde-50",
  "Galarian Weezing": "weezing-galar",
  "Alolan Vulpix": "vulpix-alola",
  "Alolan Ninetales": "ninetales-alola",
  "Hisuian Zorua": "zorua-hisui",
  "Hisuian Zoroark": "zoroark-hisui",
  "Galarian Farfetch'd": "farfetchd-galar",
  "Galarian Meowth": "meowth-galar",
};

const metadataBySlug = new Map();

const SLUG_BY_CODE = {
  "1-4-005": "calyrex-ice",
  "1-4-006": "calyrex-shadow",
  "2-1-021": "toxtricity-amped",
  "2-1-022": "toxtricity-low-key",
  "2-1-059": "toxtricity-amped",
  "2-1-060": "toxtricity-low-key",
};

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&eacute;", "é")
    .trim();
}

function pokemonSlug(name, code) {
  if (SLUG_BY_CODE[code]) return SLUG_BY_CODE[code];
  if (SLUG_BY_NAME[name]) return SLUG_BY_NAME[name];
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("♀", "-f")
    .replaceAll("♂", "-m")
    .toLowerCase()
    .replace(/[.'’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { "user-agent": "Tag Battle Home Arena catalogue verifier" } });
  if (!response.ok) throw new Error(`Could not fetch ${url}: ${response.status}`);
  return response.text();
}

async function fetchSeries(config) {
  const html = await fetchText(config.url);
  const matches = [...html.matchAll(/<p class="tag-no">([^<]+)<\/p>\s*<p class="tag-name">([^<]+)/g)]
    .map((match) => ({ code: decodeHtml(match[1]), name: decodeHtml(match[2]) }))
    .filter((tag) => tag.code.startsWith(`${config.prefix}-`));
  if (matches.length !== 70) throw new Error(`${config.series}: expected 70 tags, received ${matches.length}`);
  return matches.map((tag) => ({ ...tag, ...config }));
}

async function mapWithConcurrency(values, concurrency, mapper) {
  const result = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      result[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return result;
}

async function resolvePokemon(tag) {
  const slug = pokemonSlug(tag.name, tag.code);
  if (!metadataBySlug.has(slug)) {
    metadataBySlug.set(slug, (async () => {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${slug}`);
        if (response.ok) return response.json();
        if (response.status === 404 || attempt === 3) throw new Error(`${tag.code} ${tag.name}: Pokémon metadata lookup failed for ${slug} (${response.status})`);
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
      throw new Error(`${tag.code} ${tag.name}: Pokémon metadata lookup failed for ${slug}`);
    })());
  }
  const pokemon = await metadataBySlug.get(slug);
  return {
    ...tag,
    pokemonId: pokemon.id,
    types: pokemon.types.sort((a, b) => a.slot - b.slot).map((entry) => entry.type.name[0].toUpperCase() + entry.type.name.slice(1)),
  };
}

function tierFor(code) {
  const number = Number(code.slice(-3));
  if (number <= 10) return { rarity: "Rarity.SUPERSTAR", stars: 6, energy: 154, stats: { hp: 142, attack: 132, defense: 112, spAtk: 136, spDef: 116, speed: 129 } };
  if (number <= 25) return { rarity: "Rarity.STAR", stars: 5, energy: 126, stats: { hp: 116, attack: 108, defense: 92, spAtk: 111, spDef: 94, speed: 106 } };
  return { rarity: "Rarity.REGULAR", stars: 3, energy: 92, stats: { hp: 85, attack: 79, defense: 67, spAtk: 81, spDef: 69, speed: 77 } };
}

function quote(value) {
  return JSON.stringify(value);
}

function renderTag(tag) {
  const tier = tierFor(tag.code);
  const type2 = tag.types[1] ? `\n    type2: ${quote(tag.types[1])},` : "";
  return `  {
    id: ${quote(`official-${tag.code}`)},
    pokemonId: ${tag.pokemonId},
    name: ${quote(tag.name)},
    rarity: ${tier.rarity},
    stars: ${tier.stars},
    type1: ${quote(tag.types[0])},${type2}
    energy: ${tier.energy},
    pokedexNo: ${quote(tag.code)},
    officialTagCode: ${quote(tag.code)},
    series: ${quote(tag.series)},
    sourceStatus: "verified",
    sourceUrl: ${quote(tag.url)},
    sourceNote: "Official catalogue code, Pokémon name and rarity group verified; no exact move/stat value stored. Types and Pokédex ID are reference metadata. Home Arena preview values are not official arcade stats.",
    stats: ${JSON.stringify(tier.stats)},
    moves: [],
    owned: false,
    copiesOwned: 0,
  },`;
}

const officialTags = (await Promise.all(SERIES.map(fetchSeries))).flat();
const resolvedTags = await mapWithConcurrency(officialTags, 8, resolvePokemon);
const output = `import { Rarity, type MezastarTag } from "../types";

/**
 * Verified catalogue identity snapshot for Version 3 through Galaxy Version 2.
 * Printed code, display name and rarity group come from each official Singapore
 * Pokémon MEZASTAR catalogue page. Types and Pokédex IDs are reference metadata.
 * Home Arena energy/stats are tier-based estimates and are not arcade values.
 */
export const EXPANDED_VERIFIED_CATALOGUE_TAGS: MezastarTag[] = [
${resolvedTags.map(renderTag).join("\n")}
];
`;

await writeFile(new URL("../src/data/expandedCatalogue.ts", import.meta.url), output, "utf8");
console.log(`Wrote ${resolvedTags.length} verified catalogue records.`);
