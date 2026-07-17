# Tag Battle Home Arena — Phase A (Corrected Binder Base)

This project deliberately preserves the original Google AI Studio binder and horizontal tag-card visual system as its collection base.

## Removed
- AI Forge / Forging Oven
- Gemini and API key requirements
- Express server and `server.ts`
- scanner console and mock battle console
- destructive reset controls

## Kept visually
- Binder compartments
- Horizontal collectible tag cards
- Pokémon artwork presentation
- Rarity colours, type pills, energy-style value, stars, front/back flip
- Search and filters

## Data note
The included library is a fixture/demo catalogue. Its values are not asserted to be official Mezastar machine stats. The next phase should add a source-traceable catalogue import and map visible tag details carefully.

## Run
```bash
npm install
npm run dev
```

## Check
```bash
npm run lint
npm run build
```

## Storage
Owned/unowned selection is stored locally in IndexedDB under `tag-battle-home-arena`.
