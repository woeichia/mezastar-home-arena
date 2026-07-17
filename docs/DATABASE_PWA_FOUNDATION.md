# Database and PWA Foundation

## What changed

- IndexedDB schema upgraded from v5 to v6.
- Bundled catalogue data is now separated from personal device data.
- Existing v5 ownership and manually created tags migrate automatically once.
- Settings includes JSON Export Backup and Import Backup controls.
- The bundled catalogue now contains 420 verified identity records: 70 each for Version 1–4 and Galaxy Version 1–2.
- Added an installable web app manifest, offline service worker and generic app icons.
- Added an automatic GitHub Pages deployment workflow.

## Storage model

- `INITIAL_TAGS` remains the catalogue shipped with the app.
- `collection-state` stores tag ID, owned quantity and optional local source-note override.
- `custom-tags` stores manually created or Needs Match tags.
- `storage-meta` records completion of the v5-to-v6 migration.
- The legacy `binder-tags` store remains untouched so the migration does not destructively erase old data.

## Updating the catalogue

Verified catalogue records use stable printed tag-code-based IDs. On an application update, new records appear automatically while existing `collection-state` quantities remain unchanged.

The source snapshot contains official printed code, displayed Pokémon name and rarity grouping. Pokémon type and Pokédex ID are reference metadata. Numeric Home Arena energy/stats remain clearly labelled tier estimates and are not official arcade values.

## GitHub Pages setup

1. Push the patch to the repository's `main` branch.
2. Open repository Settings → Pages.
3. Choose GitHub Actions as the Pages source.
4. Run or wait for `Deploy Tag Battle to GitHub Pages`.
5. Open the Pages URL on a phone and use Add to Home Screen / Install App.

The Vite base path is calculated from `GITHUB_REPOSITORY`, so project-site asset and service-worker paths work beneath the repository name.

## Device test

1. Open the existing app before updating and note owned quantities plus any Needs Match tag.
2. Deploy the new build and reopen it on the same origin.
3. Confirm all ownership and custom tags survived the v6 migration.
4. Export a backup in Settings.
5. Change one quantity, import the backup and confirm the earlier quantity returns.
6. Install the app to the home screen.
7. Open every main screen once while online, then test the app shell offline.

Pokémon portraits and Google Fonts are currently remote resources. The application shell and local catalogue work offline, but complete offline artwork requires separately approved local assets.
