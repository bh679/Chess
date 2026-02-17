/**
 * GameDatabase — Server-side persistence via REST API.
 * Game IDs are tracked in localStorage so the client knows which games belong to it.
 * All methods return Promises. Writes are fire-and-forget (never block game flow).
 */

const API_BASE = '/api';
const LS_KEY = 'chess-game-ids';
const REQUIRED_SERVER_VERSION = '1.0.0';

class GameDatabase {
  constructor() {
    this._available = false;
    this._serverVersion = null;
    this._gameIds = new Set();
  }

  /**
   * Load stored game IDs from localStorage and check server availability.
   * Verifies server version matches the required minimum.
   */
  async open() {
    // Load tracked game IDs from localStorage
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) {
        this._gameIds = new Set(JSON.parse(stored));
      }
    } catch (e) {
      this._gameIds = new Set();
    }

    // Health check — verify server is reachable and version-compatible
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this._serverVersion = data.version || null;

      // Compare major version — client and server must agree on major
      const reqMajor = parseInt(REQUIRED_SERVER_VERSION.split('.')[0], 10);
      const srvMajor = parseInt((data.version || '0').split('.')[0], 10);
      if (srvMajor < reqMajor) {
        console.warn(`Chess API version mismatch: server=${data.version}, required>=${REQUIRED_SERVER_VERSION}`);
        this._available = false;
      } else {
        this._available = true;
      }
    } catch (e) {
      console.warn('Chess API not available:', e);
      this._available = false;
    }
  }

  /** @returns {string|null} Server version string, or null if not connected */
  get serverVersion() { return this._serverVersion; }

  /** @returns {boolean} Whether the given game ID belongs to this client */
  isOwnGame(id) { return this._gameIds.has(id); }

  /**
   * Insert a new game record. Returns the server-assigned id.
   * @param {Object} metadata - { gameType, timeControl, startingFen, white, black }
   *   white/black: { name: String, isAI: Boolean, elo: Number|null }
   */
  async createGame(metadata) {
    if (!this._available) return null;

    try {
      const res = await fetch(`${API_BASE}/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { id } = await res.json();
      // Track this game ID locally
      this._gameIds.add(id);
      this._saveIds();
      return id;
    } catch (e) {
      console.warn('Failed to create game:', e);
      return null;
    }
  }

  /**
   * Add a move to a game.
   * @param {Number} gameId
   * @param {Object} moveData - { ply, san, fen, timestamp, side }
   */
  async addMove(gameId, moveData) {
    if (!this._available || gameId === null) return;

    try {
      await fetch(`${API_BASE}/games/${gameId}/moves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(moveData),
      });
    } catch (e) {
      console.warn('Failed to add move:', e);
    }
  }

  /**
   * Mark a game as finished.
   * @param {Number} gameId
   * @param {String} result - "white", "black", "draw", or "abandoned"
   * @param {String} reason - "checkmate", "stalemate", "timeout", etc.
   */
  async endGame(gameId, result, reason) {
    if (!this._available || gameId === null) return;

    try {
      await fetch(`${API_BASE}/games/${gameId}/end`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result, resultReason: reason }),
      });
    } catch (e) {
      console.warn('Failed to end game:', e);
    }
  }

  /**
   * Update a player's name in an existing game record.
   * @param {Number} gameId
   * @param {String} side - 'white' or 'black'
   * @param {String} name - new player name
   */
  async updatePlayerName(gameId, side, name) {
    if (!this._available || gameId === null) return;

    try {
      await fetch(`${API_BASE}/games/${gameId}/player`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side, name }),
      });
    } catch (e) {
      console.warn('Failed to update player name:', e);
    }
  }

  /**
   * Get a full game record by id (including moves).
   */
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

  /**
   * List games sorted by startTime descending (newest first).
   * Only returns games whose IDs are tracked in localStorage.
   * @param {Object} options - { limit: 15, offset: 0 }
   */
  async listGames({ limit = 15, offset = 0 } = {}) {
    if (!this._available) return [];

    try {
      const ids = Array.from(this._gameIds);
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

  /**
   * List all games on the server (public), sorted by startTime descending.
   * @param {Object} options - { limit: 15, offset: 0 }
   */
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

  /**
   * Get total number of tracked games.
   */
  async getGameCount() {
    if (!this._available) return 0;

    try {
      const ids = Array.from(this._gameIds);
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

  /**
   * Delete a game by id.
   */
  async deleteGame(gameId) {
    if (!this._available) return;

    try {
      await fetch(`${API_BASE}/games/${gameId}`, { method: 'DELETE' });
      this._gameIds.delete(gameId);
      this._saveIds();
    } catch (e) {
      console.warn('Failed to delete game:', e);
    }
  }

  /**
   * Persist tracked game IDs to localStorage.
   */
  _saveIds() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(Array.from(this._gameIds)));
    } catch (e) {
      // localStorage full or unavailable
    }
  }
}

export { GameDatabase };
