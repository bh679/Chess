/**
 * Stockfish Engine — the existing Stockfish 17.1 WASM engine,
 * extracted into the abstract engine interface.
 */
import { UciEngine } from './uci-engine.js';

class StockfishEngine extends UciEngine {
  static get engineId() { return 'stockfish'; }
  static getEloRange() { return { min: 100, max: 3200, step: 50, default: 1500 }; }

  constructor() {
    super('js/lib/stockfish.js', 'Stockfish');
  }
}

export { StockfishEngine };
