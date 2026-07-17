# Mezastar Home Arena

A local-first Progressive Web App for managing a Mezastar tag collection and playing two-player home battles on one phone or tablet.

## Included

- 420 verified catalogue identities from Version 1 through Galaxy Version 2
- Local collection quantities and unknown-tag matching
- Three-round two-player battle flow
- Tap Race, Battle Wheel, Rainbow Charge and Double Strike challenge
- Pokémon-style type effectiveness and persistent team HP
- Round battle music, sound effects and victory celebration
- IndexedDB storage with JSON backup and restore
- Installable PWA with offline app-shell support

Catalogue codes, Pokémon identities and rarity groups are source-traceable. Home Arena energy, move-power and preview stats are balancing values and are not presented as official arcade machine values.

## Development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run lint
npm run build
```

## Phone installation

After GitHub Pages deployment, open `https://woeichia.github.io/mezastar-home-arena/` on the phone. Use **Add to Home Screen** on iPhone Safari or **Install app** on Android Chrome.

Collection data stays in that browser/device. Export a JSON backup before clearing browser storage, uninstalling the PWA or changing phones.
