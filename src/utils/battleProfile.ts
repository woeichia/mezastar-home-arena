import type { MezastarMove, MezastarTag } from "../types";

export interface HomeBattleMove {
  name: string;
  type: string;
  power: number;
  category: "Physical" | "Special";
  sourceLabel: "Stored Battle Move" | "Documented Move · Home Power" | "Generated Home Move";
}

export interface HomeBattleProfile {
  tagId: string;
  pokemonName: string;
  move: HomeBattleMove;
}

const HOME_POWER_BY_STARS: Record<number, number> = {
  2: 55,
  3: 70,
  4: 85,
  5: 100,
  6: 115,
};

function homePowerFor(tag: MezastarTag) {
  return HOME_POWER_BY_STARS[tag.stars] ?? Math.max(55, Math.min(115, 40 + tag.stars * 12));
}

function offensiveCategory(tag: MezastarTag, move?: MezastarMove): "Physical" | "Special" {
  if (move?.category === "Physical" || move?.category === "Special") return move.category;
  return tag.stats.attack >= tag.stats.spAtk ? "Physical" : "Special";
}

/**
 * Builds a battle-safe runtime profile without changing catalogue records.
 * Verified catalogue move power is intentionally not invented in source data;
 * missing values receive a clearly labelled Home Arena balance value here.
 */
export function resolveHomeBattleProfile(tag: MezastarTag): HomeBattleProfile {
  const documentedMove = tag.moves.find((move) => move.name.trim() && move.type.trim());
  const hasStoredBattlePower = Boolean(documentedMove && documentedMove.power > 0 && documentedMove.category !== "Status");
  const moveType = documentedMove?.type || tag.type1;

  return {
    tagId: tag.id,
    pokemonName: tag.name,
    move: {
      name: documentedMove?.name || `${tag.type1} Strike`,
      type: moveType,
      power: hasStoredBattlePower ? documentedMove!.power : homePowerFor(tag),
      category: offensiveCategory(tag, documentedMove),
      sourceLabel: hasStoredBattlePower
        ? "Stored Battle Move"
        : documentedMove
          ? "Documented Move · Home Power"
          : "Generated Home Move",
    },
  };
}
