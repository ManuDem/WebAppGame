# Card Artwork PNG

Place card artwork PNG files in this folder using the `templateId` as file name.

Examples:
- `emp_01.png`
- `trk_03.png`
- `mon_02.png`

The client resolves artwork by:
1. explicit key on card payload (`artworkKey` / `artworkId` / `artKey`) if present
2. fallback to `templateId`

If a PNG is missing, the game uses the procedural artwork fallback.
