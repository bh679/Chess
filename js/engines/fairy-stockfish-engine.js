/**
 * Fairy-Stockfish Engine — variant chess engine with WASM support.
 * Speaks standard UCI protocol with variant extensions.
 * Same ELO mapping as regular Stockfish.
 */
import { UciEngine } from './uci-engine.js';

class FairyStockfishEngine extends UciEngine {
  static get engineId() { return 'fairy-stockfish'; }
  static getEloRange() { return { min: 100, max: 3200, step: 50, default: 1500 }; }

  constructor() {
    super('js/lib/fairy-stockfish.js', 'Fairy-Stockfish');
  }
}

export { FairyStockfishEngine };
