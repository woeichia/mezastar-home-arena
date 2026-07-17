# Portrait Variation Patch

## What changes
- The existing binder card layout, artwork position, front/back design, and flip behavior are preserved.
- Portrait loading now supports exact per-tag overrides through `portraitUrl`.
- When no exact override exists, the app varies portrait source automatically:
  - Version 1 defaults to Official Artwork.
  - Version 2 defaults to Pokémon HOME artwork.
  - Superstar/Legend, Star/Rare, and regular tier tags use different source priorities and visual treatments.
- If a source does not exist, the card automatically tries the next safe source.

## Honest limitation
A normal Pokémon may not have genuinely different official poses for every physical tag or star rating. The visual variation makes versions and rarity feel distinct, but exact special-form art requires a `portraitUrl` mapping for that specific tag.

## Future exact-form entry
Add this to an exact catalogue record:
```ts
portraitUrl: "https://.../approved-form-image.png",
portraitScale: 1.05,
portraitOffsetY: -4,
```
Use this for Mega, Gigantamax, regional form, costume, or special tag art.
