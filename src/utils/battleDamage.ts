import type { MezastarTag } from "../types";
import type { HomeBattleProfile } from "./battleProfile";

export interface DamageTargetResult {
  slotIndex: number;
  tagId: string;
  name: string;
  maxHp: number;
  beforeHp: number;
  afterHp: number;
  damage: number;
  effectiveness: number;
  distribution: number;
  wasAlreadyFainted: boolean;
}

interface TypeMatchup {
  strong?: string[];
  weak?: string[];
  immune?: string[];
}

const TYPE_CHART: Record<string, TypeMatchup> = {
  Normal: { weak: ["Rock", "Steel"], immune: ["Ghost"] },
  Fire: { strong: ["Grass", "Ice", "Bug", "Steel"], weak: ["Fire", "Water", "Rock", "Dragon"] },
  Water: { strong: ["Fire", "Ground", "Rock"], weak: ["Water", "Grass", "Dragon"] },
  Electric: { strong: ["Water", "Flying"], weak: ["Electric", "Grass", "Dragon"], immune: ["Ground"] },
  Grass: { strong: ["Water", "Ground", "Rock"], weak: ["Fire", "Grass", "Poison", "Flying", "Bug", "Dragon", "Steel"] },
  Ice: { strong: ["Grass", "Ground", "Flying", "Dragon"], weak: ["Fire", "Water", "Ice", "Steel"] },
  Fighting: { strong: ["Normal", "Ice", "Rock", "Dark", "Steel"], weak: ["Poison", "Flying", "Psychic", "Bug", "Fairy"], immune: ["Ghost"] },
  Poison: { strong: ["Grass", "Fairy"], weak: ["Poison", "Ground", "Rock", "Ghost"], immune: ["Steel"] },
  Ground: { strong: ["Fire", "Electric", "Poison", "Rock", "Steel"], weak: ["Grass", "Bug"], immune: ["Flying"] },
  Flying: { strong: ["Grass", "Fighting", "Bug"], weak: ["Electric", "Rock", "Steel"] },
  Psychic: { strong: ["Fighting", "Poison"], weak: ["Psychic", "Steel"], immune: ["Dark"] },
  Bug: { strong: ["Grass", "Psychic", "Dark"], weak: ["Fire", "Fighting", "Poison", "Flying", "Ghost", "Steel", "Fairy"] },
  Rock: { strong: ["Fire", "Ice", "Flying", "Bug"], weak: ["Fighting", "Ground", "Steel"] },
  Ghost: { strong: ["Psychic", "Ghost"], weak: ["Dark"], immune: ["Normal"] },
  Dragon: { strong: ["Dragon"], weak: ["Steel"], immune: ["Fairy"] },
  Dark: { strong: ["Psychic", "Ghost"], weak: ["Fighting", "Dark", "Fairy"] },
  Steel: { strong: ["Ice", "Rock", "Fairy"], weak: ["Fire", "Water", "Electric", "Steel"] },
  Fairy: { strong: ["Fighting", "Dragon", "Dark"], weak: ["Fire", "Poison", "Steel"] },
};

export function typeEffectiveness(moveType: string, defender: MezastarTag) {
  const matchup = TYPE_CHART[moveType] ?? {};
  const defenderTypes = [defender.type1, defender.type2].filter(Boolean) as string[];

  return defenderTypes.reduce((multiplier, type) => {
    if (matchup.immune?.includes(type)) return 0;
    if (matchup.strong?.includes(type)) return multiplier * 2;
    if (matchup.weak?.includes(type)) return multiplier * 0.5;
    return multiplier;
  }, 1);
}

export function effectivenessLabel(multiplier: number) {
  if (multiplier === 0) return "NO EFFECT";
  if (multiplier >= 2) return "SUPER EFFECTIVE";
  if (multiplier < 1) return "NOT VERY EFFECTIVE";
  return "NORMAL HIT";
}

export function calculateTeamDamage({
  attacker,
  profile,
  defenders,
  defenderHp,
  selectedDefenderIndex,
  wheelMultiplier,
  chargeMultiplier,
}: {
  attacker: MezastarTag;
  profile: HomeBattleProfile;
  defenders: MezastarTag[];
  defenderHp: number[];
  selectedDefenderIndex: number;
  wheelMultiplier: number;
  chargeMultiplier: number;
}): DamageTargetResult[] {
  const attackStat = profile.move.category === "Physical" ? attacker.stats.attack : attacker.stats.spAtk;
  const stab = profile.move.type === attacker.type1 || profile.move.type === attacker.type2 ? 1.15 : 1;
  const firstLivingDefenderIndex = defenders.findIndex((defender, slotIndex) => {
    const maxHp = Math.max(1, defender.stats.hp);
    return Math.max(0, defenderHp[slotIndex] ?? maxHp) > 0;
  });
  const selectedDefenderIsLiving = selectedDefenderIndex >= 0
    && selectedDefenderIndex < defenders.length
    && Math.max(0, defenderHp[selectedDefenderIndex] ?? Math.max(1, defenders[selectedDefenderIndex].stats.hp)) > 0;
  const resolvedSelectedDefenderIndex = selectedDefenderIsLiving ? selectedDefenderIndex : firstLivingDefenderIndex;

  return defenders.map((defender, slotIndex) => {
    const maxHp = Math.max(1, defender.stats.hp);
    const beforeHp = Math.max(0, defenderHp[slotIndex] ?? maxHp);
    const wasAlreadyFainted = beforeHp <= 0;
    const defenseStat = profile.move.category === "Physical" ? defender.stats.defense : defender.stats.spDef;
    const effectiveness = typeEffectiveness(profile.move.type, defender);
    const distribution = wasAlreadyFainted ? 0 : slotIndex === resolvedSelectedDefenderIndex ? 1 : 0.35;
    const rawDamage = ((profile.move.power * attackStat) / Math.max(1, defenseStat) / 5 + 4)
      * wheelMultiplier
      * chargeMultiplier
      * stab
      * effectiveness
      * distribution;
    const damage = wasAlreadyFainted || wheelMultiplier === 0 || effectiveness === 0
      ? 0
      : Math.max(1, Math.round(rawDamage));
    const afterHp = Math.max(0, beforeHp - damage);

    return {
      slotIndex,
      tagId: defender.id,
      name: defender.name,
      maxHp,
      beforeHp,
      afterHp,
      damage: Math.min(beforeHp, damage),
      effectiveness,
      distribution,
      wasAlreadyFainted,
    };
  });
}
