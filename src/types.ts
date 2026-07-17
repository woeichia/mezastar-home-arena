export enum Rarity {
  COMMON = "2-Star",
  UNCOMMON = "3-Star",
  RARE = "4-Star",
  STAR = "5-Star (Star)",
  SUPERSTAR = "6-Star (Superstar)",
  LEGEND = "Legend/Special",
  REGULAR = "2–4 Star (Regular)",
}

export type TagSeries =
  | "Version 1"
  | "Version 2"
  | "Version 3"
  | "Version 4"
  | "Galaxy Version 1"
  | "Galaxy Version 2"
  | "Unknown"
  | "Fixture";
export type CatalogueStatus = "fixture" | "needs-review" | "verified";

export interface PokemonStats {
  hp: number;
  attack: number;
  defense: number;
  spAtk: number;
  spDef: number;
  speed: number;
}

export interface MezastarMove {
  name: string;
  type: string;
  power: number;
  category: "Physical" | "Special" | "Status";
}

/**
 * Visual collection record.
 *
 * `energy` and `stats` are Home Arena display/demo values until a later
 * home-balance converter is approved. They are never official arcade values.
 */
export interface MezastarTag {
  id: string;
  pokemonId: number;
  name: string;
  rarity: Rarity;
  stars: number;
  type1: string;
  type2?: string;
  energy: number;
  pokedexNo: string;
  stats: PokemonStats;
  moves: MezastarMove[];
  desc?: string;
  isCustom?: boolean;
  /** Legacy custom image override. Prefer portraitUrl for exact tag art. */
  customImgUrl?: string;

  /**
   * Optional exact tag portrait override. Use this for Mega, Gigantamax,
   * costume, or a specific physical tag whose form needs dedicated art.
   */
  portraitUrl?: string;

  /**
   * Controls the automatic portrait source when no exact portraitUrl is set.
   * `auto` makes Version 1 / Version 2 and rarity tiers use different
   * portrait sources and treatments, with safe fallbacks.
   */
  portraitVariant?: "auto" | "official-artwork" | "home" | "dream-world";

  /** Optional visual adjustments for an exact portrait override. */
  portraitScale?: number;
  portraitOffsetY?: number;

  owned?: boolean;
  copiesOwned?: number;

  /** Catalogue matching fields. */
  series?: TagSeries;
  officialTagCode?: string;
  sourceStatus?: CatalogueStatus;
  sourceNote?: string;
  sourceUrl?: string;
  specialFeature?: string;
}

export interface CollectionStats {
  totalCount: number;
  ownedCount: number;
  ownedCopies: number;
  superstarCount: number;
  starCount: number;
  customCount: number;
  totalEnergy: number;
  typesCount: Record<string, number>;
}

export type CollectionMode = "binder" | "catalogue";
