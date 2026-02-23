# Chess

A chess game built to practice working with Claude. Runs in the browser with a companion server for persistent game storage.

## Documentation

- [Wiki](https://github.com/bh679/Chess/wiki) — full project documentation
- [Roadmap & Project Board](https://github.com/users/bh679/projects/1) — live feature tracking
- [Agents](https://github.com/bh679/Chess/wiki/Agents) — AI agents that manage and build the project

## Features

### [Core Gameplay](https://github.com/bh679/Chess/wiki/Features)
- [**Full chess rules**](https://github.com/bh679/Chess/wiki/Feature:-Game-Rules-Engine) — powered by chess.js, supporting castling, en passant, pawn promotion, check, checkmate, stalemate, insufficient material, threefold repetition, and 50-move rule
- [**Chess960 (Fischer Random Chess)**](https://github.com/bh679/Chess/wiki/Feature:-Chess960) — randomized starting positions with bishops on opposite colors and king between rooks, enabled by default
- [**Click and drag-to-move**](https://github.com/bh679/Chess/wiki/Feature:-Chess-Board) — select a piece by clicking or drag it to a target square (mouse and touch supported)
- [**Legal move highlighting**](https://github.com/bh679/Chess/wiki/Feature:-Chess-Board) — selected pieces show available moves and captures
- [**Pawn promotion modal**](https://github.com/bh679/Chess/wiki/Feature:-Piece-Promotion) — choose between queen, rook, bishop, or knight
- [**Last move highlighting**](https://github.com/bh679/Chess/wiki/Feature:-Move-Animations) — the most recent move is highlighted on the board
- [**Premoves**](https://github.com/bh679/Chess/wiki/Feature:-Premoves) — queue a move during the opponent's turn that executes instantly when your turn begins (settings toggle, default off)

### [AI Opponents](https://github.com/bh679/Chess/wiki/Feature:-AI-Opponents)
- [**Stockfish WASM engine**](https://github.com/bh679/Chess/wiki/Feature:-AI-Opponents) — full Stockfish chess engine running as a Web Worker
- [**Independent AI per side**](https://github.com/bh679/Chess/wiki/Feature:-AI-Opponents) — enable AI for white, black, or both independently
- [**ELO-based difficulty**](https://github.com/bh679/Chess/wiki/Feature:-AI-Opponents) — adjustable from 100 to 3200 ELO per side using Skill Level (low ELO) and UCI_LimitStrength (high ELO)
- [**AI vs AI mode**](https://github.com/bh679/Chess/wiki/Feature:-AI-vs-AI) — watch two engines play against each other at different strengths
- [**Deferred start**](https://github.com/bh679/Chess/wiki/Feature:-AI-Opponents) — when AI plays white, a Start button appears so you can configure settings first

### [Interactive Player Bars](https://github.com/bh679/Chess/wiki/Feature:-Player-Configuration)
- [**Player info display**](https://github.com/bh679/Chess/wiki/Feature:-Player-Configuration) — shows player name, ELO (for AI), type icon, and timer for each side
- [**Click icon to toggle AI**](https://github.com/bh679/Chess/wiki/Feature:-Player-Configuration) — click the player icon (pre-game) to switch between Human and AI
- [**Click ELO to adjust**](https://github.com/bh679/Chess/wiki/Feature:-Player-Configuration) — click the ELO label (pre-game) to open an inline slider popup
- [**Click timer to change time**](https://github.com/bh679/Chess/wiki/Feature:-Player-Configuration) — click either timer (pre-game) for a time control dropdown
- [**Editable player names**](https://github.com/bh679/Chess/wiki/Feature:-Player-Configuration) — click any player name to rename it (works anytime, persists to database)

### [Timers](https://github.com/bh679/Chess/wiki/Feature:-Time-Controls)
- [**Preset time controls**](https://github.com/bh679/Chess/wiki/Feature:-Time-Controls) — Bullet 1+0, Blitz 3+2, Rapid 5+0, Rapid 10+0, Classical 30+0
- [**Custom time control**](https://github.com/bh679/Chess/wiki/Feature:-Time-Controls) — set minutes per side and increment, with optional different time per player (time odds)
- [**Timeout detection**](https://github.com/bh679/Chess/wiki/Feature:-Time-Controls) — automatic win on time with visual indicator

### [Art Styles](https://github.com/bh679/Chess/wiki/Feature:-Art-Styles)
- [**Classic**](https://github.com/bh679/Chess/wiki/Feature:-Art-Styles) — traditional SVG chess pieces
- [**Pixel**](https://github.com/bh679/Chess/wiki/Feature:-Art-Styles) — pixel art style
- [**Neo**](https://github.com/bh679/Chess/wiki/Feature:-Art-Styles) — bold modern style
- [**Fish**](https://github.com/bh679/Chess/wiki/Feature:-Art-Styles) — fish/sea creature themed pieces

### [Animations](https://github.com/bh679/Chess/wiki/Feature:-Combat-Animations)
- [**Move animations**](https://github.com/bh679/Chess/wiki/Feature:-Move-Animations) — smooth piece movement with easing
- [**Combat animations**](https://github.com/bh679/Chess/wiki/Feature:-Combat-Animations) — unique per-piece capture animations (pawn thrust, knight leap, bishop slash, rook crush, queen spin, king sword swing)
- [**Enhanced combat effects**](https://github.com/bh679/Chess/wiki/Feature:-Combat-Animations) — screen shake, impact flashes, and particle systems
- [**Animation toggle**](https://github.com/bh679/Chess/wiki/Feature:-Combat-Animations) — turn all animations on/off

### [Game Database & History](https://github.com/bh679/Chess/wiki/Feature:-Local-Storage)
- [**Local-first persistence**](https://github.com/bh679/Chess/wiki/Feature:-Local-Storage) — all game data (moves, results, metadata) is written to localStorage immediately and never blocks gameplay; a background sync timer pushes data to the server every 10 seconds
- [**Offline resilience**](https://github.com/bh679/Chess/wiki/Feature:-Local-Storage) — if the server is down, games are fully preserved locally and sync automatically when connectivity returns
- [**Idempotent sync**](https://github.com/bh679/Chess/wiki/Feature:-Server-Sync) — duplicate moves are safely deduplicated via server-side UNIQUE constraints; partial syncs resume from where they left off
- [**Server-side storage**](https://github.com/bh679/Chess/wiki/Feature:-Server-Sync) — synced games are stored via REST API in a SQLite database (see [chess-api](https://github.com/bh679/chess-api))
- [**Game history browser**](https://github.com/bh679/Chess/wiki/Feature:-Game-Browser) — browse past games with player info, results, and move counts
- [**Replay viewer**](https://github.com/bh679/Chess/wiki/Feature:-Replay-Viewer) — step through any saved game move by move with:
  - Reconstructed board positions
  - Horizontal move strip with scroll navigation
  - Reconstructed clock display from move timestamps
  - Playback controls (play/pause, step forward/back, jump to start/end)
  - Keyboard navigation (arrow keys, space for play/pause)
- [**URL routing**](https://github.com/bh679/Chess/wiki/Feature:-URL-Routing) — shareable hash-based URLs for game views (`/#/replay?gameid=42`, `/#/games`, `/#/history`, `/#/live`); URL updates live as you navigate with no page refresh; path-based URLs redirect to hash equivalents

### [Analysis](https://github.com/bh679/Chess/wiki/Feature:-Board-Analysis)
- [**Post-game summary**](https://github.com/bh679/Chess/wiki/Feature:-Post-Game-Summary) — chess.com-style summary screen with win-probability-based per-player accuracy and 10 move classification types (Brilliant, Great, Best, Excellent, Good, Book, Inaccuracy, Mistake, Miss, Blunder); auto-triggers after every game, also available via "Game Summary" button in replay mode
- [**Board analysis**](https://github.com/bh679/Chess/wiki/Feature:-Board-Analysis) — Stockfish-powered position evaluation with move classification arrows and accuracy percentages

### [Automation](https://github.com/bh679/Chess/wiki/Blogging-Agent)
- [**Weekly blog**](https://github.com/bh679/Chess/wiki/Blogging-Agent) — automated weekly development blog posts generated via GitHub Actions and the Anthropic API; publishes to `blog/` directory every Monday

### [User Accounts](https://github.com/bh679/Chess/wiki/Feature:-User-Accounts)
- **Local auth** — register and sign in with username/password (bcrypt hashing, JWT tokens)
- **User profile** — view Glicko-2 ratings (Bullet/Blitz/Rapid/Classical), game history with full filters (result, player type, game type, time control, elo range)
- **Clickable game rows** — click any game in your profile to replay it
- **Friends system** — add friends, accept/reject requests, view friend list
- **Settings sync** — user settings persist across sessions via the server
- **Game claiming** — games are linked to your account at creation; pre-login games are batch claimed on sign-in

### UI
- [**Captured pieces display**](https://github.com/bh679/Chess/wiki/Feature:-Captured-Pieces) — shows captured pieces with material advantage indicators
- [**Responsive layout**](https://github.com/bh679/Chess/wiki/Feature:-Responsive-Design) — works on desktop and mobile
- [**Settings panel**](https://github.com/bh679/Chess/wiki/Feature:-Settings-Panel) — collapsible panel with all game configuration options
- [**Archive menu**](https://github.com/bh679/Chess/wiki/Feature:-Archive-Browser) — dynamic archive discovery with navigation between versions; opens in new tab from main app, same tab within archives

## Roadmap

See the [project roadmap](https://github.com/bh679/Chess/wiki/Roadmap) for planned features, priorities, and status tracking.

## Dependencies

### Server (required for game history)

The game database runs on a separate Node.js server: **[chess-api](https://github.com/bh679/chess-api)**

The client uses a local-first architecture: all game data is written to localStorage immediately and synced to the server in the background. If the server is unreachable, games are fully preserved locally and sync when connectivity returns. The game history browser and replay viewer require server connectivity to fetch past games.

| Dependency | Version | Purpose |
|------------|---------|---------|
| chess-api server | >= 1.10.0000 | Game storage REST API (SQLite) |
| Apache mod_proxy | any | Proxies `/api/*` to the Node.js server |

### Client-side (bundled, no install needed)

| Library | Purpose |
|---------|---------|
| chess.js | Chess rules engine |
| Stockfish WASM | AI opponent (Web Worker) |

## Getting Started

No build step or install needed. Open `index.html` in a browser or serve the directory with any static file server:

```bash
npx serve .
# or
python3 -m http.server
```

For full functionality (game saving and history), set up the [chess-api](https://github.com/bh679/chess-api) server and configure Apache to proxy `/api` requests.

## Project Structure

```
index.html              Main HTML page
css/style.css           Board and UI styles
css/combat-enhanced.css Combat animation effects (shake, flash, particles)
js/app.js               App entry point, game flow, player bar controls
js/game.js              Game state wrapper around chess.js
js/board.js             Board rendering, click/drag interaction, promotion UI
js/combat.js            Combat animation system for captures
js/timer.js             Chess timer with increment support
js/ai.js                Stockfish WASM integration via Web Worker (UCI protocol)
js/database.js          Local-first game persistence with background server sync
js/browser.js           Game history browser UI
js/analysis.js          Post-game position analysis, 10-type move classification
js/post-game-summary.js Post-game summary modal (accuracy, classification grid)
js/auth.js              Auth service (register, login, logout, JWT, batch claim)
js/auth-ui.js           Sign-in/register modals, user badge with dropdown
js/profile.js           Profile modal with ratings and filtered game list
js/friends.js           Friends modal (add, accept, reject, remove)
js/replay.js            Replay viewer with board, move strip, and clock reconstruction
js/chess.js             chess.js engine (full rule enforcement)
js/lib/stockfish.js     Stockfish WASM engine (Web Worker)
blog/                   Weekly development blog (auto-generated)
img/pieces/             Classic SVG chess pieces
img/pieces-pixel/       Pixel art chess pieces
img/pieces-neo/         Neo bold chess pieces
img/pieces-fish/        Fish/sea creature chess pieces
```
