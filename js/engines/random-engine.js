/**
 * Random Engine — picks a uniformly random legal move.
 * No Web Worker, no WASM. Pure JS using chess.js for move generation.
 */
import { Engine } from './engine.js';
import { Chess } from '../chess.js';

class RandomEngine extends Engine {
  static get engineId() { return 'random'; }
  static getEloRange() { return { min: 100, max: 100, step: 1, default: 100 }; }

  constructor() {
    super();
    this._ready = false;
    this._thinking = false;
  }

  async init() {
    this._ready = true;
  }

  isReady() { return this._ready; }
  isThinking() { return this._thinking; }
  getEngineName() { return 'Random Mover'; }

  async requestMove(fen) {
    if (!this._ready) return null;
    this._thinking = true;

    // Small delay so it looks like "thinking"
    const delay = 200 + Math.random() * 600;
    await new Promise(r => setTimeout(r, delay));

    try {
      const chess = new Chess(fen);
      const moves = chess.moves({ verbose: true });
      if (moves.length === 0) {
        this._thinking = false;
        return null;
      }

      const move = moves[Math.floor(Math.random() * moves.length)];
      this._thinking = false;
      return {
        from: move.from,
        to: move.to,
        promotion: move.promotion || null,
      };
    } catch {
      this._thinking = false;
      return null;
    }
  }

  stop() {
    this._thinking = false;
  }

  newGame() {
    // Nothing to reset
  }
}

export { RandomEngine };
