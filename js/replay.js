/**
 * ReplayViewer — Full-screen overlay for replaying saved chess games.
 * Uses a lightweight static board renderer (FEN → DOM), a chess.com-style
 * move list panel, and playback controls with real-time timestamp replay.
 */

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const PIECE_MAP = {
  K: 'wK', Q: 'wQ', R: 'wR', B: 'wB', N: 'wN', P: 'wP',
  k: 'bK', q: 'bQ', r: 'bR', b: 'bB', n: 'bN', p: 'bP',
};

class ReplayViewer {
  constructor() {
    this._game = null;
    this._currentPly = -1;      // -1 = starting position
    this._isPlaying = false;
    this._playbackTimer = null;
    this._overlay = null;
    this._boardEl = null;
    this._moveListEl = null;
    this._playBtn = null;
    this._resultEl = null;
    this._gameInfoEl = null;
    this._keyHandler = null;
    this._buildDOM();
  }

  /**
   * Open the viewer with a saved game record.
   */
  open(gameRecord) {
    this._game = gameRecord;
    this._currentPly = -1;
    this._isPlaying = false;

    // Render game info header
    const date = new Date(gameRecord.startTime);
    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
    this._gameInfoEl.textContent =
      `${gameRecord.white.name} vs ${gameRecord.black.name} — ${dateStr}`;

    // Render result
    if (gameRecord.result) {
      this._resultEl.textContent = this._formatResult(gameRecord);
      this._resultEl.style.display = '';
    } else {
      this._resultEl.textContent = 'Game in progress';
      this._resultEl.style.display = '';
    }

    // Build the move list
    this._renderMoveList();

    // Show starting position
    this._renderBoard(gameRecord.startingFen);
    this._highlightCurrentMove();
    this._updateButtons();

    // Show overlay
    this._overlay.classList.remove('hidden');

    // Keyboard shortcuts
    this._keyHandler = (e) => this._handleKey(e);
    document.addEventListener('keydown', this._keyHandler);
  }

  /**
   * Close the viewer.
   */
  close() {
    this._stopPlayback();
    this._overlay.classList.add('hidden');
    this._game = null;
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
  }

  // --- Navigation ---

  _goToMove(plyIndex) {
    if (!this._game) return;
    const maxPly = this._game.moves.length - 1;
    this._currentPly = Math.max(-1, Math.min(plyIndex, maxPly));

    if (this._currentPly === -1) {
      this._renderBoard(this._game.startingFen);
    } else {
      this._renderBoard(this._game.moves[this._currentPly].fen);
    }

    this._highlightCurrentMove();
    this._updateButtons();
  }

  _next() {
    if (!this._game) return;
    if (this._currentPly >= this._game.moves.length - 1) {
      this._stopPlayback();
      return;
    }
    this._goToMove(this._currentPly + 1);
  }

  _prev() {
    this._goToMove(this._currentPly - 1);
  }

  _goToStart() {
    this._stopPlayback();
    this._goToMove(-1);
  }

  _goToEnd() {
    this._stopPlayback();
    if (this._game) {
      this._goToMove(this._game.moves.length - 1);
    }
  }

  // --- Playback ---

  _togglePlay() {
    if (this._isPlaying) {
      this._stopPlayback();
    } else {
      this._startPlayback();
    }
  }

  _startPlayback() {
    if (!this._game) return;
    if (this._currentPly >= this._game.moves.length - 1) {
      // If at end, restart from beginning
      this._goToMove(-1);
    }
    this._isPlaying = true;
    this._playBtn.textContent = '⏸';
    this._playBtn.classList.add('playing');
    this._scheduleNext();
  }

  _stopPlayback() {
    this._isPlaying = false;
    if (this._playbackTimer) {
      clearTimeout(this._playbackTimer);
      this._playbackTimer = null;
    }
    if (this._playBtn) {
      this._playBtn.textContent = '▶';
      this._playBtn.classList.remove('playing');
    }
  }

