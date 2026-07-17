# Phase A — Version Search and Unknown Tag Tray

## What this adds
- Searchable printed-code field (`officialTagCode`).
- Version 1, Version 2, Unknown, and Fixture filters.
- An **Add Unknown Tag** path for third-party tags that cannot be identified yet.
- Unknown tags are saved locally with `sourceStatus: needs-review`.
- Unknown tags remain usable in My Collection and are visually labelled **Needs Match**.

## Important limitation
This update prepares the matching workflow. It does not yet claim that the current
fixture records are verified Version 1 or Version 2 catalogue entries.

## Later matching flow
1. Import verified Version 1 and Version 2 catalogue records.
2. Search the printed code.
3. Link a Needs Match entry to the verified catalogue record.
4. Preserve the local ownership quantity and note.
