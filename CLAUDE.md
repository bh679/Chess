# Chess Client

## Project Overview

- **Repo:** [`bh679/chess-client`](https://github.com/bh679/chess-client)
- **Type:** Static site — HTML, CSS, vanilla JavaScript (no framework, no build step)
- **Hosted at:** `brennan.games/chess/`
- **Game state:** Stored in `localStorage`, synced to a REST API ([chess-api](https://github.com/bh679/chess-api)) in the background
- **Wiki:** [Chess wiki](https://github.com/bh679/chess-client/wiki) — feature plans, roadmap, architecture docs

## Protected Files (do not modify)
- `js/chess.js` — third-party chess rules engine
- `js/lib/stockfish.js` — third-party Stockfish WASM engine

## Project Structure
- `index.html` — main page, loads `js/app.js` as an ES module
- `js/` — one class per file, ES modules with `import`/`export`
- `css/` — stylesheets
- `img/pieces-*/` — art style directories (SVGs per piece)

## Architecture

### No Build Step
Files are served directly — no bundler, no transpiler, no npm scripts. ES modules are used natively in the browser. Just edit and reload.

### Module Pattern
`index.html` loads a single entry point: `<script type="module" src="js/app.js">`. All other modules are imported via ES `import` statements. Each JS file exports a class and imports what it needs from other modules.

### Key Modules
| File | Purpose |
|------|---------|
| `js/app.js` | Entry point — imports and initialises all modules |
| `js/game.js` | Core game state, moves, captures, Chess960 position generation |
| `js/board.js` | Board rendering, piece selection, dragging, legal move display, premoves |
| `js/ai.js` | Stockfish WASM integration via Web Worker, ELO-based difficulty |
| `js/analysis.js` | Post-game position analysis, move classification by centipawn loss |
| `js/arrows.js` | SVG overlay for engine best-move arrows and user highlights |
| `js/eval-bar.js` | Vertical evaluation bar (centipawn / mate display) |
| `js/timer.js` | Chess clock with configurable time control and increment |
| `js/combat.js` | Sprite-sheet capture animations |
| `js/database.js` | localStorage persistence and background API sync |
| `js/browser.js` | Past games browser modal (My Games / Public tabs) |
| `js/replay.js` | Game replay overlay with playback controls and analysis |

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

## Branching

- Use `dev/<feature-slug>` branch naming convention
- Work in a git worktree (see the project-level CLAUDE.md for worktree setup)
- The Product Engineer agent creates PRs and merges after user approval
- Keep changes focused — one feature per branch

## Commit & Versioning Rules

- **Version format:** V.MM.PPPP (Version.Major.Patch)
  - V = user only. Never change this.
  - MM = bump on every feature merge to main. Resets PPPP.
  - PPPP = bump on every commit. Resets when MM bumps.
- Read current version from `package.json`, bump appropriately, write back, include in commit.
- **Commit messages:** `<type>: <short description>` — types: feat, fix, refactor, style, docs, test, chore, version
  - Optional scope: `feat(timer): add increment support`
  - Use `!` for breaking changes: `feat!: redesign API response format`
- First line under 72 chars, imperative mood, no generic messages.
- Reference the GitHub Issue: `Closes #<issue-number>` (not wiki links — they don't resolve in commit views)
- **On major bump (feature merge):**
  - Update README.md — add feature to Features section, update Project Structure and Dependencies if changed
  - Create a git tag: `git tag v<version>` (e.g., `git tag v1.02.0000`) and push it: `git push origin --tags`

## Testing

- **Dev server:** chess-api serves client static files via `CLIENT_DIR` env var (see project-level CLAUDE.md for setup)
- **Playwright:** Use headless browser tests with screenshot analysis for UI verification
- **Manual checks:** Verify page loads without console errors, core gameplay works, new feature behaves as expected
- For UI changes: test on both desktop and mobile viewport sizes

## Rules

- **Preserve local-first architecture** — always write to localStorage first, sync to server asynchronously
- **No new dependencies** without explicit approval in the issue — this is a zero-dependency static site (chess.js and Stockfish are bundled)
- **Match existing code style** — vanilla JS, no classes (except where already used), DOM manipulation via `document.querySelector`
- **Keep it simple** — no build tools, no frameworks, no package managers for client code
