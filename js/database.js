/**
 * GameDatabase — Local-first persistence with background server sync.
 *
 * localStorage is the source of truth. Every write lands in localStorage
 * immediately, then a background timer pushes unsynced data to the server.
 * If the server is unreachable, data is safe locally and syncs later.
 *
 * Local IDs are strings ("L-<timestamp>-<random>"). Once a game is created
 * on the server it receives a numeric server ID stored in sync metadata.
 */

const API_BASE = '/api';
const LS_KEY = 'chess-local-games';
const LS_IDS_KEY = 'chess-game-ids';        // legacy — kept for isOwnGame lookups
const REQUIRED_SERVER_VERSION = '1.0.0';
const SYNC_INTERVAL = 10_000;               // 10 seconds
const EVICT_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

class GameDatabase {
  constructor() {
    this._available = false;
    this._serverVersion = null;
    this._games = {};           // localId → game object (in-memory cache)
    this._syncTimer = null;
    this._syncing = false;
    this._serverIds = new Set(); // numeric server IDs (for isOwnGame)
  }

  /* ------------------------------------------------------------------ */
  /*  Initialisation                                                     */
  /* ------------------------------------------------------------------ */

  async open() {
    this._loadLocal();
    this._loadLegacyIds();

    // Health check
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this._serverVersion = data.version || null;

      const reqMajor = parseInt(REQUIRED_SERVER_VERSION.split('.')[0], 10);
      const srvMajor = parseInt((data.version || '0').split('.')[0], 10);
      this._available = srvMajor >= reqMajor;

      if (!this._available) {
        console.warn(`Chess API version mismatch: server=${data.version}, required>=${REQUIRED_SERVER_VERSION}`);
      }
    } catch (e) {
      console.warn('Chess API not available:', e);
      this._available = false;
    }

