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
   * @param {number} [wtime] - White's remaining time in ms (0 = no timer)
   * @param {number} [btime] - Black's remaining time in ms (0 = no timer)
   * @param {number} [increment] - Increment per move in ms
   * @returns {Promise<{from: string, to: string, promotion: string|null}>}
   */
  requestMove(fen, elo, wtime = 0, btime = 0, increment = 0) {
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
        // Let Stockfish manage its own depth via internal Skill Level mapping
        this._send('setoption name UCI_LimitStrength value true');
        this._send(`setoption name UCI_Elo value ${params.uciElo}`);
        this._send('setoption name Skill Level value 20');
      } else {
        // Lower ELO: use Skill Level directly for weaker play
        this._send('setoption name UCI_LimitStrength value false');
        this._send(`setoption name Skill Level value ${params.skillLevel}`);
      }

      // Set position
      this._send(`position fen ${fen}`);

      // Build go command with time awareness
      // Stockfish stops at whichever limit is hit first, so depth + wtime
      // doesn't work well (shallow depth finishes before time management kicks in).
      // Instead, use wtime/btime for timed games and depth for untimed.
      let goCmd;
      const hasTime = wtime > 0 && btime > 0;

      if (hasTime) {
        // Timed game: pass clock info so engine manages its own time
        // UCI_LimitStrength/Skill Level still constrain strength independently
        goCmd = `go wtime ${Math.round(wtime)} btime ${Math.round(btime)}`;
        if (increment > 0) goCmd += ` winc ${Math.round(increment)} binc ${Math.round(increment)}`;
      } else if (params.useUciElo) {
        // High ELO without timer: use movetime scaled by ELO
        const movetime = Math.round(500 + (elo - 1320) * 4500 / (3200 - 1320));
        goCmd = `go movetime ${movetime}`;
      } else {
        // Low ELO without timer: depth-limited search
        goCmd = `go depth ${params.depth}`;
      }

      this._send(goCmd);
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
   * ELO >= 1320: Use UCI_LimitStrength + UCI_Elo (engine manages its own depth/strength)
   * ELO < 1320:  Use Skill Level 0-6 + depth cap (for weaker play)
   */
  _getEloParams(elo) {
    if (elo >= 1320) {
      // Clamp UCI_Elo to Stockfish's supported range (1320-3190)
      const uciElo = Math.min(elo, 3190);
      return { useUciElo: true, uciElo };
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
