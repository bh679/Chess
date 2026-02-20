/**
 * Lc0 Engine — Leela Chess Zero via lc0-js WASM/TensorFlow.js.
 * Neural network engine with more human-like, positional play.
 * Strength controlled by node count rather than Skill Level.
 */
import { UciEngine } from './uci-engine.js';

class Lc0Engine extends UciEngine {
  static get engineId() { return 'lc0'; }
  static getEloRange() { return { min: 1200, max: 2400, step: 100, default: 1800 }; }

  constructor() {
    super('js/lib/lc0/lc0.js', 'Leela Chess Zero');
  }

  /**
   * Override: Lc0 doesn't support UCI_LimitStrength or Skill Level.
   * Strength is controlled purely by node count in the go command.
   */
  _configureStrength() {
    // No UCI strength options for Lc0
  }

  /**
   * Override: Use node limit for strength control.
   */
  _buildGoCommand(elo, wtime, btime, increment) {
    const hasTime = wtime > 0 && btime > 0;

    if (hasTime) {
      let cmd = `go wtime ${Math.round(wtime)} btime ${Math.round(btime)}`;
      if (increment > 0) cmd += ` winc ${Math.round(increment)} binc ${Math.round(increment)}`;
      return cmd;
    } else {
      const nodes = this._eloToNodes(elo);
      return `go nodes ${nodes}`;
    }
  }

  /**
   * Map ELO 1200-2400 to node count 1-800.
   */
  _eloToNodes(elo) {
    const t = Math.max(0, Math.min(1, (elo - 1200) / 1200));
    return Math.max(1, Math.round(1 + t * 799));
  }
}

export { Lc0Engine };
