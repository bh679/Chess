/**
 * UCI Engine — shared base class for engines that speak UCI protocol
 * via a Web Worker. Handles worker lifecycle, UCI handshake, bestmove
 * parsing, and ELO-to-UCI-params mapping.
 *
 * Subclasses only need to set the worker path and static metadata.
 */
import { Engine } from './engine.js';

class UciEngine extends Engine {
  /**
   * @param {string} workerPath — path to the worker JS file (relative to HTML)
   * @param {string} fallbackName — engine name before UCI reports one
   */
  constructor(workerPath, fallbackName) {
    super();
    this._workerPath = workerPath;
    this._worker = null;
    this._ready = false;
    this._thinking = false;
    this._resolveMove = null;
    this._rejectMove = null;
    this._engineName = fallbackName;
  }

  async init() {
    return new Promise((resolve, reject) => {
      try {
        this._worker = new Worker(this._workerPath);
      } catch (e) {
        console.warn(`${this._engineName}: Failed to create worker:`, e);
        reject(e);
        return;
      }

      let uciReady = false;

      this._worker.onmessage = (e) => {
        const line = (typeof e.data === 'string' ? e.data : String(e.data)).trim();

        if (line.startsWith('id name ')) {
          this._engineName = line.substring(8).trim();
        }

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
            const r = this._resolveMove;
            this._resolveMove = null;
            this._rejectMove = null;
            r(move);
          }
        }
      };

      this._worker.onerror = (e) => {
        console.error(`${this._engineName}: Worker error:`, e);
        if (!this._ready) {
          reject(e);
        }
      };

      this._send('uci');
    });
  }

  isReady() { return this._ready; }
  isThinking() { return this._thinking; }
  getEngineName() { return this._engineName; }

  async requestMove(fen, elo, timeInfo = {}) {
    if (!this._ready) return null;

    if (this._thinking) {
      this.stop();
    }

    this._thinking = true;

    return new Promise((resolve, reject) => {
      this._resolveMove = resolve;
      this._rejectMove = reject;

      this._configureStrength(elo);
      this._send(`position fen ${fen}`);

      const { wtime = 0, btime = 0, increment = 0 } = timeInfo;
      const goCmd = this._buildGoCommand(elo, wtime, btime, increment);
      this._send(goCmd);
    });
  }

  /**
   * Configure engine strength via UCI options.
   * Subclasses can override for different strength models.
   * Default: Stockfish-style UCI_LimitStrength / Skill Level mapping.
   */
  _configureStrength(elo) {
    const params = this._getEloParams(elo);

    if (params.useUciElo) {
      this._send('setoption name UCI_LimitStrength value true');
      this._send(`setoption name UCI_Elo value ${params.uciElo}`);
      this._send('setoption name Skill Level value 20');
    } else {
      this._send('setoption name UCI_LimitStrength value false');
      this._send(`setoption name Skill Level value ${params.skillLevel}`);
    }
  }

  /**
   * Build the 'go' command. Subclasses can override.
   */
  _buildGoCommand(elo, wtime, btime, increment) {
    const params = this._getEloParams(elo);
    const hasTime = wtime > 0 && btime > 0;

    if (hasTime) {
      let cmd = `go wtime ${Math.round(wtime)} btime ${Math.round(btime)}`;
      if (increment > 0) cmd += ` winc ${Math.round(increment)} binc ${Math.round(increment)}`;
      return cmd;
    } else if (params.useUciElo) {
      const movetime = Math.round(500 + (elo - 1320) * 4500 / (3200 - 1320));
      return `go movetime ${movetime}`;
    } else {
      return `go depth ${params.depth}`;
    }
  }

  /**
   * Map ELO to UCI engine parameters.
   * ELO >= 1320: UCI_LimitStrength + UCI_Elo
   * ELO < 1320: Skill Level 0-6 + depth 1-8
   */
  _getEloParams(elo) {
    if (elo >= 1320) {
      const uciElo = Math.min(elo, 3190);
      return { useUciElo: true, uciElo };
    } else {
      const t = (elo - 100) / (1320 - 100);
      const skillLevel = Math.round(t * 6);
      const depth = Math.round(1 + t * 7);
      return { useUciElo: false, skillLevel, depth };
    }
  }

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

  newGame() {
    if (this._worker) {
      this._send('ucinewgame');
      this._send('isready');
    }
  }

  destroy() {
    this.stop();
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
      this._ready = false;
    }
  }

  _parseBestMove(line) {
    const parts = line.split(' ');
    const move = parts[1];
    if (!move || move === '(none)') return null;
    const from = move.slice(0, 2);
    const to = move.slice(2, 4);
    const promotion = move.length > 4 ? move[4] : null;
    return { from, to, promotion };
  }

  _send(cmd) {
    if (this._worker) {
      this._worker.postMessage(cmd);
    }
  }
}

export { UciEngine };
