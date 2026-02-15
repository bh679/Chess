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
    this._moveCallback = null;
    this._selectedSquare = null;
    this._legalMoves = [];
    this._dragging = null;

    this._buildGrid();
    this._bindEvents();
  }

  onMove(callback) {
    this._moveCallback = callback;
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
        el.classList.remove('selected', 'legal-move', 'legal-capture', 'last-move', 'check');

        // Remove existing piece
        const existingImg = el.querySelector('.piece');
        if (existingImg) existingImg.remove();

        // Place piece
        const piece = board[row][col];
        if (piece) {
          const img = document.createElement('img');
          img.className = 'piece';
          img.src = `img/pieces/${piece.color}${PIECE_MAP[piece.type]}.svg`;
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
  }

  _buildGrid() {
    this.container.innerHTML = '';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const square = FILES[col] + RANKS[row];
        const el = document.createElement('div');
        el.className = 'square ' + ((row + col) % 2 === 0 ? 'light' : 'dark');
        el.dataset.square = square;

        // Coordinate labels
        if (col === 0) {
          const rank = document.createElement('span');
          rank.className = 'coord coord-rank';
          rank.textContent = RANKS[row];
          el.appendChild(rank);
        }
        if (row === 7) {
          const file = document.createElement('span');
          file.className = 'coord coord-file';
          file.textContent = FILES[col];
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
      const squareEl = e.target.closest('.square');
      if (!squareEl) return;
      this._handleSquareClick(squareEl.dataset.square);
    });

    // Drag handling — mouse
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
    });
    document.addEventListener('mouseup', (e) => {
      if (this._dragging) {
        this._handleDragEnd(e.clientX, e.clientY);
      }
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

  _handleSquareClick(square) {
    if (this.game.isGameOver()) return;

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
    if (this.game.isGameOver()) return;

    const board = this.game.getBoard();
    const piece = this._getPieceAt(square, board);
    const turn = this.game.getTurn();

    if (!piece || piece.color !== turn) return;

    // Select this square (shows legal moves)
    this._selectSquare(square);

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

    const { square: fromSquare, clone, originalImg, moved } = this._dragging;
    this._dragging = null;

    // Remove floating piece
    clone.remove();
    originalImg.classList.remove('ghost');

    // If we didn't actually drag, let click handle it
    if (!moved) return;

    // Find the square under the cursor
    const targetEl = document.elementFromPoint(x, y);
    const squareEl = targetEl?.closest('.square');

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

  _executeMove(from, to) {
    // Check for promotion
    if (this.game.isPromotion(from, to)) {
      this._showPromotionModal(from, to);
      return;
    }

    const result = this.game.makeMove(from, to);
    if (result.success) {
      this._clearSelection();
      this.render();
      if (this._moveCallback) this._moveCallback(result);
    }
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
      img.src = `img/pieces/${color}${names[p]}.svg`;
      img.alt = names[p];
      img.draggable = false;
      btn.appendChild(img);
      btn.addEventListener('click', () => {
        this.promotionModal.classList.add('hidden');
        const result = this.game.makeMove(from, to, p);
        if (result.success) {
          this._clearSelection();
          this.render();
          if (this._moveCallback) this._moveCallback(result);
        }
      });
      inner.appendChild(btn);
    }

    this.promotionModal.appendChild(inner);
    this.promotionModal.classList.remove('hidden');
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
