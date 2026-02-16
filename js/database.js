/**
 * GameDatabase — IndexedDB persistence layer for chess game records.
 * All methods return Promises. Writes are fire-and-forget (never block game flow).
 */

const DB_NAME = 'chess-game-archive';
const DB_VERSION = 1;
const STORE_NAME = 'games';

class GameDatabase {
  constructor() {
    this._db = null;
    this._available = false;
  }

  /**
   * Open (or create) the database. Call once at app startup.
   */
  open() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.warn('IndexedDB not available');
        this._available = false;
        resolve();
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('startTime', 'startTime', { unique: false });
          store.createIndex('result', 'result', { unique: false });
        }
      };

      request.onsuccess = (e) => {
        this._db = e.target.result;
        this._available = true;
        resolve();
      };

      request.onerror = (e) => {
        console.warn('IndexedDB open error:', e.target.error);
        this._available = false;
        resolve(); // graceful degradation
      };
    });
  }

  /**
   * Insert a new game record. Returns the auto-generated id.
   * @param {Object} metadata - { gameType, timeControl, startingFen, white, black }
   *   white/black: { name: String, isAI: Boolean, elo: Number|null }
   */
  async createGame(metadata) {
    if (!this._available) return null;

    const record = {
      startTime: Date.now(),
      endTime: null,
      gameType: metadata.gameType,
      timeControl: metadata.timeControl,
      startingFen: metadata.startingFen,
      result: null,
      resultReason: '',
      white: metadata.white,
      black: metadata.black,
      moves: [],
    };

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.add(record);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Append a move to a game's moves array (get-modify-put).
   * @param {Number} gameId
   * @param {Object} moveData - { ply, san, fen, timestamp, side }
   */
  async addMove(gameId, moveData) {
    if (!this._available || gameId === null) return;

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(gameId);

      getReq.onsuccess = () => {
        const record = getReq.result;
        if (!record) {
          reject(new Error(`Game ${gameId} not found`));
          return;
        }
        record.moves.push(moveData);
        const putReq = store.put(record);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };

      getReq.onerror = () => reject(getReq.error);
    });
  }

  /**
   * Mark a game as finished.
   * @param {Number} gameId
   * @param {String} result - "white", "black", or "draw"
   * @param {String} reason - "checkmate", "stalemate", "timeout", "insufficient", "threefold", "50-move"
   */
  async endGame(gameId, result, reason) {
    if (!this._available || gameId === null) return;

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(gameId);

      getReq.onsuccess = () => {
        const record = getReq.result;
        if (!record) {
          reject(new Error(`Game ${gameId} not found`));
          return;
        }
        record.result = result;
        record.resultReason = reason;
        record.endTime = Date.now();
        const putReq = store.put(record);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };

      getReq.onerror = () => reject(getReq.error);
    });
  }

  /**
   * Update a player's name in an existing game record (get-modify-put).
   * @param {Number} gameId
   * @param {String} side - 'white' or 'black'
   * @param {String} name - new player name
   */
  async updatePlayerName(gameId, side, name) {
    if (!this._available || gameId === null) return;

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(gameId);

      getReq.onsuccess = () => {
        const record = getReq.result;
        if (!record) {
          reject(new Error(`Game ${gameId} not found`));
          return;
        }
        record[side].name = name;
        const putReq = store.put(record);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };

      getReq.onerror = () => reject(getReq.error);
    });
  }

  /**
   * Get a full game record by id.
   */
  async getGame(gameId) {
    if (!this._available) return null;

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(gameId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * List games sorted by startTime descending (newest first).
   * Returns trimmed projections (no moves array, adds moveCount).
   * @param {Object} options - { limit: 15, offset: 0 }
   */
  async listGames({ limit = 15, offset = 0 } = {}) {
    if (!this._available) return [];

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('startTime');
      const request = index.openCursor(null, 'prev'); // newest first

      const results = [];
      let skipped = 0;

      request.onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor || results.length >= limit) {
          resolve(results);
          return;
        }

        if (skipped < offset) {
          skipped++;
          cursor.continue();
          return;
        }

        const record = cursor.value;
        results.push({
          id: record.id,
          startTime: record.startTime,
          endTime: record.endTime,
          gameType: record.gameType,
          timeControl: record.timeControl,
          white: record.white,
          black: record.black,
          result: record.result,
          resultReason: record.resultReason,
          moveCount: record.moves.length,
        });

        cursor.continue();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get total number of games in the database.
   */
  async getGameCount() {
    if (!this._available) return 0;

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a game by id.
   */
  async deleteGame(gameId) {
    if (!this._available) return;

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(gameId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export { GameDatabase };