  _scheduleNext() {
    if (!this._isPlaying || !this._game) return;
    if (this._currentPly >= this._game.moves.length - 1) {
      this._stopPlayback();
      return;
    }

    const nextPly = this._currentPly + 1;
    const nextMove = this._game.moves[nextPly];

    let delay;
    if (this._currentPly === -1) {
      // Delay from game start to first move
      delay = nextMove.timestamp - this._game.startTime;
    } else {
      const currentMove = this._game.moves[this._currentPly];
      delay = nextMove.timestamp - currentMove.timestamp;
    }

    // Clamp delay between 200ms and 5000ms
    delay = Math.max(200, Math.min(delay, 5000));

    this._playbackTimer = setTimeout(() => {
      this._next();
      if (this._isPlaying) {
        this._scheduleNext();
      }
    }, delay);
  }

  // --- Board Rendering ---

  _renderBoard(fen) {
    if (!this._boardEl) return;
    const squares = this._boardEl.children;
    const ranks = fen.split(' ')[0].split('/');

    let idx = 0;
    for (let rank = 0; rank < 8; rank++) {
      let file = 0;
      for (const ch of ranks[rank]) {
        if (ch >= '1' && ch <= '8') {
          const empty = parseInt(ch, 10);
          for (let e = 0; e < empty; e++) {
            const sq = squares[idx++];
            sq.innerHTML = '';
            file++;
          }
        } else {
          const sq = squares[idx++];
          const pieceFile = PIECE_MAP[ch];
          if (pieceFile) {
            sq.innerHTML = `<img class="piece" src="${window.chessPiecePath}/${pieceFile}.svg" alt="${ch}" draggable="false">`;
          } else {
            sq.innerHTML = '';
          }
          file++;
        }
      }
    }
  }

  // --- Move List ---

  _renderMoveList() {
    if (!this._game || !this._moveListEl) return;
    this._moveListEl.innerHTML = '';

    const moves = this._game.moves;
    for (let i = 0; i < moves.length; i += 2) {
      const row = document.createElement('div');
      row.className = 'move-row';

      const moveNum = Math.floor(i / 2) + 1;
      const numEl = document.createElement('span');
      numEl.className = 'move-number';
      numEl.textContent = `${moveNum}.`;
      row.appendChild(numEl);

      // White move
      const whiteEl = document.createElement('span');
      whiteEl.className = 'move-white';
      whiteEl.textContent = moves[i].san;
      whiteEl.dataset.ply = i;
      whiteEl.addEventListener('click', () => {
        this._stopPlayback();
        this._goToMove(parseInt(whiteEl.dataset.ply, 10));
      });
      row.appendChild(whiteEl);

      // Black move (if exists)
      if (i + 1 < moves.length) {
        const blackEl = document.createElement('span');
        blackEl.className = 'move-black';
        blackEl.textContent = moves[i + 1].san;
        blackEl.dataset.ply = i + 1;
        blackEl.addEventListener('click', () => {
          this._stopPlayback();
          this._goToMove(parseInt(blackEl.dataset.ply, 10));
        });
        row.appendChild(blackEl);
      }

      this._moveListEl.appendChild(row);
    }
  }

