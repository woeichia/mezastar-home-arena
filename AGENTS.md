# Tag Battle Home Arena Rules

- Preserve the binder compartment and horizontal tag-card visual system unless the user explicitly asks for a redesign.
- Do not restore AI Forge, Gemini, scanner console, Express server, or fake battle console.
- Keep fixture/demo data clearly labelled. Do not present it as verified official Mezastar stats.
- Use IndexedDB for local collection persistence.
- Future work must add features on top of this collection UI rather than replacing it with oval tokens.
- Battle portraits, three rounds, tap race, roulette, Rainbow, and verified catalogue import are later phases.

## Catalogue phase rule
- Preserve the approved Google-style horizontal binder card and compartment UI. Catalogue uses the same visual language; do not replace it with oval-token collection UI.
- Fixture values remain fixture/demo values until a source-traceable verified import is added.


## Unknown tag matching
- Never guess a Version 1 or Version 2 record from Pokémon name alone.
- A manually added tag must be marked `needs-review` until linked by printed tag code or verified details.
- Preserve a user's owned quantity and note when future catalogue matching is implemented.


## Verified catalogue snapshot
- Version 1 through Galaxy Version 2 imported records are source-traceable catalogue identity data, not fixture data.
- Preserve all 420 unique printed tag codes: 70 records in each of Version 1, Version 2, Version 3, Version 4, Galaxy Version 1, and Galaxy Version 2.
- Keep `sourceStatus: "verified"` and source URL for each imported record.
- Never present Home Arena `energy` or numeric preview stats as official machine values.
- Preserve manual Needs Match records and do not automatically replace them with a verified record without an explicit user-confirmed linking step.
