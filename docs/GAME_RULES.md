# Mezastar Home Arena — Proposed Version 1 Rules

These are original Home Arena rules. Catalogue names, printed codes and rarity groupings may be source-traceable, but Home Arena energy, stats, move power and damage formulas are not official arcade values.

## Match

- Two players use three physical tags each.
- A match has three rounds.
- Both players select one surviving Pokémon at the start of every round.
- An attack affects the selected opponent and both supporting Pokémon.

## Tired status and attack order

- Every Pokémon begins Fresh.
- A Pokémon is Tired only when selected again immediately after participating in the previous round.
- Resting for one complete round returns the Pokémon to Fresh status.
- Fresh versus Fresh: run Tap Race.
- Tired versus Tired: run Tap Race.
- Fresh versus Tired: Fresh attacks first automatically.
- A Pokémon at zero HP cannot be selected.
- Both selected attackers are committed for the current round and complete their queued attack turns.
- If a Pokémon reaches zero HP during the first attack, it still completes its already-queued counterattack, but it cannot be selected in later rounds.

## Attack sequence

1. Determine attack order through Tap Race or Fresh advantage.
2. First attacker stops its execution wheel.
3. First attacker completes charge and Rainbow timing.
4. Show the attack animation, calculate type effectiveness and apply damage to all three opponents.
5. The second committed attacker completes its wheel, charge and attack.
6. Show the round summary and begin the next attacker selection.

Normal battle stages continue automatically. Players only provide gameplay input: attacker confirmation, Tap Race, stopping the Battle Wheel, charge tapping and Rainbow timing. Navigation/continue buttons are test-only and are not part of normal battle flow.

## Execution wheel

| Result | Slots | Multiplier |
| --- | ---: | ---: |
| Miss | 1 | ×0.00 |
| Weak Hit | 2 | ×0.75 |
| Hit | 3 | ×1.00 |
| Strong Hit | 1 | ×1.25 |
| Critical Hit | 1 | ×1.50 |

## Type effectiveness

- Immune: ×0
- Not very effective: ×0.5
- Normal: ×1
- Super effective: ×2
- Dual-type defenders multiply both type matchups.

## Damage distribution

- Selected opposing attacker: 100% calculated damage.
- Each supporting Pokémon: 35% calculated damage, with its own type effectiveness.
- Individual HP carries between rounds.

Home Arena damage uses move power, the appropriate Attack/Defense or Sp. Attack/Sp. Defense stats, the Wheel multiplier, Charge multiplier, same-type attack bonus, type effectiveness and the selected/support distribution. A successful damaging move always deals at least 1 HP unless the Wheel result is Miss or the defender is immune.

## Match result

- A player wins immediately when all three opposing Pokémon reach zero HP.
- Otherwise, after Round 3, compare surviving Pokémon.
- If equal, compare combined remaining HP percentage.
- If still equal, the match is a draw.
