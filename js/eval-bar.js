/**
 * EvalBar — Vertical evaluation bar for chess position analysis.
 *
 * Shows which side is winning via a vertical bar with white (bottom)
 * and black (top) fills. Score label displays centipawn value or
 * "M<n>" for mate scores. Uses a sigmoid mapping for smooth visuals.
 *
 * Usage:
 *   const bar = new EvalBar();
 *   parentEl.appendChild(bar.el);
 *   bar.update(150);   // +1.50 for white
 *   bar.update(-300);  // -3.00 for black
 *   bar.show();
 *   bar.hide();
 */

export { EvalBar };

class EvalBar {
  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'eval-bar hidden';

    this._blackFill = document.createElement('div');
    this._blackFill.className = 'eval-bar-black';

    this._whiteFill = document.createElement('div');
    this._whiteFill.className = 'eval-bar-white';

    this._scoreLabel = document.createElement('div');
    this._scoreLabel.className = 'eval-bar-score';

    this.el.appendChild(this._blackFill);
    this.el.appendChild(this._whiteFill);

    // Score label floats inside the bar via absolute positioning
    this.el.appendChild(this._scoreLabel);

    this.reset();
  }

  /**
   * Update the bar with an evaluation in centipawns.
   * Positive = white advantage, negative = black advantage.
   * Mate scores: abs(eval) >= 9900 treated as forced mate.
   * @param {number} evalCp — centipawns from white's perspective
   */
  update(evalCp) {
    const whitePct = this._evalToPercent(evalCp);
    const blackPct = 100 - whitePct;

    this._whiteFill.style.height = `${whitePct}%`;
    this._blackFill.style.height = `${blackPct}%`;

    // Score text
    const scoreText = this._formatScore(evalCp);
    this._scoreLabel.textContent = scoreText;

    // Position the label in the winning side's area
    if (evalCp >= 0) {
      // White is winning — label in white area (bottom)
      this._scoreLabel.classList.remove('eval-bar-score-black');
      this._scoreLabel.classList.add('eval-bar-score-white');
    } else {
      // Black is winning — label in black area (top)
      this._scoreLabel.classList.remove('eval-bar-score-white');
      this._scoreLabel.classList.add('eval-bar-score-black');
    }
  }

  show() {
    this.el.classList.remove('hidden');
  }

  hide() {
    this.el.classList.add('hidden');
  }

  reset() {
    this.update(0);
  }

  /**
   * Map centipawn eval to white fill percentage (0-100).
   * Uses sigmoid: 50 + 50 * (2/(1+e^(-cp/400)) - 1)
   * Clamped to [5, 95] so the bar never fully empties.
   */
  _evalToPercent(cp) {
    // Handle mate scores
    if (Math.abs(cp) >= 9900) {
      return cp > 0 ? 95 : 5;
    }
    const sigmoid = 2 / (1 + Math.exp(-cp / 400)) - 1;
    const pct = 50 + 50 * sigmoid;
    return Math.max(5, Math.min(95, pct));
  }

  /**
   * Format centipawn score for display.
   * Returns e.g. "+1.5", "-0.3", "M3", "-M2".
   */
  _formatScore(cp) {
    if (Math.abs(cp) >= 9900) {
      const mateIn = Math.ceil((10000 - Math.abs(cp)) / 2);
      return cp > 0 ? `M${mateIn}` : `-M${mateIn}`;
    }
    const pawns = Math.abs(cp) / 100;
    return pawns.toFixed(1);
  }
}