    // Start background sync
    this._syncTimer = setInterval(() => this._sync(), SYNC_INTERVAL);
    // Kick off an immediate sync
    this._sync();
  }

  get serverVersion() { return this._serverVersion; }

  /* ------------------------------------------------------------------ */
  /*  Public API — all return synchronously or with local-only Promises  */
  /* ------------------------------------------------------------------ */

  /**
   * Create a new game. Always succeeds (writes to localStorage).
   * Returns a local ID string immediately.
   */
  createGame(metadata) {
    const localId = this._generateLocalId();
    this._games[localId] = {
      localId,
      metadata: {
        gameType: metadata.gameType || 'standard',
        timeControl: metadata.timeControl || 'none',
        startingFen: metadata.startingFen,
        white: { ...metadata.white },
        black: { ...metadata.black },
      },
      moves: [],
      result: null,
      resultReason: null,
      createdAt: Date.now(),
      // Sync tracking
      serverId: null,
      syncedMoveCount: 0,
      metaSynced: false,       // true once server has latest metadata
      resultSynced: false,     // true once endGame has been synced
      playerNameDirty: null,   // { side, name } if needs sync
    };
    this._saveLocal();
    return localId;
  }

  /**
   * Record a move. Writes to local storage immediately.
   */
  addMove(localId, moveData) {
    const g = this._games[localId];
    if (!g) return;
    g.moves.push({ ...moveData });
    this._saveLocal();
  }

  /**
   * Mark a game as finished.
   */
  endGame(localId, result, reason) {
    const g = this._games[localId];
    if (!g) return;
    g.result = result;
    g.resultReason = reason || '';
    g.resultSynced = false;
    this._saveLocal();
  }

  /**
   * Update a player name.
   */
  updatePlayerName(localId, side, name) {
    const g = this._games[localId];
    if (!g) return;
    if (side === 'white') g.metadata.white.name = name;
    else g.metadata.black.name = name;
    g.playerNameDirty = { side, name };
    this._saveLocal();
  }

  /**
   * Check whether a game (by server ID) belongs to this client.
   */
  isOwnGame(id) {
    // Check in-memory server IDs
    if (this._serverIds.has(id)) return true;
    // Check games cache for matching serverId
    for (const g of Object.values(this._games)) {
      if (g.serverId === id) return true;
    }
    return false;
  }

  /**
   * Get a local game record by its local ID. Synchronous.
   * @param {string} localId
   * @returns {Object|null}
   */
  getLocalGame(localId) {
    return this._games[localId] || null;
  }

  /* ------------------------------------------------------------------ */
  /*  Read-only server queries (used by GameBrowser / ReplayViewer)      */
  /* ------------------------------------------------------------------ */

  async getGame(gameId) {
    if (!this._available) return null;
    try {
      const res = await fetch(`${API_BASE}/games/${gameId}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('Failed to get game:', e);
      return null;
    }
  }

  async listGames({ limit = 15, offset = 0 } = {}) {
    if (!this._available) return [];
    try {
      const ids = this._allServerIds();
      if (ids.length === 0) return [];
      const res = await fetch(`${API_BASE}/games/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, limit, offset }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.games;
    } catch (e) {
      console.warn('Failed to list games:', e);
      return [];
    }
  }

  async listAllGames({ limit = 15, offset = 0 } = {}) {
    if (!this._available) return [];
    try {
      const res = await fetch(`${API_BASE}/games/list-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit, offset }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.games;
    } catch (e) {
      console.warn('Failed to list all games:', e);
      return [];
    }
  }

  async getGameCount() {
    if (!this._available) return 0;
    try {
      const ids = this._allServerIds();
      if (ids.length === 0) return 0;
      const res = await fetch(`${API_BASE}/games/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, limit: 0, offset: 0 }),
      });
      if (!res.ok) return 0;
      const data = await res.json();
      return data.total;
    } catch (e) {
      console.warn('Failed to get game count:', e);
      return 0;
    }
  }

  async deleteGame(gameId) {
    if (!this._available) return;
    try {
      await fetch(`${API_BASE}/games/${gameId}`, { method: 'DELETE' });
      this._serverIds.delete(gameId);
      // Remove from local cache if it matches
      for (const [lid, g] of Object.entries(this._games)) {
        if (g.serverId === gameId) {
          delete this._games[lid];
          break;
        }
      }
      this._saveLocal();
      this._saveLegacyIds();
    } catch (e) {
      console.warn('Failed to delete game:', e);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Background Sync                                                    */
  /* ------------------------------------------------------------------ */

  async _sync() {
    if (this._syncing || !this._available) return;
    this._syncing = true;

    try {
      for (const g of Object.values(this._games)) {
        await this._syncGame(g);
      }
      this._evictOld();
      this._saveLocal();
    } catch (e) {
      console.warn('Sync error:', e);
    } finally {
      this._syncing = false;
    }
  }

  async _syncGame(g) {
    // 1. Create on server if needed
    if (g.serverId === null) {
      try {
        const res = await fetch(`${API_BASE}/games`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(g.metadata),
        });
        if (!res.ok) return; // server down — try next cycle
        const { id } = await res.json();
        g.serverId = id;
        g.metaSynced = true;
        this._serverIds.add(id);
        this._saveLegacyIds();
      } catch (e) {
        return; // network error — try next cycle
      }
    }

    // 2. Send pending moves
    const pending = g.moves.slice(g.syncedMoveCount);
    for (const move of pending) {
      try {
        const res = await fetch(`${API_BASE}/games/${g.serverId}/moves`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(move),
        });
        // 204 = new, 409 = duplicate — both count as synced
        if (res.status === 204 || res.status === 409) {
          g.syncedMoveCount++;
        } else {
          break; // unexpected status — stop sending moves for this game
        }
      } catch (e) {
        break; // network error — stop this game, try next cycle
      }
    }

    // 3. Sync player name change
    if (g.playerNameDirty && g.serverId !== null) {
      try {
        const res = await fetch(`${API_BASE}/games/${g.serverId}/player`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(g.playerNameDirty),
        });
        if (res.ok || res.status === 204) {
          g.playerNameDirty = null;
        }
      } catch (e) {
        // try next cycle
      }
    }

    // 4. Sync game result
    if (g.result !== null && !g.resultSynced && g.serverId !== null) {
      try {
        const res = await fetch(`${API_BASE}/games/${g.serverId}/end`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ result: g.result, resultReason: g.resultReason }),
        });
        if (res.ok || res.status === 204) {
          g.resultSynced = true;
        }
      } catch (e) {
        // try next cycle
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  localStorage persistence                                           */
  /* ------------------------------------------------------------------ */

  _loadLocal() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        this._games = JSON.parse(raw);
      }
    } catch (e) {
      this._games = {};
    }
  }

  _saveLocal() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(this._games));
    } catch (e) {
      // localStorage full or unavailable
    }
  }

  /** Load legacy chess-game-ids set (numeric server IDs) */
  _loadLegacyIds() {
    try {
      const stored = localStorage.getItem(LS_IDS_KEY);
      if (stored) {
        this._serverIds = new Set(JSON.parse(stored));
      }
    } catch (e) {
      this._serverIds = new Set();
    }
    // Also pull server IDs from local games
    for (const g of Object.values(this._games)) {
      if (g.serverId !== null) this._serverIds.add(g.serverId);
    }
  }

  _saveLegacyIds() {
    try {
      localStorage.setItem(LS_IDS_KEY, JSON.stringify(Array.from(this._serverIds)));
    } catch (e) {
      // localStorage full or unavailable
    }
  }

  /** Collect all known server IDs (legacy + local games) */
  _allServerIds() {
    const ids = new Set(this._serverIds);
    for (const g of Object.values(this._games)) {
      if (g.serverId !== null) ids.add(g.serverId);
    }
    return Array.from(ids);
  }

  /* ------------------------------------------------------------------ */
  /*  Eviction — remove fully-synced games older than 7 days             */
  /* ------------------------------------------------------------------ */

  _evictOld() {
    const cutoff = Date.now() - EVICT_AGE;
    for (const [lid, g] of Object.entries(this._games)) {
      if (
        g.createdAt < cutoff &&
        g.serverId !== null &&
        g.syncedMoveCount >= g.moves.length &&
        g.resultSynced !== false &&
        g.playerNameDirty === null
      ) {
        delete this._games[lid];
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  _generateLocalId() {
    const ts = Date.now();
    const rand = Math.random().toString(36).substring(2, 8);
    return `L-${ts}-${rand}`;
  }
}

export { GameDatabase };
