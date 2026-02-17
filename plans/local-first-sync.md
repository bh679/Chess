# Plan: Local-First Game Persistence with Server Sync

## Context
When a move's API call fails (network hiccup, server down), the move is silently lost from the server record. Worse, if `createGame` fails, `currentDbGameId` stays `null` and **all** writes for that game are skipped — the whole game is lost.

Instead of a write-retry queue (complex, throwaway when multiplayer arrives), we adopt a **local-first** approach: every write saves to localStorage immediately, then syncs to the server. The local copy is always the source of truth during gameplay. This naturally extends to multiplayer (reconnection = "sync from ply N").

## Design Overview

```
app.js → database.js → localStorage (immediate, never fails)
                      → server API   (async, best-effort, retried)
```

Every `createGame`, `addMove`, `endGame`, `updatePlayerName` call:
1. Writes to localStorage **first** (instant, reliable)
2. Attempts the server API call (fire-and-forget)
3. If the API call fails, the data is already safe locally
4. A background sync process periodically pushes unsynced local data to the server

## localStorage Schema

Key: `chess-local-games`
Value: JSON object mapping local game IDs → game records:

```js
{
  "local_1": {
    metadata: { gameType, timeControl, startingFen, white, black },
    moves: [ { ply, san, fen, timestamp, side }, ... ],
    result: null | { result, reason },
    startTime: 1708000000000,
    serverId: null | 42,       // null = not yet synced to server
    syncedMoveCount: 0,        // how many moves the server has
    syncedResult: false,       // whether endGame has been synced
    syncedMetadata: false      // whether player name updates are synced
  }
}
```

## Files to Modify

### 1. `js/database.js` — Core changes

**New constants:**
```js
const LS_GAMES_KEY = 'chess-local-games';
const SYNC_INTERVAL = 10000; // 10s
const MAX_LOCAL_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
```

**New constructor properties:**
- `_localGames = {}` — the in-memory local game store
- `_syncTimer = null` — interval for background sync
- `_syncing = false` — prevents concurrent syncs

**New private methods:**
- `_loadLocal()` / `_saveLocal()` — localStorage round-trip for `_localGames`, evicts entries older than 7 days that are fully synced
- `_generateLocalId()` — returns `'local_' + Date.now() + random`
- `_sync()` — the background sync loop (see below)
- `_syncGame(localId, game)` — syncs a single game: creates on server if no `serverId`, sends unsynced moves, sends result
- `_startSync()` / `_stopSync()` — timer management

**Modified `open()`:**
- Load `_localGames` from localStorage
- After health check, if server available and local games have unsynced data, start sync timer + immediate sync

**Modified `createGame(metadata)`:**
- Always creates a local record first, returns the local ID immediately (never `null`)
- Attempts `POST /api/games` in the background
- On success: sets `serverId` in local record, persists
- On failure: no problem, sync will retry later

**Modified `addMove(gameId, moveData)`:**
- Appends to `_localGames[gameId].moves` immediately, persists
- If `serverId` is known, attempts `POST /api/games/{serverId}/moves` in background
- On failure: no problem, `syncedMoveCount` stays behind, sync will catch up

**Modified `endGame(gameId, result, reason)`:**
- Sets `_localGames[gameId].result = { result, reason }` immediately, persists
- If `serverId` is known, attempts `PATCH /api/games/{serverId}/end` in background
- On failure: sync will retry

**Modified `updatePlayerName(gameId, side, name)`:**
- Updates `_localGames[gameId].metadata.white/black.name` immediately, persists
- Sets `syncedMetadata = false`, persists
- If `serverId` is known, attempts `PATCH /api/games/{serverId}/player` in background
- On failure: sync will retry

**`_sync()` method:**
```
For each local game with unsynced data:
  1. If no serverId → POST /api/games to create it, store serverId
  2. If syncedMoveCount < moves.length → POST each unsynced move
  3. If result exists && !syncedResult → PATCH /api/games/{id}/end
  4. If !syncedMetadata → PATCH /api/games/{id}/player
  Stop on first network error (server is probably down)
```

**Read methods (`getGame`, `listGames`, etc.) — unchanged.** They still read from the server. The local store is only for write durability, not for reads. (Future: could fall back to local for offline browsing.)

### 2. `js/app.js` — Minimal changes

**`createGame` call:**
- `createGame` now always returns a local ID (never `null`), so `.catch` setting `currentDbGameId = null` is removed
- `currentDbGameId` is always set

**`addMove`/`endGame`/`updatePlayerName` calls:**
- The `if (currentDbGameId !== null)` guards remain but now always pass (since `createGame` never returns `null`)
- No other changes needed — the method signatures are the same

### 3. Server `chess-api/db.js` — Idempotent moves

Even with local-first, the sync process may retry moves that already succeeded. We need the server to handle duplicates safely.

- Add `UNIQUE(game_id, ply)` index (with one-time dedup cleanup):
  ```sql
  DELETE FROM moves WHERE id NOT IN (SELECT MIN(id) FROM moves GROUP BY game_id, ply);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_moves_game_ply ON moves(game_id, ply);
  ```
- Change `addMove()` to `INSERT OR IGNORE`, return `info.changes`

### 4. Server `chess-api/routes/games.js` — 409 on duplicate

- `POST /games/:id/moves`: return 204 on insert, 409 on duplicate
- Client sync treats both as success

### 5. Cache busters
- `app.js`: bump `database.js?v=N`
- `index.html`: bump `app.js?v=N`

## Implementation Order
1. Server `db.js` — dedup cleanup + UNIQUE index + INSERT OR IGNORE
2. Server `routes/games.js` — 409 on duplicate move
3. Restart pm2, test with curl
4. Client `database.js` — local store infrastructure + modify all write methods + sync loop
5. Client `app.js` — remove `.catch` on `createGame`, bump cache busters
6. Version bump + cache busters in `index.html`
7. Test in browser, commit, push

## Verification
1. **Normal flow:** Start game → make moves → check localStorage has local record → check server has matching data
2. **Server down:** Block API in DevTools → start game → make moves → verify localStorage has everything → unblock → wait for sync → verify server catches up
3. **Mid-game failure:** Make 5 moves (server gets them) → block API → make 5 more → unblock → sync sends only the missing 5
4. **Page reload:** Block API → play game → reload → verify local data persists → unblock → sync resumes
5. **Idempotent moves:** curl same move twice → 204 then 409, only one DB row

## Why Local-First over Write Queue
- **Simpler:** No temp IDs, no URL rewriting, no FIFO ordering concerns
- **More resilient:** Data is safe the instant it's written, not "queued for retry"
- **Multiplayer-ready:** Reconnection = "I have N moves, send me the rest" — same sync pattern
- **One bulk sync** instead of replaying N individual HTTP calls
