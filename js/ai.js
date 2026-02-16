/**
 * AI Module - Stockfish WASM integration via Web Worker
 * Communicates with the engine using UCI protocol
 * Supports independent AI for White and Black with ELO-based difficulty
 */

class AI {
  constructor() {
    this._worker = null;
    this._ready = false;
    this._whiteEnabled = false;
    this._blackEnabled = false;
    this._whiteElo = 1500;
    this._blackElo = 1500;
    this._thinking = false;
    this._resolveMove = null;
    this._rejectMove = null;
  }

  /**
   * Initialize the Stockfish Web Worker
   * @returns {Promise} Resolves when engine is ready
   */
  async init() {
    return new Promise((resolve, reject) => {
      try {
        this._worker = new Worker('js/lib/stockfish.js');
      } catch (e) {
        console.warn('AI: Failed to create Stockfish worker:', e);
        reject(e);
        return;
      }

      let uciReady = false;

      this._worker.onmessage = (e) => {
        const line = typeof e.data === 'string' ? e.data : String(e.data);

        if (line === 'uciok') {
          uciReady = true;
          this._send('isready');
        }

        if (line === 'readyok') {
          if (!this._ready) {
            this._ready = true;
            resolve();
          }
        }

        if (line.startsWith('bestmove')) {
          const move = this._parseBestMove(line);
          this._thinking = false;
          if (this._resolveMove) {
            const resolve = this._resolveMove;
            this._resolveMove = null;
            this._rejectMove = null;
            resolve(move);
          }
        }
      };

      this._worker.onerror = (e) => {
        console.error('AI: Stockfish worker error:', e);
        if (!this._ready) {
          reject(e);
        }
      };

      // Start UCI handshake
      this._send('uci');
    });
  }

  /**
   * Configure AI settings (per-side)
   */
  configure({ whiteEnabled, whiteElo, blackEnabled, blackElo }) {
    this._whiteEnabled = whiteEnabled;
    this._blackEnabled = blackEnabled;
    this._whiteElo = whiteElo;
    this._blackElo = blackElo;
  }

  /**
   * Check if AI is enabled for at least one side
   */
  isEnabled() {
    return (this._whiteEnabled || this._blackEnabled) && this._ready;
  }

  /**
   * Check if it's AI's turn
   */
  isAITurn(currentTurn) {
    if (currentTurn === 'w') return this._whiteEnabled;
    if (currentTurn === 'b') return this._blackEnabled;
    return false;
  }

  /**
   * Get the ELO for a given side
   */
  getElo(turn) {
    return turn === 'w' ? this._whiteElo : this._blackElo;
  }

  /**
   * Check if AI is currently computing
   */
  isThinking() {
    return this._thinking;
  }

  /**
   * Request the AI to compute the best move for the given position
   * @param {string} fen - FEN string of current position
   * @param {number} elo - ELO rating for this move's side
   * @returns {Promise<{from: string, to: string, promotion: string|null}>}
   */
  requestMove(fen, elo) {
    if (!this._ready) {
      return Promise.resolve(null);
    }

    // Cancel any pending move
    if (this._thinking) {
      this.stop();
    }

    this._thinking = true;

    return new Promise((resolve, reject) => {
      this._resolveMove = resolve;
      this._rejectMove = reject;

      const params = this._getEloParams(elo);

      if (params.useUciElo) {
        // Higher ELO: use UCI_LimitStrength + UCI_Elo
        this._send('setoption name UCI_LimitStrength value true');
        this._send(`setoption name UCI_Elo value ${params.uciElo}`);
        this._send(`setoption name Skill Level value 20`);
      } else {
        // Lower ELO: use Skill Level
        this._send('setoption name UCI_LimitStrength value false');
        this._send(`setoption name Skill Level value ${params.skillLevel}`);
      }

      // Set position
      this._send(`position fen ${fen}`);

      // Start search
      this._send(`go depth ${params.depth}`);
    });
  }

  /**
   * Stop the engine's current search
   */
  stop() {
    if (this._worker && this._thinking) {
      this._send('stop');
    }
    this._thinking = false;
    if (this._rejectMove) {
      this._rejectMove('stopped');
      this._resolveMove = null;
      this._rejectMove = null;
    }
  }

  /**
   * Send a new game signal to the engine
   */
  newGame() {
    if (this._worker) {
      this._send('ucinewgame');
      this._send('isready');
    }
  }

  /**
   * Parse Stockfish's bestmove response
   * Format: "bestmove e2e4" or "bestmove e7e8q" (with promotion)
   */
  _parseBestMove(line) {
    const parts = line.split(' ');
    const move = parts[1];

    if (!move || move === '(none)') {
      return null;
    }

    const from = move.slice(0, 2);
    const to = move.slice(2, 4);
    const promotion = move.length > 4 ? move[4] : null;

    return { from, to, promotion };
  }

  /**
   * Map ELO rating to UCI engine parameters
   * ELO >= 1320: Use UCI_LimitStrength + UCI_Elo (engine's built-in ELO limiter)
   * ELO < 1320:  Use Skill Level 0-6 + low depth (for weaker play)
   */
  _getEloParams(elo) {
    if (elo >= 1320) {
      // Clamp UCI_Elo to Stockfish's supported range
      const uciElo = Math.min(elo, 3190);
      // Scale depth from 10 (at 1320) to 22 (at 3200)
      const depth = Math.round(10 + (elo - 1320) * 12 / (3200 - 1320));
      return { useUciElo: true, uciElo, depth };
    } else {
      // Map 100-1320 linearly to Skill Level 0-6 and depth 1-8
      const t = (elo - 100) / (1320 - 100); // 0..1
      const skillLevel = Math.round(t * 6);
      const depth = Math.round(1 + t * 7);
      return { useUciElo: false, skillLevel, depth };
    }
  }

  /**
   * Send a UCI command to the worker
   */
  _send(cmd) {
    if (this._worker) {
      this._worker.postMessage(cmd);
    }
  }
}

export { AI };
