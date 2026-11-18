# Frontend visual contract

For any frontend or visual work, read `VISUAL-LOCK.md` before editing.
Respect `public/css/identity.css` as the final identity layer; reuse existing controls and SVG icons.
The visual lock (`visual-lock.json`, `npm run check:visual`) is NO LONGER part of `npm test` (Owner decision, 2026-11-19: it blocked work and was removed as a gate). It stays as an optional, manual tool: run `npm run check:visual` only when you want to see which frontend files changed. Do not block or fail work because of it, and do not spend effort refreshing its hashes.
Preserve existing 3D behavior and run `node docs/mascot-v4-2/verify-v42.mjs` before and after edits.
Run `npm test` before handing off. Report untested states honestly.
