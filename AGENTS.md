# Frontend visual contract

For any frontend or visual work, read `VISUAL-LOCK.md` before editing.
Respect `public/css/identity.css` as the final identity layer; reuse existing controls and SVG icons.
Do not bypass or automatically refresh `visual-lock.json` to make tests pass.
An intentional baseline change needs recorded visual review and an explanation of the changed files.
Preserve existing 3D behavior and run `node docs/mascot-v4-2/verify-v42.mjs` before and after edits.
Run `npm test` before handing off. Report untested states honestly.
