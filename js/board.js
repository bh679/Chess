import { Combat } from './combat.js';
import { ArrowOverlay } from './arrows.js';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

const PIECE_MAP = {
  k: 'K', q: 'Q', r: 'R', b: 'B', n: 'N', p: 'P',
};

class Board {
  constructor(containerEl, game, promotionModalEl) {
    this.container = containerEl;
    this.game = game;
    this.promotionModal = promotionModalEl;
    this.combat = new Combat(containerEl);
    this._moveCallback = null;
    this._selectedSquare = null;
    this._legalMoves = [];
    this._dragging = null;
    this._animationsEnabled = true;
    this._interactive = true;
    this._ai = null;
    this._premove = null;
    this._premovesEnabled = false;
    this._skipNextClick = false;
    this._rightClickStart = null;
    this._rightClickMoved = false;
    this._flipped = false;

    this._buildGrid();
    this._arrowOverlay = new ArrowOverlay(containerEl);
    this._bindEvents();
  }

  getArrowOverlay() {
    return this._arrowOverlay;
  }

  setAnimationsEnabled(enabled) {
    this._animationsEnabled = enabled;
  }

  setInteractive(enabled) {
    this._interactive = enabled;
  }

  setFlipped(flipped) {
    if (this._flipped === flipped) return;
    this._flipped = flipped;
    this._buildGrid();
    this.render();
  }

  setAI(ai) {
    this._ai = ai;
  }

  onMove(callback) {
    this._moveCallback = callback;
  }

  setPremovesEnabled(enabled) {
    this._premovesEnabled = enabled;
  }

  setPremove(from, to) {
    this.clearPremove();
    this._premove = { from, to };
    this._renderPremoveHighlights();
  }

  clearPremove() {
    if (this._premove) {
      const fromEl = this._getSquareEl(this._premove.from);
      const toEl = this._getSquareEl(this._premove.to);
      if (fromEl) fromEl.classList.remove('premove-from');
      if (toEl) toEl.classList.remove('premove-to');
      this._premove = null;
    }
  }

  getPremove() {
    return this._premove;
  }

  executePremove() {
    if (!this._premove) return false;
    const { from, to } = this._premove;
    this.clearPremove();

    const legalMoves = this.game.getLegalMoves(from);
    if (!legalMoves.includes(to)) return false;

    const promotion = this.game.isPromotion(from, to) ? 'q' : undefined;
    const result = this.game.makeMove(from, to, promotion);
    if (result.success) {
      this._clearSelection();
      this.render();
      if (this._moveCallback) this._moveCallback(result);
      return true;
    }
    return false;
  }

