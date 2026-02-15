# Chess

A client-side chess game that runs entirely in the browser with no server or dependencies required. Built to practice working with Claude.

## Features

- **Full chess rules** — powered by chess.js, supporting all standard rules including castling, en passant, and pawn promotion
- **Click and drag-to-move** — select a piece by clicking or drag it to a target square (mouse and touch supported)
- **Legal move highlighting** — selected pieces show available moves and captures
- **Check and checkmate detection** — visual indicator on the king when in check, with automatic game-over detection
- **Draw detection** — stalemate, insufficient material, and threefold repetition
- **Pawn promotion modal** — choose between queen, rook, bishop, or knight when promoting
- **Last move highlighting** — the most recent move is highlighted on the board
- **New game button** — reset the board at any time
- **Responsive layout** — works on desktop and mobile

## Getting Started

No build step or install needed. Open `index.html` in a browser or serve the directory with any static file server:

```bash
npx serve .
# or
python3 -m http.server
```

## Project Structure

```
index.html          — Main HTML page
css/style.css       — Board and UI styles
js/app.js           — App entry point, wires up game and board
js/game.js          — Game state wrapper around chess.js
js/board.js         — Board rendering, click/drag interaction, promotion UI
js/chess.js         — chess.js engine (full rule enforcement)
img/pieces/         — SVG chess piece assets (12 files)
```
