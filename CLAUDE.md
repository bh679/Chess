# Dev Agent — Chess Client

You are the Dev Agent for the Chess client. Implement features, fix bugs, and open PRs as instructed by GitHub Issues.

## Project Overview

- **Repo:** [`bh679/Chess`](https://github.com/bh679/Chess)
- **Type:** Static site — HTML, CSS, vanilla JavaScript (no framework, no build step)
- **Hosted at:** `brennan.games/chess/`
- **Game state:** Stored in `localStorage`, synced to a REST API ([chess-api](https://github.com/bh679/chess-api)) in the background
- **Wiki:** [Chess wiki](https://github.com/bh679/Chess/wiki) — feature plans, roadmap, architecture docs

## Key Files

| File | Purpose |
|------|---------|
| `index.html` | Main page — loads all JS/CSS, contains board container and UI panels |
| `js/app.js` | App entry point — game flow, player bar controls, settings panel |
| `js/game.js` | Game state wrapper around chess.js (turn management, move validation) |
| `js/board.js` | Board rendering, click/drag interaction, promotion UI, legal move highlights |
| `js/combat.js` | Combat animation system for captures (per-piece animations, effects) |
| `js/timer.js` | Chess timer with increment support, timeout detection |
| `js/ai.js` | Stockfish WASM integration via Web Worker (UCI protocol) |
| `js/database.js` | Local-first game persistence — localStorage writes + background server sync |
| `js/browser.js` | Game history browser UI (list, filters, metadata display) |
| `js/replay.js` | Replay viewer — board reconstruction, move strip, clock, playback controls |
| `js/chess.js` | chess.js engine — full rule enforcement (do not modify unless updating the library) |
| `js/lib/stockfish.js` | Stockfish WASM engine (Web Worker, do not modify) |
| `css/style.css` | Board and UI styles |
| `css/combat-enhanced.css` | Combat animation effects (shake, flash, particles) |
| `img/pieces/` | Classic SVG chess pieces |
| `img/pieces-pixel/` | Pixel art chess pieces |
| `img/pieces-neo/` | Neo bold chess pieces |
| `img/pieces-fish/` | Fish/sea creature chess pieces |

## Architecture

### No Build Step
Files are served directly — no bundler, no transpiler, no npm scripts. Just edit and reload.

### Module Pattern
Each JS file is a self-contained module loaded via `<script>` tags in `index.html`. They communicate through shared global state and DOM events. Load order matters — `chess.js` must load before `game.js`, etc.

### Local-First Persistence
All game data (moves, results, metadata) is written to `localStorage` immediately and never blocks gameplay. A background sync timer pushes data to the server API every 10 seconds. If the server is unreachable, games are preserved locally and sync when connectivity returns. Duplicate moves are deduplicated server-side via UNIQUE constraints.

### Server API
The client talks to `chess-api` via REST endpoints under `/api/`. In production, Apache proxies `/api/*` to the Node.js server. Key endpoints:
- `POST /api/games` — create a new game
- `GET /api/games` — list games (paginated)
- `GET /api/games/:id` — get game details
- `PUT /api/games/:id` — update game metadata
- `POST /api/games/:id/moves` — record moves
- `PUT /api/games/:id/result` — record game result

### Art Styles
Piece images are in `img/pieces-<style>/` directories. Each contains SVGs for all pieces (wK.svg, bQ.svg, etc.). The board renders pieces by setting `background-image` to the appropriate path.

## Branching & PRs

- Create a feature branch: `dev/<feature-slug>` (e.g., `dev/evaluation-bar`)
- Open a PR from `dev/<feature-slug>` → `main`
- Reference the GitHub Issue in the PR description
- Keep PRs focused — one feature per PR

## Commit & Versioning Rules

- **Version format:** V.MM.PPPP (Version.Major.Patch)
  - V = user only. Never change this.
  - MM = bump on every feature merge to main. Resets PPPP.
  - PPPP = bump on every commit. Resets when MM bumps.
- Read current version from `package.json`, bump appropriately, write back, include in commit.
- **Commit messages:** `<type>: <short description>` — types: feat, fix, refactor, style, docs, test, chore, version
- First line under 72 chars, imperative mood, no generic messages.
- Reference the wiki page for feature work: `See: [[Feature Name]]`
- **On major bump (feature merge):** update README.md — add feature to Features section, update Project Structure and Dependencies if changed.

## Testing

- No automated test framework — this is a static site
- Test manually in the browser after changes
- Verify: page loads without console errors, core gameplay works, new feature behaves as described in the issue
- For UI changes: test on both desktop and mobile viewport sizes

## Rules

- **Never modify** `js/chess.js` or `js/lib/stockfish.js` — these are third-party libraries
- **Preserve local-first architecture** — always write to localStorage first, sync to server asynchronously
- **No new dependencies** without explicit approval in the issue — this is a zero-dependency static site (chess.js and Stockfish are bundled)
- **Match existing code style** — vanilla JS, no classes (except where already used), DOM manipulation via `document.querySelector`
- **Keep it simple** — no build tools, no frameworks, no package managers for client code
