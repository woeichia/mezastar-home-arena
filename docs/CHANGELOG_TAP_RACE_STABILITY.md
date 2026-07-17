# Tap Race Stability Patch

## What changed

- Pokémon portraits no longer scale or change filters for every tap.
- Tap counts are collected immediately and published to React at a controlled rate.
- Full-screen keyed shake, wave and boundary-hit elements were replaced with persistent GPU-friendly effects.
- The winning colour territory now crosses the centre line and visibly overlays the opponent Pokémon area.
- Local tap-button flashes and press scaling remain for responsive feedback.
- Tap controls use `touch-action: none` to prevent accidental browser gestures during rapid tapping.
- The Battle Wheel spins with CSS and resolves its result from elapsed time, avoiding React rerenders on every wheel frame.
- Reaching 12/12 charge taps enters Rainbow Chance immediately.
- Charge and Rainbow resolution use a one-time guard to prevent duplicate or skipped results.
- Countdown blur was removed so the Pokémon remain visually stable behind it.

## Second/third-cycle mobile fix

- Removed the six continuously animated WebGL aura canvases from the battle arena. Recreating those canvases every attacker-selection round caused mobile GPU resources to accumulate and later wheel/charge layers to blink or disappear.
- Arena energy is retained with lower-cost CSS colour auras and a single pulse on the selected Pokémon.
- The Battle Wheel now rotates a stable wrapper around a contained, pre-painted wheel face.
- Full-screen blur was removed from the wheel and charge stages.
- The charge pad uses a solid base with one small inner pulse instead of animating the entire gradient panel.
- Filter animations were removed from repeated wheel-result and charge-pulse effects.

## Complete round attack cycle

- The Tap Race determines attack order only.
- Attack turn 1: the Tap Race winner completes Battle Wheel and Attack Charge.
- Attack turn 2: the opponent then completes their own Battle Wheel and Attack Charge.
- Only after both attack turns finish does the game advance to the next attacker-selection round.
- Wheel and charge results are stored separately as `round-turn` keys, allowing up to six attack results across three rounds.

## Rainbow, HP, attack and sound patch

- Added a 900 ms `RAINBOW CHANCE — GET READY` stage after full Charge.
- The Rainbow bar then ignores input for another 650 ms, preventing continued Charge tapping from locking the result accidentally.
- Added a mobile-safe shared Web Audio controller with countdown, Tap Race, Wheel, Charge, Rainbow, attack, impact, HP and handoff sounds.
- Added a sound mute/unmute control in the arena.
- Added the full 18-type effectiveness chart including dual-type multiplication and immunities.
- Added Home Arena damage calculation using move power, offensive/defensive stats, Wheel, Charge, STAB, effectiveness and selected/support distribution.
- Added persistent team HP across rounds and disabled future selection of fainted Pokémon.
- Added attack-resolution animation with move information, effectiveness messages, damage numbers and animated HP bars for all three defenders.
- Both committed attackers complete their queued turns before the next round.
- Added the three-round winner calculation using surviving Pokémon first and remaining HP as the tiebreaker.
- Disabled the larger arena entrance and formation animations after Round 1 and paused selected-Pokémon aura effects outside the Tap Race to reduce the remaining late-round mobile blink.

## Orientation, effectiveness and impact refinement

- Removed the overlapping Player 1 row rotation. Player 1 ownership now applies one consistent 180-degree rotation to its Pokémon content in every round.
- Attack-resolution orientation is no longer inherited from the attacker for the whole screen. Each defending card follows its owner's orientation, so Player 1 HP cards remain rotated 180 degrees.
- Added a dedicated 700 ms effectiveness stage between impact and HP deduction.
- Added a large animated `SUPER EFFECTIVE`, `NOT VERY EFFECTIVE`, `NO EFFECT` or `NORMAL HIT` banner based on the selected defender.
- Added lightweight local hit feedback to every affected Pokémon: an eight-ray splash, expanding impact ring and one short card shake.
- Reduced the global impact flash so the local Pokémon splashes remain visible.
- Mobile audio is now primed during the first arena pointer interaction and suspended audio retries once after resume.
- Rebuilt the `GO!` sound as a stronger layered cue with a rising tone, high confirmation tone, low impact and short noise burst.

## Orientation and FX v2 reliability follow-up

- Round 2/3 Player 1 selection no longer relies on a nested card-content transform. Every Player 1 selection card now has an explicit outer 180-degree ownership wrapper.
- The effectiveness result is now a full-screen centre overlay held for 1.2 seconds, with 4xl result text and the selected defender name.
- The hit stage was extended to 650 ms.
- Each affected Pokémon receives a larger local impact ring, eight longer rays and a longer single shake.
- Added a visible `Orientation + FX v2` marker beneath Battle Progress so testers can confirm the newest component bundle is active instead of a cached earlier patch.

## HP review, damage safety, and battle audio

- Extended the post-damage HP review phase to 2.6 seconds, followed by a short handoff or round-complete pause.
- Fixed `-0` on already-fainted targets and redirects an invalid selected target to the first living defender.
- Living, non-immune targets always receive at least 1 damage; genuine immunity or miss results display `NO DAMAGE` instead of `-0`.
- Ends the battle immediately when an entire team reaches 0 HP, preventing a defeated side from taking a follow-up attack.
- Added generated looping battle music that begins after the first arena interaction and stops when leaving battle.
- Increased synthesized sound-effect output by 80%, including `GO!`, impact, wheel, charge and HP cues.

## Verification

- Targeted TypeScript check for the patched battle files: passed.
- Vite production build: passed.
- The existing full-project lint still reports unrelated errors in `App.tsx` and `AlbumView.tsx`; this patch does not modify those files.

## Suggested device test

1. Rapidly tap both sides for the full five-second race.
2. Confirm both Pokémon remain fixed while the territory line advances.
3. Confirm the advancing colour overlays the opponent Pokémon when it crosses the centre.
4. Stop the Battle Wheel several times and confirm every stop locks one result.
5. Reach 12/12 charge and confirm Rainbow Chance always opens immediately.
6. Tap the Rainbow bar once and confirm the charge result locks only once.
