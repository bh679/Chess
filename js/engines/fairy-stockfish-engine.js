/**
 * Fairy-Stockfish Engine — variant chess engine with NNUE + WASM.
 *
 * Unlike Stockfish/Lozza which use a simple Web Worker,
 * Fairy-Stockfish uses an Emscripten module that manages its own
 * pthreads workers internally. Communication is via
 * module.addMessageListener() / module.postMessage().
 *
 * Requires COOP/COEP headers for SharedArrayBuffer.
 */
import { Engine } from './engine.js';

class FairyStockfishEngine extends Engine {
  static get engineId() { return 'fairy-stockfish'; }
  static getEloRange() { return { min: 500, max: 2850, step: 50, default: 1500 }; }

  constructor() {
    super();
    this._module = null;
    this._ready = false;
    this._thinking = false;
    this._resolveMove = null;
    this._rejectMove = null;
    this._engineName = 'Fairy-Stockfish';
  }

  async init() {
    return new Promise((resolve, reject) => {
      // Use absolute URL so _scriptDir resolves correctly for worker importScripts
      const scriptUrl = '/js/lib/fairy-stockfish.js';

      const script = document.createElement('script');
      script.src = scriptUrl;
      script.onload = async () => {
        try {
          if (typeof window.FairyStockfish !== 'function') {
            reject(new Error('Fairy-Stockfish module did not load'));
            return;
          }

          const sf = await window.FairyStockfish({
            locateFile: (filename) => '/js/lib/' + filename
          });

          this._module = sf;
          await sf.ready;

          sf.addMessageListener((line) => {
            line = line.trim();

            if (line.startsWith('id name ')) {
              // Truncate verbose engine name (e.g. "Fairy-Stockfish [...] LB")
              let name = line.substring(8).trim();
              const bracketIdx = name.indexOf('[');
              if (bracketIdx > 0) name = name.substring(0, bracketIdx).trim();
              this._engineName = name || 'Fairy-Stockfish';
            }

            if (line === 'uciok') {
              sf.postMessage('isready');
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
          });

          sf.postMessage('uci');
        } catch (e) {
          reject(e);
        }
      };
      script.onerror = () => {
        reject(new Error('Failed to load Fairy-Stockfish script'));
      };
      document.head.appendChild(script);
    });
  }

  isReady() { return this._ready; }
  isThinking() { return this._thinking; }
  getEngineName() { return this._engineName; }

  async requestMove(fen, elo, timeInfo = {}) {
    if (!this._ready || !this._module) return null;

    if (this._thinking) {
      this.stop();
    }

    this._thinking = true;

    return new Promise((resolve, reject) => {
      this._resolveMove = resolve;
      this._rejectMove = reject;

      this._configureStrength(elo);
      this._module.postMessage(`position fen ${fen}`);

      const { wtime = 0, btime = 0, increment = 0 } = timeInfo;
      const goCmd = this._buildGoCommand(elo, wtime, btime, increment);
      this._module.postMessage(goCmd);
    });
  }

  /**
   * Fairy-Stockfish strength: UCI_Elo 500-2850, Skill Level -20 to 20.
   * Use UCI_LimitStrength for the full range since its min (500) is low enough.
   */
  _configureStrength(elo) {
    const uciElo = Math.max(500, Math.min(2850, elo));
    this._module.postMessage('setoption name UCI_LimitStrength value true');
    this._module.postMessage(`setoption name UCI_Elo value ${uciElo}`);
  }

  _buildGoCommand(elo, wtime, btime, increment) {
    const hasTime = wtime > 0 && btime > 0;

    if (hasTime) {
      let cmd = `go wtime ${Math.round(wtime)} btime ${Math.round(btime)}`;
      if (increment > 0) cmd += ` winc ${Math.round(increment)} binc ${Math.round(increment)}`;
      return cmd;
    } else {
      const movetime = Math.round(500 + (elo - 500) * 4500 / (2850 - 500));
      return `go movetime ${movetime}`;
    }
  }

  stop() {
    if (this._module && this._thinking) {
      this._module.postMessage('stop');
    }
    this._thinking = false;
    if (this._rejectMove) {
      this._rejectMove('stopped');
      this._resolveMove = null;
      this._rejectMove = null;
    }
  }

  newGame() {
    if (this._module) {
      this._module.postMessage('ucinewgame');
      this._module.postMessage('isready');
    }
  }

  destroy() {
    this.stop();
    if (this._module) {
      this._module.terminate();
      this._module = null;
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
}

export { FairyStockfishEngine };