  _highlightCurrentMove() {
    if (!this._moveListEl) return;

    // Remove all highlights
    this._moveListEl.querySelectorAll('.move-active').forEach(el => {
      el.classList.remove('move-active');
    });

    if (this._currentPly >= 0) {
      const el = this._moveListEl.querySelector(`[data-ply="${this._currentPly}"]`);
      if (el) {
        el.classList.add('move-active');
        // Auto-scroll to keep current move visible
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }

  _updateButtons() {
    if (!this._game) return;
    const atStart = this._currentPly === -1;
    const atEnd = this._currentPly >= this._game.moves.length - 1;

    const startBtn = this._overlay.querySelector('#replay-start');
    const prevBtn = this._overlay.querySelector('#replay-prev');
    const nextBtn = this._overlay.querySelector('#replay-next');
    const endBtn = this._overlay.querySelector('#replay-end');

    if (startBtn) startBtn.disabled = atStart;
    if (prevBtn) prevBtn.disabled = atStart;
    if (nextBtn) nextBtn.disabled = atEnd;
    if (endBtn) endBtn.disabled = atEnd;
  }

  // --- Keyboard ---

  _handleKey(e) {
    if (!this._game) return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        this._prev();
        break;
      case 'ArrowRight':
        e.preventDefault();
        this._next();
        break;
      case ' ':
        e.preventDefault();
        this._togglePlay();
        break;
      case 'Home':
        e.preventDefault();
        this._goToStart();
        break;
      case 'End':
        e.preventDefault();
        this._goToEnd();
        break;
      case 'Escape':
        e.preventDefault();
        this.close();
        break;
    }
  }

  // --- Result Formatting ---

  _formatResult(game) {
    if (!game.result) return '';

    if (game.result === 'abandoned') {
      return 'Abandoned';
    }

    const reasons = {
      checkmate: 'Checkmate',
      stalemate: 'Stalemate',
      timeout: 'Time out',
      insufficient: 'Insufficient material',
      threefold: 'Threefold repetition',
      '50-move': 'Fifty-move rule',
      draw: 'Draw',
    };

    const reason = reasons[game.resultReason] || '';

    if (game.result === 'draw') {
      return reason ? `Draw — ${reason}` : 'Draw';
    }

    const winner = game.result === 'white' ? 'White' : 'Black';
    return reason ? `${reason}! ${winner} wins` : `${winner} wins`;
  }

  // --- DOM Construction ---

  _buildDOM() {
    this._overlay = document.createElement('div');
    this._overlay.className = 'replay-overlay hidden';

    const container = document.createElement('div');
    container.className = 'replay-container';

    // Header
    const header = document.createElement('div');
    header.className = 'replay-header';

    this._gameInfoEl = document.createElement('div');
    this._gameInfoEl.className = 'replay-game-info';
    header.appendChild(this._gameInfoEl);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'replay-close-btn';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this.close());
    header.appendChild(closeBtn);

    container.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'replay-body';

    // Board area
    const boardArea = document.createElement('div');
    boardArea.className = 'replay-board-area';

    this._boardEl = document.createElement('div');
    this._boardEl.className = 'board replay-board';
    this._buildBoardSquares();
    boardArea.appendChild(this._boardEl);

    // Controls
    const controls = document.createElement('div');
    controls.className = 'replay-controls';

    const btnStart = this._createBtn('replay-start', '|◀', () => this._goToStart());
    const btnPrev = this._createBtn('replay-prev', '◀', () => this._prev());
    this._playBtn = this._createBtn('replay-play', '▶', () => this._togglePlay());
    this._playBtn.classList.add('replay-btn-play');
    const btnNext = this._createBtn('replay-next', '▶', () => this._next());
    const btnEnd = this._createBtn('replay-end', '▶|', () => this._goToEnd());

    controls.appendChild(btnStart);
    controls.appendChild(btnPrev);
    controls.appendChild(this._playBtn);
    controls.appendChild(btnNext);
    controls.appendChild(btnEnd);
    boardArea.appendChild(controls);

    body.appendChild(boardArea);

    // Move list
    this._moveListEl = document.createElement('div');
    this._moveListEl.className = 'replay-move-list';
    body.appendChild(this._moveListEl);

    container.appendChild(body);

    // Result
    this._resultEl = document.createElement('div');
    this._resultEl.className = 'replay-result';
    container.appendChild(this._resultEl);

    this._overlay.appendChild(container);
    document.body.appendChild(this._overlay);
  }

  _buildBoardSquares() {
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const sq = document.createElement('div');
        const isLight = (rank + file) % 2 === 0;
        sq.className = `square ${isLight ? 'light' : 'dark'}`;
        this._boardEl.appendChild(sq);
      }
    }
  }

  _createBtn(id, text, onClick) {
    const btn = document.createElement('button');
    btn.className = 'replay-btn';
    btn.id = id;
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    return btn;
  }
}

export { ReplayViewer };
