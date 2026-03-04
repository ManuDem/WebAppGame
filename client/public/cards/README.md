# Card Artwork PNG

Place card artwork PNG files in this folder.

Preferred naming:
- `templateId.png` (example: `emp_01.png`)

Alternative naming is supported through manifest mapping in:
- `client/src/ui/CardArtworkResolver.ts`

Current mapped examples:
- `emp_01` -> `hero_luca.png`
- `emp_07` -> `hero_marco.png`

The client resolves artwork by:
1. explicit key on card payload (`artworkKey` / `artworkId` / `artKey`) if present
2. fallback to `templateId`

If a PNG is missing, the game uses the procedural artwork fallback.
