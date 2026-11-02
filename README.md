# Tiny Gods

A browser strategy game for one to four players. Give secret orders to an abstract faction of villagers, watch the town act on them, then guess who caused the biggest incidents.

## Play locally

Use Node.js 22.12 or newer. Run `npm ci` and `npm run dev`, then open the local address printed by Vite. Start with **Play vs bots**. **Pass & play** supports up to four local players. For online play, create a room, share its five-letter code, and have each guest mark ready. The host starts the match.

## Checks

- `npm test` runs rule, hidden-information, host-input, and full-match checks.
- `npm run simulate -- --matches 1000 --bots mixed --seed 1` runs the headless balance suite.
- `npm run build` generates the static site in `dist`.
- The browser entry point is `src/main.js`. The Node simulation uses the same rules as the host. Balance values live in `src/config/tunables.js`.

See TESTING.md for acceptance checks and DECISIONS.md for gameplay choices.
