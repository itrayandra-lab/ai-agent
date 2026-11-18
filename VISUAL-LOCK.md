# RAIVERSE visual lock v1

## Source of truth

`public/css/identity.css` defines the navy–ivory identity and must load last.
Use existing `.btn`, `.input`, `.card` and `icon()` components. Keep serif for editorial headings and sans-serif for controls. New controls need clear Indonesian labels, visible keyboard focus, loading/disabled/error states and readable contrast. Keep advanced actions progressively disclosed.

`visual-lock.json` freezes the current HTML, CSS, JavaScript and favicon. Checks detect changes, additions and deletions, including legacy styles that could override the identity. Line endings are normalized. The lock includes behavior files because they generate markup and inline styles.

## Required change workflow

1. Back up affected files and make the smallest necessary change. Preserve existing functionality and 3D contracts.
2. Run `npm test` and `node docs/mascot-v4-2/verify-v42.mjs`. An intentional frontend edit will fail the lock until reviewed.
3. Review affected screens in both themes at 390×844, 820×900 and 1440×900. Check overflow, clipping, long labels, empty/populated states, loading, errors, keyboard navigation, dialogs and mobile navigation. Exercise changed actions on isolated simulation data.
4. Save before/after screenshots and record outcomes and remaining limitations. Check normal text contrast >= 4.5:1 and large text >= 3:1. Do not treat a screenshot or a passing hash as proof of usability.
5. Only after review, update the hashes of reviewed files in `visual-lock.json` and explain why in the change description. Never regenerate the entire manifest simply to silence a failure. Run checks again.

## Boundaries

This is a change-detection gate, not a promise of visual perfection. The initial baseline preserves the current implementation, including legacy screens not exhaustively reviewed. It does not detect browser rendering differences, changing content, external fonts, or binary 3D assets. Future changes require visual review as well as automated checks. There is intentionally no automatic baseline-update command.
