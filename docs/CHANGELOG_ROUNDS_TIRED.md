# Changelog — Three rounds and Tired initiative

## Added

- Battle progress now tracks Round 1 through Round 3.
- Every round returns to attacker selection.
- A team slot is Tired only when it participated in the immediately previous round.
- Tired status belongs to the physical team slot, so duplicate copies remain independent.
- Resting for one complete round automatically returns that slot to Fresh status.
- Fresh versus Fresh runs the normal Tap Race.
- Tired versus Tired runs the normal Tap Race.
- Fresh versus Tired skips the Tap Race and gives the Fresh Pokémon first attack.
- Tired status is visible during selection and formation.
- Tired Pokémon now use a subtle breathing/swaying animation, looping sweat droplets and slightly reduced colour intensity.
- Compact supporting Pokémon use a smaller two-droplet version of the same effect.

## Consecutive-use examples

- Used in Round 1 and selected again in Round 2: Tired.
- Used in Round 1, rested in Round 2, selected in Round 3: Fresh.
- Used in all three rounds: Tired in Round 2 and Round 3.
- A temporary **Simulate Attack** control advances rounds until Roulette and damage are connected.

## Not included yet

- Roulette
- Attack charge and Rainbow timing
- HP and damage
- Knockout handling
- Final match winner

The temporary round-advance control must be removed when real attack resolution is implemented.
