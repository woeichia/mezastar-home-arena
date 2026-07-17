import { Rarity, type MezastarTag } from "../types";

export type PortraitSource = {
  url: string;
  label: "exact" | "official-artwork" | "home" | "dream-world";
};

export type PortraitTreatment = {
  className: string;
  glowClassName: string;
};

/**
 * Chooses a portrait source without changing card layout.
 *
 * Important:
 * - A normal Pokémon does not always have multiple official poses available.
 * - Version/rating source variation is a visual variation, not a claim that
 *   each physical tag has different official artwork.
 * - Use `portraitUrl` for an exact approved form-specific image later.
 */
export function getPortraitSources(tag: MezastarTag): PortraitSource[] {
  if (tag.pokemonId <= 0 && !tag.portraitUrl && !tag.customImgUrl) {
    return [];
  }

  const exactSources = [tag.portraitUrl, tag.customImgUrl]
    .filter((value): value is string => Boolean(value))
    .map((url) => ({ url, label: "exact" as const }));

  if (tag.pokemonId <= 0) {
    return exactSources;
  }

  const official = {
    url: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${tag.pokemonId}.png`,
    label: "official-artwork" as const,
  };
  const home = {
    url: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${tag.pokemonId}.png`,
    label: "home" as const,
  };
  const dream = {
    url: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/dream-world/${tag.pokemonId}.svg`,
    label: "dream-world" as const,
  };

  const forced = tag.portraitVariant;
  const automaticSources =
    forced === "official-artwork"
      ? [official, home, dream]
      : forced === "home"
        ? [home, official, dream]
        : forced === "dream-world"
          ? [dream, home, official]
          : tag.series === "Version 2"
            ? [home, official, dream]
            : tag.rarity === Rarity.SUPERSTAR || tag.rarity === Rarity.LEGEND
              ? [official, home, dream]
              : tag.rarity === Rarity.STAR || tag.rarity === Rarity.RARE
                ? [home, official, dream]
                : [dream, home, official];

  const seen = new Set<string>();
  return [...exactSources, ...automaticSources].filter((source) => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}

/**
 * This adds distinction without moving the portrait or changing the approved
 * card composition. Exact form art remains controlled by `portraitUrl`.
 */
export function getPortraitTreatment(tag: MezastarTag): PortraitTreatment {
  if (tag.series === "Version 2") {
    return {
      className: "scale-[1.14] saturate-[1.08] contrast-[1.04]",
      glowClassName: "drop-shadow-[0_0_11px_rgba(96,165,250,0.35)]",
    };
  }

  if (tag.rarity === Rarity.SUPERSTAR || tag.rarity === Rarity.LEGEND) {
    return {
      className: "scale-[1.12] saturate-[1.12] contrast-[1.06]",
      glowClassName: "drop-shadow-[0_0_12px_rgba(251,191,36,0.38)]",
    };
  }

  if (tag.rarity === Rarity.STAR) {
    return {
      className: "scale-[1.1] saturate-[1.08] contrast-[1.05]",
      glowClassName: "drop-shadow-[0_0_10px_rgba(244,114,182,0.32)]",
    };
  }

  if (tag.rarity === Rarity.RARE) {
    return {
      className: "scale-[1.07] saturate-[1.03]",
      glowClassName: "drop-shadow-[0_0_9px_rgba(52,211,153,0.28)]",
    };
  }

  return {
    className: "scale-110",
    glowClassName: "drop-shadow-[0_6px_8px_rgba(0,0,0,0.6)]",
  };
}
