# Chess

A client-side chess game that runs entirely in the browser with no server or dependencies required. Built to practice working with Claude.

## Features

### Core Gameplay
- **Full chess rules** — powered by chess.js, supporting castling, en passant, pawn promotion, check, checkmate, stalemate, insufficient material, threefold repetition, and 50-move rule
- **Chess960 (Fischer Random Chess)** — randomized starting positions with bishops on opposite colors and king between rooks, enabled by default
- **Click and drag-to-move** — select a piece by clicking or drag it to a target square (mouse and touch supported)
- **Legal move highlighting** — selected pieces show available moves and captures
- **Pawn promotion modal** — choose between queen, rook, bishop, or knight
- **Last move highlighting** — the most recent move is highlighted on the board

### AI Opponents
- **Stockfish WASM engine** — full Stockfish chess engine running as a Web Worker
- **Independent AI per side** — enable AI for white, black, or both independently
- **ELO-based difficulty** — adjustable from 100 to 3200 ELO per side using Skill Level (low ELO) and UCI_LimitStrength (high ELO)
- **AI vs AI mode** — watch two engines play against each other at different strengths
- **Deferred start** — when AI plays white, a Start button appears so you can configure settings first

### Interactive Player Bars
- **Player info display** — shows player name, ELO (for AI), type icon, and timer for each side
- **Click icon to toggle AI** — click the player icon (pre-game) to switch between Human and AI
- **Click ELO to adjust** — click the ELO label (pre-game) to open an inline slider popup
- **Click timer to change time** — click either timer (pre-game) for a time control dropdown
- **Editable player names** — click any player name to rename it (works anytime, persists to database)

### Timers
- **Preset time controls** — Bullet 1+0, Blitz 3+2, Rapid 5+0, Rapid 10+0, Classical 30+0
- **Custom time control** — set minutes per side and increment, with optional different time per player (time odds)
- **Timeout detection** — automatic win on time with visual indicator

### Art Styles
- **Classic** — traditional SVG chess pieces
- **Pixel** — pixel art style
- **Neo** — bold modern style
- **Fish** — fish/sea creature themed pieces

### Animations
- **Move animations** — smooth piece movement with easing
- **Combat animations** — unique per-piece capture animations (pawn thrust, knight leap, bishop slash, rook crush, queen spin, king sword swing)
- **Enhanced combat effects** — screen shake, impact flashes, and particle systems
- **Animation toggle** — turn all animations on/off

### Game Database & History
- **Automatic game saving** — all games saved to IndexedDB with moves, timestamps, and results
- **Game history browser** — browse past games with player info, results, and move counts
- **Replay viewer** — step through any saved game move by move with:
  - Reconstructed board positions
  - Horizontal move strip with scroll navigation
  - Reconstructed clock display from move timestamps
  - Playback controls (play/pause, step forward/back, jump to start/end)
  - Keyboard navigation (arrow keys, space for play/pause)

### UI
- **Captured pieces display** — shows captured pieces with material advantage indicators
- **Responsive layout** — works on desktop and mobile
- **Settings panel** — collapsible panel with all game configuration options
- **Archive menu** — dynamic archive discovery with navigation between versions; opens in new tab from main app, same tab within archives

## Roadmap

See [TODO.md](TODO.md) for planned features and ideas.

## Getting Started

No build step or install needed. Open `index.html` in a browser or serve the directory with any static file server:

```bash
npx serve .
# or
python3 -m http.server
```

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
js/database.js          IndexedDB persistence layer for game records
js/browser.js           Game history browser UI
js/replay.js            Replay viewer with board, move strip, and clock reconstruction
js/chess.js             chess.js engine (full rule enforcement)
js/lib/stockfish.js     Stockfish WASM engine (Web Worker)
img/pieces/             Classic SVG chess pieces
img/pieces-pixel/       Pixel art chess pieces
img/pieces-neo/         Neo bold chess pieces
img/pieces-fish/        Fish/sea creature chess pieces
```
