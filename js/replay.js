/**
 * ReplayViewer — Full-screen overlay for replaying saved chess games.
 * Uses a lightweight static board renderer (FEN → DOM), horizontal
 * per-color move strips, reconstructed clocks, and playback controls.
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
    this._rafId = null;          // requestAnimationFrame for clock countdown
    this._playbackStartTime = 0; // when current delay started
    this._playbackDelay = 0;     // duration of current delay
    this._clockSnapshots = [];   // reconstructed clocks per ply
    this._overlay = null;
    this._boardEl = null;
    this._whiteMovesCtnr = null;
    this._blackMovesCtnr = null;
    this._whiteTimerEl = null;
    this._blackTimerEl = null;
    this._playBtn = null;
    this._resultEl = null;
    this._titleEl = null;
    this._subtitleEl = null;
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

    // Render title
    const date = new Date(gameRecord.startTime);
    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
    this._titleEl.textContent =
      `${gameRecord.white.name} vs ${gameRecord.black.name} — ${dateStr}`;

    // Render subtitle (game mode + time control)
    const gameType = gameRecord.gameType === 'chess960' ? 'Chess960' : 'Standard';
    const timeControl = gameRecord.timeControl || 'No Timer';
    this._subtitleEl.textContent = `${gameType} • ${timeControl}`;

    // Render result
    if (gameRecord.result) {
      this._resultEl.textContent = this._formatResult(gameRecord);
      this._resultEl.style.display = '';
    } else {
      this._resultEl.textContent = 'Game in progress';
      this._resultEl.style.display = '';
    }

    // Reconstruct clocks
    this._reconstructClocks();

    // Build the move strips
    this._renderMoveStrips();

    // Show starting position
    this._renderBoard(gameRecord.startingFen);
    this._highlightCurrentMove();
    this._updateButtons();
    this._updateTimers();

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

  // --- Clock Reconstruction ---

  _parseTimeControl(tc) {
    if (!tc || tc === 'none' || tc === 'No Timer') return null;
    // Formats: "Rapid 10+0", "Blitz 3+2", "Bullet 1+0", "Classical 30+0", "Custom 5+3"
    // Also "Custom W5 / B3 +2"
    const match = tc.match(/(\d+)\+(\d+)/);
    if (!match) return null;
    return { baseSec: parseInt(match[1], 10) * 60, increment: parseInt(match[2], 10) };
  }

  _reconstructClocks() {
    this._clockSnapshots = [];
    if (!this._game) return;

    const tc = this._parseTimeControl(this._game.timeControl);
    if (!tc) {
      // No time control — fill with null snapshots
      for (let i = 0; i < this._game.moves.length; i++) {
        this._clockSnapshots.push(null);
      }
      return;
    }

    let whiteTime = tc.baseSec;
    let blackTime = tc.baseSec;
    let prevTimestamp = this._game.startTime;

    for (let i = 0; i < this._game.moves.length; i++) {
      const move = this._game.moves[i];
      const timeSpentMs = move.timestamp - prevTimestamp;
      const timeSpentSec = timeSpentMs / 1000;

      if (move.side === 'w') {
        whiteTime = Math.max(0, whiteTime - timeSpentSec);
        whiteTime += tc.increment;
      } else {
        blackTime = Math.max(0, blackTime - timeSpentSec);
        blackTime += tc.increment;
      }

      this._clockSnapshots.push({ w: whiteTime, b: blackTime });
      prevTimestamp = move.timestamp;
    }
  }

  _formatClock(seconds) {
    if (seconds == null) return '--:--';
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      return `${h}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  _updateTimers() {
    if (!this._game) return;

    if (this._currentPly === -1) {
      // Starting position — show initial clocks
      const tc = this._parseTimeControl(this._game.timeControl);
      if (tc) {
        this._whiteTimerEl.textContent = this._formatClock(tc.baseSec);
        this._blackTimerEl.textContent = this._formatClock(tc.baseSec);
      } else {
        this._whiteTimerEl.textContent = '--:--';
        this._blackTimerEl.textContent = '--:--';
      }
      // White moves first
      this._setActiveTimer('w');
      return;
    }

    const snapshot = this._clockSnapshots[this._currentPly];
    if (!snapshot) {
      this._whiteTimerEl.textContent = '--:--';
      this._blackTimerEl.textContent = '--:--';
      this._setActiveTimer(null);
      return;
    }

    this._whiteTimerEl.textContent = this._formatClock(snapshot.w);
    this._blackTimerEl.textContent = this._formatClock(snapshot.b);

    // Highlight the side whose clock is counting (the side about to move)
    const nextPly = this._currentPly + 1;
    if (nextPly < this._game.moves.length) {
      this._setActiveTimer(this._game.moves[nextPly].side);
    } else {
      // Game over — no active timer
      this._setActiveTimer(null);
    }
  }

  _setActiveTimer(side) {
    this._whiteTimerEl.classList.toggle('timer-active', side === 'w');
    this._blackTimerEl.classList.toggle('timer-active', side === 'b');
  }

  _startClockAnimation() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    if (!this._game || this._currentPly < -1) return;

    const snapshot = this._currentPly >= 0 ? this._clockSnapshots[this._currentPly] : null;
    if (!snapshot) return;

    // Determine whose turn it is (next move's side)
    const nextPly = this._currentPly + 1;
    if (nextPly >= this._game.moves.length) return;
    const activeSide = this._game.moves[nextPly].side;

    const startClock = snapshot[activeSide];
    const startWall = performance.now();

    const animate = () => {
      if (!this._isPlaying) return;
      const elapsed = (performance.now() - startWall) / 1000;
      const remaining = Math.max(0, startClock - elapsed);

      if (activeSide === 'w') {
        this._whiteTimerEl.textContent = this._formatClock(remaining);
      } else {
        this._blackTimerEl.textContent = this._formatClock(remaining);
      }

      this._rafId = requestAnimationFrame(animate);
    };

    this._rafId = requestAnimationFrame(animate);
  }

  _stopClockAnimation() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
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
    this._updateTimers();
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
      this._goToMove(-1);
    }
    this._isPlaying = true;
    this._playBtn.textContent = '⏸';
    this._playBtn.classList.add('playing');
    this._scheduleNext();
  }

  _stopPlayback() {
    this._isPlaying = false;
    this._stopClockAnimation();
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
      delay = nextMove.timestamp - this._game.startTime;
    } else {
      const currentMove = this._game.moves[this._currentPly];
      delay = nextMove.timestamp - currentMove.timestamp;
    }

    // Clamp delay between 200ms and 5000ms
    delay = Math.max(200, Math.min(delay, 5000));

    // Start clock countdown animation
    this._startClockAnimation();

    this._playbackTimer = setTimeout(() => {
      this._stopClockAnimation();
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

  // --- Move Strips ---

  _renderMoveStrips() {
    if (!this._game) return;

    this._whiteMovesCtnr.innerHTML = '';
    this._blackMovesCtnr.innerHTML = '';

    const moves = this._game.moves;
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const moveNum = Math.floor(i / 2) + 1;
      const isWhite = move.side === 'w';
      const container = isWhite ? this._whiteMovesCtnr : this._blackMovesCtnr;

      // Move number
      const numEl = document.createElement('span');
      numEl.className = 'strip-move-num';
      numEl.textContent = `${moveNum}.`;
      container.appendChild(numEl);

      // Move SAN
      const moveEl = document.createElement('span');
      moveEl.className = 'strip-move';
      moveEl.textContent = move.san;
      moveEl.dataset.ply = i;
      moveEl.addEventListener('click', () => {
        this._stopPlayback();
        this._goToMove(parseInt(moveEl.dataset.ply, 10));
      });
      container.appendChild(moveEl);
    }
  }

  _highlightCurrentMove() {
    // Remove all highlights from both strips
    this._overlay.querySelectorAll('.strip-move-active').forEach(el => {
      el.classList.remove('strip-move-active');
    });

    if (this._currentPly >= 0) {
      const el = this._overlay.querySelector(`.strip-move[data-ply="${this._currentPly}"]`);
      if (el) {
        el.classList.add('strip-move-active');
        // Auto-scroll the strip to keep active move visible
        el.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
      }
    } else {
      // At starting position — scroll both strips to the beginning
      this._overlay.querySelectorAll('.strip-moves').forEach(s => {
        s.scrollLeft = 0;
      });
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

  // --- Scroll Buttons ---

  _setupScrollButtons(strip) {
    const leftBtn = strip.querySelector('.strip-scroll-btn-left');
    const rightBtn = strip.querySelector('.strip-scroll-btn-right');
    const movesEl = strip.querySelector('.strip-moves');

    if (!leftBtn || !rightBtn || !movesEl) return;

    const updateBtns = () => {
      leftBtn.disabled = movesEl.scrollLeft <= 0;
      rightBtn.disabled = movesEl.scrollLeft >= movesEl.scrollWidth - movesEl.clientWidth - 1;
    };

    leftBtn.addEventListener('click', () => {
      movesEl.scrollBy({ left: -150, behavior: 'smooth' });
    });
    rightBtn.addEventListener('click', () => {
      movesEl.scrollBy({ left: 150, behavior: 'smooth' });
    });

    movesEl.addEventListener('scroll', updateBtns);
    // Initial state
    setTimeout(updateBtns, 50);
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

    const gameInfo = document.createElement('div');
    gameInfo.className = 'replay-game-info';

    this._titleEl = document.createElement('div');
    this._titleEl.className = 'replay-title';
    gameInfo.appendChild(this._titleEl);

    this._subtitleEl = document.createElement('div');
    this._subtitleEl.className = 'replay-subtitle';
    gameInfo.appendChild(this._subtitleEl);

    header.appendChild(gameInfo);

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

    // Black timer (top)
    const topBar = document.createElement('div');
    topBar.className = 'replay-player-bar top';
    this._blackTimerEl = document.createElement('div');
    this._blackTimerEl.className = 'replay-timer';
    this._blackTimerEl.textContent = '--:--';
    topBar.appendChild(this._blackTimerEl);
    boardArea.appendChild(topBar);

    // Black moves strip (above board)
    const blackStrip = this._buildMoveStrip('black-moves');
    this._blackMovesCtnr = blackStrip.querySelector('.strip-moves');
    boardArea.appendChild(blackStrip);

    // Board
    this._boardEl = document.createElement('div');
    this._boardEl.className = 'board replay-board';
    this._buildBoardSquares();
    boardArea.appendChild(this._boardEl);

    // White moves strip (below board)
    const whiteStrip = this._buildMoveStrip('white-moves');
    this._whiteMovesCtnr = whiteStrip.querySelector('.strip-moves');
    boardArea.appendChild(whiteStrip);

    // White timer (bottom)
    const bottomBar = document.createElement('div');
    bottomBar.className = 'replay-player-bar bottom';
    this._whiteTimerEl = document.createElement('div');
    this._whiteTimerEl.className = 'replay-timer';
    this._whiteTimerEl.textContent = '--:--';
    bottomBar.appendChild(this._whiteTimerEl);
    boardArea.appendChild(bottomBar);

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
    container.appendChild(body);

    // Result
    this._resultEl = document.createElement('div');
    this._resultEl.className = 'replay-result';
    container.appendChild(this._resultEl);

    this._overlay.appendChild(container);
    document.body.appendChild(this._overlay);
  }

  _buildMoveStrip(className) {
    const strip = document.createElement('div');
    strip.className = `replay-move-strip ${className}`;

    const leftBtn = document.createElement('button');
    leftBtn.className = 'strip-scroll-btn strip-scroll-btn-left';
    leftBtn.textContent = '◀';
    strip.appendChild(leftBtn);

    const moves = document.createElement('div');
    moves.className = 'strip-moves';
    strip.appendChild(moves);

    const rightBtn = document.createElement('button');
    rightBtn.className = 'strip-scroll-btn strip-scroll-btn-right';
    rightBtn.textContent = '▶';
    strip.appendChild(rightBtn);

    // Setup scroll buttons after strip is added to DOM
    setTimeout(() => this._setupScrollButtons(strip), 0);

    return strip;
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
