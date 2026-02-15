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
    scene.style.width = `${squareSize * 2.5}px`;
    scene.style.height = `${squareSize * 2.5}px`;

    // Attacker piece
    const attacker = document.createElement('img');
    attacker.className = `combat-attacker combat-attack-${attackerType}`;
    attacker.src = `${window.chessPiecePath || 'img/pieces'}/${attackerColor}${this._pieceDisplay(attackerType)}.svg`;
    attacker.alt = 'attacker';

    // Defender piece
    const defender = document.createElement('img');
    defender.className = `combat-defender combat-defend-${defenderType}`;
    defender.src = `${window.chessPiecePath || 'img/pieces'}/${defenderColor}${this._pieceDisplay(defenderType)}.svg`;
    defender.alt = 'defender';

    // Add weapon/effect elements for dramatic combat
    const effect = this._createCombatEffect(attackerType);
    if (effect) scene.appendChild(effect);

    scene.appendChild(defender);
    scene.appendChild(attacker);
    this.overlay.appendChild(scene);

    // Longer duration for more dramatic combat: 900ms
    const duration = 900;

    setTimeout(() => {
      this.overlay.classList.add('hidden');
      if (onComplete) onComplete();
    }, duration);
  }

  /**
   * Create special combat effects based on attacker type
   */
  _createCombatEffect(attackerType) {
    const effect = document.createElement('div');
    effect.className = `combat-effect combat-effect-${attackerType}`;

    // Different effects for different pieces
    switch(attackerType) {
      case 'p': // Pawn - knife slash
        effect.innerHTML = '⚔️';
        effect.classList.add('knife-slash');
        break;
      case 'n': // Knight - charge impact
        effect.innerHTML = '💥';
        effect.classList.add('charge-impact');
        break;
      case 'b': // Bishop - holy smite
        effect.innerHTML = '✨';
        effect.classList.add('holy-smite');
        break;
      case 'r': // Rook - crushing blow
        effect.innerHTML = '💢';
        effect.classList.add('crushing-blow');
        break;
      case 'q': // Queen - devastating strike
        effect.innerHTML = '⚡';
        effect.classList.add('devastating-strike');
        break;
      case 'k': // King - royal decree
        effect.innerHTML = '👑';
        effect.classList.add('royal-decree');
        break;
    }

    return effect;
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
