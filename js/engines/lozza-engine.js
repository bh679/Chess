/**
 * Lozza Engine — lightweight pure JavaScript chess engine.
 * Speaks UCI protocol. Uses Skill Level for strength control
 * (no UCI_LimitStrength support).
 */
import { UciEngine } from './uci-engine.js';

class LozzaEngine extends UciEngine {
  static get engineId() { return 'lozza'; }
  static getEloRange() { return { min: 500, max: 2200, step: 50, default: 1500 }; }

  constructor() {
    super('js/lib/lozza.js', 'Lozza');
  }

  /**
   * Override: Lozza uses Skill Level 0-20 only (no UCI_LimitStrength).
   */
  _configureStrength(elo) {
    const params = this._getLozzaParams(elo);
    this._send(`setoption name Skill Level value ${params.skillLevel}`);
  }

  /**
   * Override: Lozza-specific go command.
   */
  _buildGoCommand(elo, wtime, btime, increment) {
    const params = this._getLozzaParams(elo);
    const hasTime = wtime > 0 && btime > 0;

    if (hasTime) {
      let cmd = `go wtime ${Math.round(wtime)} btime ${Math.round(btime)}`;
      if (increment > 0) cmd += ` winc ${Math.round(increment)} binc ${Math.round(increment)}`;
      return cmd;
    } else if (params.depth) {
      return `go depth ${params.depth}`;
    } else {
      const movetime = Math.round(300 + (elo - 500) * 2000 / 1700);
      return `go movetime ${movetime}`;
    }
  }

  /**
   * Map ELO 500-2200 to Lozza params.
   * Skill Level 0-20, with depth cap below 1000 ELO.
   */
  _getLozzaParams(elo) {
    const t = Math.max(0, Math.min(1, (elo - 500) / 1700));
    const skillLevel = Math.round(t * 20);
    const depth = elo < 1000 ? Math.round(1 + ((elo - 500) / 500) * 5) : null;
    return { skillLevel, depth };
  }
}

export { LozzaEngine };
