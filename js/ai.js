/**
 * AI Module - Stockfish WASM integration via Web Worker
 * Communicates with the engine using UCI protocol
 */

class AI {
  constructor() {
    this._worker = null;
    this._ready = false;
    this._enabled = false;
    this._color = 'b'; // which color the AI plays ('w' or 'b')
    this._difficulty = 'medium';
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
   * Configure AI settings
   */
  configure({ enabled, color, difficulty }) {
    this._enabled = enabled;
    this._color = color;
    this._difficulty = difficulty;
  }

  /**
   * Check if AI is enabled
   */
  isEnabled() {
    return this._enabled && this._ready;
  }

  /**
   * Check if it's AI's turn
   */
  isAITurn(currentTurn) {
    return this._enabled && this._color === currentTurn;
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
   * @returns {Promise<{from: string, to: string, promotion: string|null}>}
   */
  requestMove(fen) {
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

      const params = this._getDifficultyParams();

      // Set skill level
      this._send(`setoption name Skill Level value ${params.skillLevel}`);

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
   * Get UCI parameters based on difficulty level
   */
  _getDifficultyParams() {
    switch (this._difficulty) {
      case 'easy':
        return { depth: 3, skillLevel: 3 };
      case 'medium':
        return { depth: 10, skillLevel: 10 };
      case 'hard':
        return { depth: 18, skillLevel: 20 };
      default:
        return { depth: 10, skillLevel: 10 };
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
