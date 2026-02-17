# Live Spectating Tab

## Overview
Add a **"Live"** tab to the game browser that lists all in-progress games on the server. Clicking a live game opens a spectating view that starts from the **current position** (not the beginning) and receives new moves in real-time.

## Server Changes

### 1. New endpoint: `GET /api/games/live`
Returns all games that have no `end_time` (still in progress) and have at least 1 move.

```json
{
  "games": [
    {
      "id": 42,
      "startTime": 1708000000000,
      "gameType": "standard",
      "timeControl": "5+0",
      "white": { "name": "Player", "isAI": false, "elo": null },
      "black": { "name": "Stockfish 17", "isAI": true, "elo": 1500 },
      "moveCount": 14,
      "lastMoveSan": "Nf3",
      "lastMoveTime": 1708000042000
    }
  ]
}
```

### 2. New endpoint: `GET /api/games/:id/moves?since=<ply>`
Returns moves for a game starting after the given ply number. Used for polling new moves during spectating.

```json
{
  "moves": [
    { "ply": 15, "san": "Bb5", "fen": "...", "timestamp": 1708000045000, "side": "white" }
  ],
  "gameOver": false,
  "result": null
}
```

### 3. Database queries (`db.js`)
- `listLiveGames()` — `SELECT * FROM games WHERE end_time IS NULL AND (SELECT COUNT(*) FROM moves WHERE game_id = games.id) >= 1 ORDER BY start_time DESC`
- `getMovesSince(gameId, afterPly)` — `SELECT * FROM moves WHERE game_id = ? AND ply > ? ORDER BY ply`
- `isGameOver(gameId)` — Check if `end_time IS NOT NULL`, return result info

## Client Changes

### 1. Database client (`database.js`)
- `listLiveGames()` — `GET /api/games/live`
- `getMovesSince(gameId, afterPly)` — `GET /api/games/:id/moves?since=<ply>`

### 2. Game browser (`browser.js`)
- Add a third tab: **"Live"** between "Public" and (or after) existing tabs
- `_activeTab` gains a third value: `'live'`
- Live tab list shows games with a "watching" indicator (e.g. move count updating)
- Live tab auto-refreshes the game list every ~10 seconds
- Clicking a live game opens the spectating viewer instead of the replay viewer

### 3. New: Spectating viewer (`spectator.js`)
A lightweight viewer similar to `ReplayViewer` but designed for live games:

- Opens with the **full current game state** (loads all moves, jumps to latest position)
- Polls `GET /api/games/:id/moves?since=<lastPly>` every 2-3 seconds
- Appends new moves to the move list and auto-advances the board
- When the game ends (server returns `gameOver: true`), stops polling and shows result
- User can scroll back through moves but new moves keep arriving
- Shows "LIVE" indicator while game is in progress
- No move input allowed (read-only board)

### 4. CSS
- `.browser-tab` styling already supports 3+ tabs (flex: 1)
- Live indicator dot/badge on the "Live" tab when games are available
- Pulsing "LIVE" badge in spectator view

## Polling vs WebSockets
**Start with polling** for simplicity:
- Game list: poll every 10s while Live tab is active
- Move stream: poll every 2-3s while spectating
- Stop all polling when modal/viewer is closed

**Future upgrade path to WebSockets:**
- Server sends move events via `ws://` connection
- Eliminates polling overhead and gives instant updates
- Would require adding `ws` package to chess-api

## Implementation Order
1. Server: Add `listLiveGames()` and `getMovesSince()` to `db.js`
2. Server: Add `GET /api/games/live` and `GET /api/games/:id/moves?since=` routes
3. Client: Add `listLiveGames()` and `getMovesSince()` to `database.js`
4. Client: Add "Live" tab to `browser.js`
5. Client: Build `spectator.js` viewer
6. Client: Wire up polling and tab auto-refresh
7. CSS: Live indicators and spectator styles
8. Test end-to-end with two browser windows

## Edge Cases
- Game ends while user is on the Live tab list → remove from list on next refresh
- Game ends while spectating → show result, stop polling, offer "Review from start"
- No live games → show "No games in progress" message
- Spectator opens game that already ended → redirect to replay viewer
- Network hiccup during polling → silent retry, don't break UI
