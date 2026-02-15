/**
 * Combat Animation System
 * Plays sprite-sheet based combat animations when pieces capture each other
 */

class Combat {
  constructor(containerEl) {
    this.container = containerEl;
    this.overlay = null;
    this._createOverlay();
  }

  _createOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'combat-overlay hidden';
    document.body.appendChild(this.overlay);
  }

  /**
   * Play a combat animation between attacker and defender
   * @param {string} attackerType - piece type (p, n, b, r, q, k)
   * @param {string} attackerColor - w or b
   * @param {string} defenderType - piece type
   * @param {string} defenderColor - w or b
   * @param {DOMRect} fromRect - bounding rect of attacker square
   * @param {DOMRect} toRect - bounding rect of defender square
   * @param {Function} onComplete - callback when animation finishes
   */
  playCapture(attackerType, attackerColor, defenderType, defenderColor, fromRect, toRect, onComplete) {
    // Calculate center point between the two squares
    const centerX = (fromRect.left + toRect.left) / 2 + fromRect.width / 2;
    const centerY = (fromRect.top + toRect.top) / 2 + fromRect.height / 2;

    const squareSize = fromRect.width;

    // Clear any existing content
    this.overlay.innerHTML = '';
    this.overlay.classList.remove('hidden');

    // Create combat scene with both pieces
    const scene = document.createElement('div');
    scene.className = 'combat-scene';
    scene.style.left = `${centerX}px`;
    scene.style.top = `${centerY}px`;
    scene.style.width = `${squareSize * 2}px`;
    scene.style.height = `${squareSize * 2}px`;

    // Attacker piece
    const attacker = document.createElement('img');
    attacker.className = `combat-attacker combat-anim-${attackerType}`;
    attacker.src = `img/pieces/${attackerColor}${this._pieceDisplay(attackerType)}.svg`;
    attacker.alt = 'attacker';

    // Defender piece
    const defender = document.createElement('img');
    defender.className = 'combat-defender';
    defender.src = `img/pieces/${defenderColor}${this._pieceDisplay(defenderType)}.svg`;
    defender.alt = 'defender';

    scene.appendChild(defender);
    scene.appendChild(attacker);
    this.overlay.appendChild(scene);

    // Duration: 600ms for snappy combat feel
    const duration = 600;

    setTimeout(() => {
      this.overlay.classList.add('hidden');
      if (onComplete) onComplete();
    }, duration);
  }

  _pieceDisplay(type) {
    const map = { k: 'K', q: 'Q', r: 'R', b: 'B', n: 'N', p: 'P' };
    return map[type];
  }

  /**
   * Check if a sprite sheet exists for a given piece type
   */
  hasSpriteSheet(pieceType) {
    // For now, we'll create sprites for all 6 piece types
    return ['p', 'n', 'b', 'r', 'q', 'k'].includes(pieceType);
  }
}

export { Combat };