  render() {
    const board = this.game.getBoard();
    const lastMove = this.game.getLastMove();
    const inCheck = this.game.getGameStatus().startsWith('Check');
    const turn = this.game.getTurn();

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const square = FILES[col] + RANKS[row];
        const el = this._getSquareEl(square);

        // Clear state classes
        el.classList.remove('selected', 'legal-move', 'legal-capture', 'last-move', 'check', 'premove-from', 'premove-to');

        // Remove existing piece
        const existingImg = el.querySelector('.piece');
        if (existingImg) existingImg.remove();

        // Place piece
        const piece = board[row][col];
        if (piece) {
          const img = document.createElement('img');
          img.className = 'piece';
          img.src = `${window.chessPiecePath || 'img/pieces'}/${piece.color}${PIECE_MAP[piece.type]}.svg`;
          img.alt = `${piece.color}${piece.type}`;
          img.draggable = false;
          el.appendChild(img);
        }

        // Highlight last move
        if (lastMove && (square === lastMove.from || square === lastMove.to)) {
          el.classList.add('last-move');
        }

        // Highlight king in check
        if (inCheck && piece && piece.type === 'k' && piece.color === turn) {
          el.classList.add('check');
        }
      }
    }

    this._renderPremoveHighlights();
  }

  _buildGrid() {
    this.container.innerHTML = '';
    const files = this._flipped ? [...FILES].reverse() : FILES;
    const ranks = this._flipped ? [...RANKS].reverse() : RANKS;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const square = files[col] + ranks[row];
        // Color is determined by absolute position, not visual position
        const fileIdx = FILES.indexOf(files[col]);
        const rankIdx = RANKS.indexOf(ranks[row]);
        const el = document.createElement('div');
        el.className = 'square ' + ((rankIdx + fileIdx) % 2 === 0 ? 'light' : 'dark');
        el.dataset.square = square;

        // Coordinate labels
        if (col === 0) {
          const rank = document.createElement('span');
          rank.className = 'coord coord-rank';
          rank.textContent = ranks[row];
          el.appendChild(rank);
        }
        if (row === 7) {
          const file = document.createElement('span');
          file.className = 'coord coord-file';
          file.textContent = files[col];
          el.appendChild(file);
        }

        this.container.appendChild(el);
      }
    }
  }

  _bindEvents() {
    // Click handling
    this.container.addEventListener('click', (e) => {
      if (this._dragging) return;
      if (this._skipNextClick) { this._skipNextClick = false; return; }
      const squareEl = e.target.closest('.square');
      if (!squareEl) return;
      this._arrowOverlay.clearUserAnnotations();
      this._handleSquareClick(squareEl.dataset.square);
    });

    // Drag handling — mouse (left button)
    this.container.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const squareEl = e.target.closest('.square');
      if (!squareEl) return;
      this._handleDragStart(squareEl.dataset.square, e.clientX, e.clientY);
    });
    document.addEventListener('mousemove', (e) => {
      if (this._dragging) {
        e.preventDefault();
        this._handleDragMove(e.clientX, e.clientY);
      }
      if (this._rightClickStart) {
        this._rightClickMoved = true;
      }
    });
    document.addEventListener('mouseup', (e) => {
      if (this._dragging) {
        this._handleDragEnd(e.clientX, e.clientY);
      }
      if (e.button === 2 && this._rightClickStart) {
        this._handleRightClickEnd(e.clientX, e.clientY);
      }
    });

    // Right-click arrow drawing
    this.container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
    this.container.addEventListener('mousedown', (e) => {
      if (e.button !== 2) return;
      const squareEl = e.target.closest('.square');
      if (!squareEl) return;
      this._rightClickStart = squareEl.dataset.square;
      this._rightClickMoved = false;
    });

    // Drag handling — touch
    this.container.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      const squareEl = touch.target.closest('.square');
      if (!squareEl) return;
      this._handleDragStart(squareEl.dataset.square, touch.clientX, touch.clientY);
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if (this._dragging) {
        e.preventDefault();
        const touch = e.touches[0];
        this._handleDragMove(touch.clientX, touch.clientY);
      }
    }, { passive: false });
    document.addEventListener('touchend', (e) => {
      if (this._dragging) {
        const touch = e.changedTouches[0];
        this._handleDragEnd(touch.clientX, touch.clientY);
      }
    });
  }

  _handleRightClickEnd(x, y) {
    const startSquare = this._rightClickStart;
    this._rightClickStart = null;

    const targetEl = document.elementFromPoint(x, y);
    const squareEl = targetEl?.closest('.square');
    if (!squareEl) return;

    const endSquare = squareEl.dataset.square;
    if (endSquare === startSquare && !this._rightClickMoved) {
      this._arrowOverlay.toggleHighlight(endSquare);
    } else if (endSquare !== startSquare) {
      this._arrowOverlay.addUserArrow(startSquare, endSquare);
    }
  }

  _handleSquareClick(square) {
    if (!this._interactive) return;
    if (this.game.isGameOver()) return;

    const isOpponentTurn = this._ai && this._ai.isEnabled() &&
                           this._ai.isAITurn(this.game.getTurn());

    if (isOpponentTurn) {
      if (!this._premovesEnabled) return;
      this._handlePremoveClick(square);
      return;
    }

    const board = this.game.getBoard();
    const piece = this._getPieceAt(square, board);
    const turn = this.game.getTurn();

    // If a piece is selected and we click a legal move target
    if (this._selectedSquare && this._legalMoves.includes(square)) {
      this._executeMove(this._selectedSquare, square);
      return;
    }

    // If we click our own piece, select it
    if (piece && piece.color === turn) {
      this._selectSquare(square);
      return;
    }

    // Otherwise deselect
    this._clearSelection();
  }

  _handleDragStart(square, x, y) {
    if (!this._interactive) return;
    if (this.game.isGameOver()) return;

    const board = this.game.getBoard();
    const piece = this._getPieceAt(square, board);
    const isOpponentTurn = this._ai && this._ai.isEnabled() &&
                           this._ai.isAITurn(this.game.getTurn());
    let isPremove = false;

    if (isOpponentTurn) {
      if (!this._premovesEnabled) return;
      const playerColor = this.game.getTurn() === 'w' ? 'b' : 'w';
      if (!piece || piece.color !== playerColor) return;
      this._selectSquareForPremove(square);
      isPremove = true;
    } else {
      const turn = this.game.getTurn();
      if (!piece || piece.color !== turn) return;
      this._selectSquare(square);
    }

    // Create floating piece
    const squareEl = this._getSquareEl(square);
    const pieceImg = squareEl.querySelector('.piece');
    if (!pieceImg) return;

    const clone = pieceImg.cloneNode(true);
    clone.className = 'piece-dragging';
    const rect = squareEl.getBoundingClientRect();
    clone.style.width = rect.width + 'px';
    clone.style.height = rect.height + 'px';
    clone.style.left = (x - rect.width / 2) + 'px';
    clone.style.top = (y - rect.height / 2) + 'px';
    document.body.appendChild(clone);

    // Ghost the original
    pieceImg.classList.add('ghost');

    this._dragging = {
      square,
      clone,
      originalImg: pieceImg,
      size: rect.width,
      moved: false,
      startX: x,
      startY: y,
      isPremove,
    };
  }

  _handleDragMove(x, y) {
    if (!this._dragging) return;

    const dx = x - this._dragging.startX;
    const dy = y - this._dragging.startY;
    if (!this._dragging.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      this._dragging.moved = true;
    }

    this._dragging.clone.style.left = (x - this._dragging.size / 2) + 'px';
    this._dragging.clone.style.top = (y - this._dragging.size / 2) + 'px';
  }

  _handleDragEnd(x, y) {
    if (!this._dragging) return;

    const { square: fromSquare, clone, originalImg, moved, isPremove } = this._dragging;
    this._dragging = null;

    // Remove floating piece
    clone.remove();
    originalImg.classList.remove('ghost');

    // If we didn't actually drag, let click handle it
    if (!moved) {
      this._skipNextClick = true;
      return;
    }

    // Find the square under the cursor
    const targetEl = document.elementFromPoint(x, y);
    const squareEl = targetEl?.closest('.square');

    if (isPremove) {
      if (squareEl && squareEl.dataset.square !== fromSquare) {
        this.setPremove(fromSquare, squareEl.dataset.square);
      }
      this._clearSelection();
      return;
    }

    if (squareEl && this._legalMoves.includes(squareEl.dataset.square)) {
      this._executeMove(fromSquare, squareEl.dataset.square);
    } else {
      this._clearSelection();
    }
  }

  _selectSquare(square) {
    this._clearSelection();
    this._selectedSquare = square;
    this._legalMoves = this.game.getLegalMoves(square);

    const el = this._getSquareEl(square);
    el.classList.add('selected');

    const board = this.game.getBoard();
    for (const target of this._legalMoves) {
      const targetEl = this._getSquareEl(target);
      const targetPiece = this._getPieceAt(target, board);
      targetEl.classList.add(targetPiece ? 'legal-capture' : 'legal-move');
    }
  }

  _clearSelection() {
    if (this._selectedSquare) {
      this._getSquareEl(this._selectedSquare).classList.remove('selected');
    }
    for (const sq of this._legalMoves) {
      const el = this._getSquareEl(sq);
      el.classList.remove('legal-move', 'legal-capture');
    }
    this._selectedSquare = null;
    this._legalMoves = [];
  }

  _animateMove(from, to, onComplete) {
    const fromEl = this._getSquareEl(from);
    const toEl = this._getSquareEl(to);
    const movingPiece = fromEl.querySelector('.piece');
    const capturedPiece = toEl.querySelector('.piece');

    if (!movingPiece) {
      onComplete();
      return;
    }

    // If animations are disabled, complete immediately
    if (!this._animationsEnabled) {
      onComplete();
      return;
    }

    const board = this.game.getBoard();
    const attackerPiece = this._getPieceAt(from, board);
    const defenderPiece = this._getPieceAt(to, board);

    // Get positions
    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();

    // If this is a capture, play combat animation
    if (capturedPiece && defenderPiece && attackerPiece) {
      this.combat.playCapture(
        attackerPiece.type,
        attackerPiece.color,
        defenderPiece.type,
        defenderPiece.color,
        fromRect,
        toRect,
        onComplete
      );
    } else {
      // Regular move animation (no capture)
      const deltaX = toRect.left - fromRect.left;
      const deltaY = toRect.top - fromRect.top;

      // Make the moving piece absolutely positioned and animate it
      movingPiece.classList.add('animating');

      // Force a reflow to ensure the class is applied
      movingPiece.getBoundingClientRect();

      // Apply the transform
      movingPiece.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

      // Wait for animation to complete
      setTimeout(() => {
        onComplete();
      }, 300); // Match the CSS transition duration
    }
  }

  _executeMove(from, to) {
    this._arrowOverlay.clearUserAnnotations();

    // Check for promotion
    if (this.game.isPromotion(from, to)) {
      this._showPromotionModal(from, to);
      return;
    }

    // Animate the move first, then update the board
    this._animateMove(from, to, () => {
      const result = this.game.makeMove(from, to);
      if (result.success) {
        this._clearSelection();
        this.render();
        if (this._moveCallback) this._moveCallback(result);
      }
    });
  }

  _showPromotionModal(from, to) {
    const color = this.game.getTurn();
    const pieces = ['q', 'r', 'b', 'n'];
    const names = { q: 'Q', r: 'R', b: 'B', n: 'N' };

    this.promotionModal.innerHTML = '';
    const inner = document.createElement('div');
    inner.className = 'promotion-choices';

    for (const p of pieces) {
      const btn = document.createElement('button');
      btn.className = 'promotion-piece';
      const img = document.createElement('img');
      img.src = `${window.chessPiecePath || 'img/pieces'}/${color}${names[p]}.svg`;
      img.alt = names[p];
      img.draggable = false;
      btn.appendChild(img);
      btn.addEventListener('click', () => {
        this.promotionModal.classList.add('hidden');
        this._animateMove(from, to, () => {
          const result = this.game.makeMove(from, to, p);
          if (result.success) {
            this._clearSelection();
            this.render();
            if (this._moveCallback) this._moveCallback(result);
          }
        });
      });
      inner.appendChild(btn);
    }

    this.promotionModal.appendChild(inner);
    this.promotionModal.classList.remove('hidden');
  }

  /**
   * Execute a move on behalf of the AI (skips promotion modal)
   */
  executeAIMove(from, to, promotion) {
    this._arrowOverlay.clearUserAnnotations();
    this._animateMove(from, to, () => {
      const result = this.game.makeMove(from, to, promotion);
      if (result.success) {
        this._clearSelection();
        this.render();
        if (this._moveCallback) this._moveCallback(result);
      }
    });
  }

  _handlePremoveClick(square) {
    const board = this.game.getBoard();
    const piece = this._getPieceAt(square, board);
    const playerColor = this.game.getTurn() === 'w' ? 'b' : 'w';

    // If we have a selected square, set or change the premove
    if (this._selectedSquare) {
      if (square === this._selectedSquare) {
        this._clearSelection();
        return;
      }
      if (piece && piece.color === playerColor) {
        this._selectSquareForPremove(square);
        return;
      }
      this.setPremove(this._selectedSquare, square);
      this._clearSelection();
      return;
    }

    // Select our own piece for premove
    if (piece && piece.color === playerColor) {
      this._selectSquareForPremove(square);
      return;
    }

    // Clicked empty/opponent with nothing selected — cancel premove
    this.clearPremove();
    this._clearSelection();
  }

  _selectSquareForPremove(square) {
    this._clearSelection();
    this._selectedSquare = square;
    this._legalMoves = [];
    this._getSquareEl(square).classList.add('selected');
  }

  _renderPremoveHighlights() {
    if (!this._premove) return;
    const fromEl = this._getSquareEl(this._premove.from);
    const toEl = this._getSquareEl(this._premove.to);
    if (fromEl) fromEl.classList.add('premove-from');
    if (toEl) toEl.classList.add('premove-to');
  }

  _getSquareEl(square) {
    return this.container.querySelector(`[data-square="${square}"]`);
  }

  _getPieceAt(square, board) {
    const col = FILES.indexOf(square[0]);
    const row = RANKS.indexOf(square[1]);
    if (row === -1 || col === -1) return null;
    return board[row][col];
  }
}

export { Board };
