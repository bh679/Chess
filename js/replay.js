/**
 * ReplayViewer — Full-screen overlay for replaying saved chess games.
 * Uses a lightweight static board renderer (FEN → DOM), horizontal
 * per-color move strips, reconstructed clocks, and playback controls.
 *
 * Analysis Review integration: after Board Analysis completes, call
 * setAnalysis(result) to enrich the replay with move classifications,
 * accuracy bars, a detail panel, and critical moment navigation.
 */

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const PIECE_MAP = {
  K: 'wK', Q: 'wQ', R: 'wR', B: 'wB', N: 'wN', P: 'wP',
  k: 'bK', q: 'bQ', r: 'bR', b: 'bB', n: 'bN', p: 'bP',
};

const CLASSIFICATION_ICONS = {
  best:       { text: '\u2713', cls: 'analysis-best' },       // checkmark
  good:       { text: '\u25CF', cls: 'analysis-good' },       // dot
  inaccuracy: { text: '?!',    cls: 'analysis-inaccuracy' },
  mistake:    { text: '?',     cls: 'analysis-mistake' },
  blunder:    { text: '??',    cls: 'analysis-blunder' },
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

    // Analysis Review fields
    this._analysisData = null;
    this._analyzeCallback = null;
    this._autoAnalyzeCheckbox = null;
    this._progressBarEl = null;
    this._progressFillEl = null;
    this._detailPanel = null;
    this._detailClassEl = null;
    this._detailEvalEl = null;
    this._detailBestEl = null;
    this._detailLineEl = null;
    this._accuracyPanel = null;
    this._critPrevBtn = null;
    this._critNextBtn = null;

    this._buildDOM();
  }

  /**
   * Open the viewer with a saved game record.
   */
  open(gameRecord) {
    this._game = gameRecord;
    this._currentPly = -1;
    this._isPlaying = false;

    // Reset analysis state
    this._analysisData = null;
    this._resetAnalysisUI();

    // Render title
    const date = new Date(gameRecord.startTime);
    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
    this._titleEl.textContent =
      `${gameRecord.white.name} vs ${gameRecord.black.name} \u2014 ${dateStr}`;

    // Render subtitle (game mode + time control)
    const gameType = gameRecord.gameType === 'chess960' ? 'Chess960' : 'Standard';
    const timeControl = gameRecord.timeControl || 'No Timer';
    this._subtitleEl.textContent = `${gameType} \u2022 ${timeControl}`;

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

    // Auto-analyze if toggle is enabled
    if (this.isAutoAnalyzeEnabled() && this._analyzeCallback) {
      this._analyzeCallback(gameRecord);
    }
  }

  /**
   * Close the viewer.
   */
  close() {
    this._stopPlayback();
    this._overlay.classList.add('hidden');
    this._game = null;
    this._analysisData = null;
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
  }

  // --- Analysis Review Integration ---

  /**
   * Set a callback that runs analysis when the Analyze button is clicked.
   * Called by GameBrowser after opening a game.
   * @param {Function} callback — receives (gameRecord)
   */
  setAnalyzeCallback(callback) {
    this._analyzeCallback = callback;
  }

  /**
   * Accept analysis results and enrich the replay UI.
   * @param {Object} analysisResult — from AnalysisEngine.analyze()
   */
  setAnalysis(analysisResult) {
    this._analysisData = analysisResult;

    // Hide progress bar
    this.hideAnalysisProgress();

    // Add classification icons to move strips
    this._addClassificationIcons();

    // Render accuracy summary
    this._renderAccuracySummary();

    // Show critical moment nav buttons
    this._updateCriticalNav();

    // Show detail panel for current move
    this._updateDetailPanel();
  }

  /**
   * Show analysis progress bar.
   * @param {number} current
   * @param {number} total
   */
  showAnalysisProgress(current, total) {
    this._progressBarEl.classList.remove('hidden');
    const pct = total > 0 ? (current / total * 100) : 0;
    this._progressFillEl.style.width = `${pct}%`;
  }

  /**
   * Hide analysis progress bar.
   */
  hideAnalysisProgress() {
    this._progressBarEl.classList.add('hidden');
    this._progressFillEl.style.width = '0%';
  }

  /**
   * Returns true if auto-analyze is enabled.
   */
  isAutoAnalyzeEnabled() {
    return this._autoAnalyzeCheckbox && this._autoAnalyzeCheckbox.checked;
  }

  /**
   * Reset all analysis UI elements to their default hidden state.
   */
  _resetAnalysisUI() {
    // Hide progress
    if (this._progressBarEl) {
      this._progressBarEl.classList.add('hidden');
      this._progressFillEl.style.width = '0%';
    }
    // Hide detail panel
    if (this._detailPanel) {
      this._detailPanel.classList.add('hidden');
    }
    // Hide accuracy panel
    if (this._accuracyPanel) {
      this._accuracyPanel.classList.add('hidden');
      this._accuracyPanel.innerHTML = '';
    }
    // Hide critical nav
    if (this._critPrevBtn) this._critPrevBtn.classList.add('hidden');
    if (this._critNextBtn) this._critNextBtn.classList.add('hidden');
  }

  /**
   * Add classification icons to move strip elements.
   */
  _addClassificationIcons() {
    if (!this._analysisData) return;

    const moveEls = this._overlay.querySelectorAll('.strip-move[data-ply]');
    const criticalSet = new Set(this._analysisData.criticalMoments);

    moveEls.forEach(el => {
      const ply = parseInt(el.dataset.ply, 10);
      // analysis positions[0] = starting pos, positions[ply+1] = after move at ply index
      const posIdx = ply + 1;
      if (posIdx >= this._analysisData.positions.length) return;

      const pos = this._analysisData.positions[posIdx];
      if (!pos || !pos.classification) return;

      const iconDef = CLASSIFICATION_ICONS[pos.classification];
      if (!iconDef) return;

      // Remove any existing icon
      const existing = el.querySelector('.analysis-icon');
      if (existing) existing.remove();

      const icon = document.createElement('span');
      icon.className = `analysis-icon ${iconDef.cls}`;
      icon.textContent = iconDef.text;
      el.prepend(icon);

      // Mark critical moments
      if (criticalSet.has(posIdx)) {
        el.classList.add('analysis-critical');
      }
    });
  }

  /**
   * Render accuracy summary below controls.
   */
  _renderAccuracySummary() {
    if (!this._analysisData || !this._accuracyPanel) return;

    const summary = this._analysisData.summary;
    this._accuracyPanel.innerHTML = '';
    this._accuracyPanel.classList.remove('hidden');

    for (const side of ['white', 'black']) {
      const s = summary[side];
      const div = document.createElement('div');
      div.className = 'accuracy-side';

      const header = document.createElement('div');
      header.className = 'accuracy-header';

      const label = document.createElement('span');
      label.className = 'accuracy-label';
      label.textContent = side === 'white' ? 'White' : 'Black';
      header.appendChild(label);

      const value = document.createElement('span');
      value.className = 'accuracy-value';
      value.textContent = `${s.accuracy}%`;
      header.appendChild(value);

      div.appendChild(header);

      const barOuter = document.createElement('div');
      barOuter.className = 'accuracy-bar';
      const barFill = document.createElement('div');
      barFill.className = 'accuracy-fill';
      barFill.style.width = `${s.accuracy}%`;
      barOuter.appendChild(barFill);
      div.appendChild(barOuter);

      const breakdown = document.createElement('div');
      breakdown.className = 'accuracy-breakdown';
      breakdown.textContent = `B:${s.best} G:${s.good} I:${s.inaccuracy} M:${s.mistake} BL:${s.blunder}`;
      div.appendChild(breakdown);

      this._accuracyPanel.appendChild(div);
    }
  }

  /**
   * Update the detail panel for the current move.
   */
  _updateDetailPanel() {
    if (!this._analysisData || !this._detailPanel) {
      if (this._detailPanel) this._detailPanel.classList.add('hidden');
      return;
    }

    // positions[0] = starting, positions[ply+1] = after move ply
    const posIdx = this._currentPly + 1;
    if (posIdx < 0 || posIdx >= this._analysisData.positions.length) {
      this._detailPanel.classList.add('hidden');
      return;
    }

    const pos = this._analysisData.positions[posIdx];
    this._detailPanel.classList.remove('hidden');

    // Classification + cpLoss
    if (pos.classification) {
      const iconDef = CLASSIFICATION_ICONS[pos.classification] || {};
      this._detailClassEl.innerHTML = '';
      const icon = document.createElement('span');
      icon.className = `analysis-icon ${iconDef.cls || ''}`;
      icon.textContent = iconDef.text || '';
      this._detailClassEl.appendChild(icon);
      const label = document.createElement('span');
      const classLabel = pos.classification.charAt(0).toUpperCase() + pos.classification.slice(1);
      label.textContent = ` ${classLabel}${pos.cpLoss > 0 ? ` (${pos.cpLoss}cp)` : ''}`;
      this._detailClassEl.appendChild(label);
    } else {
      this._detailClassEl.textContent = 'Starting position';
    }

    // Eval
    const evalPawns = pos.eval / 100;
    const evalSign = evalPawns >= 0 ? '+' : '';
    const evalDisplay = Math.abs(pos.eval) >= 9900
      ? (pos.eval > 0 ? '+M' : '-M')
      : `${evalSign}${evalPawns.toFixed(2)}`;
    this._detailEvalEl.textContent = `Eval: ${evalDisplay}`;

    // Best move
    if (pos.bestMoveUci) {
      this._detailBestEl.textContent = `Best: ${pos.bestMoveUci}`;
    } else {
      this._detailBestEl.textContent = '';
    }

    // PV line (first 5 moves)
    if (pos.bestLineUci && pos.bestLineUci.length > 0) {
      const line = pos.bestLineUci.slice(0, 5).join(' ');
      this._detailLineEl.textContent = `Line: ${line}`;
    } else {
      this._detailLineEl.textContent = '';
    }
  }

  /**
   * Update critical moment navigation button states.
   */
  _updateCriticalNav() {
    if (!this._analysisData || !this._analysisData.criticalMoments.length) {
      if (this._critPrevBtn) this._critPrevBtn.classList.add('hidden');
      if (this._critNextBtn) this._critNextBtn.classList.add('hidden');
      return;
    }

    this._critPrevBtn.classList.remove('hidden');
    this._critNextBtn.classList.remove('hidden');

    const moments = this._analysisData.criticalMoments;
    const curPos = this._currentPly + 1; // current analysis position index

    const prevCrit = moments.filter(m => m < curPos);
    const nextCrit = moments.filter(m => m > curPos);

    this._critPrevBtn.disabled = prevCrit.length === 0;
    this._critNextBtn.disabled = nextCrit.length === 0;
  }

  _goToPrevCritical() {
    if (!this._analysisData) return;
    const moments = this._analysisData.criticalMoments;
    const curPos = this._currentPly + 1;
    const prev = moments.filter(m => m < curPos);
    if (prev.length > 0) {
      const targetPos = prev[prev.length - 1];
      this._stopPlayback();
      this._goToMove(targetPos - 1); // convert analysis position to ply
    }
  }

  _goToNextCritical() {
    if (!this._analysisData) return;
    const moments = this._analysisData.criticalMoments;
    const curPos = this._currentPly + 1;
    const next = moments.filter(m => m > curPos);
    if (next.length > 0) {
      const targetPos = next[0];
      this._stopPlayback();
      this._goToMove(targetPos - 1); // convert analysis position to ply
    }
  }

  // --- Clock Reconstruction ---

  _parseTimeControl(tc) {
    if (!tc || tc === 'none' || tc === 'No Timer') return null;
    // Odds format: "Custom W10 / B5 +2"
    const oddsMatch = tc.match(/W(\d+)\s*\/\s*B(\d+)\s*\+(\d+)/);
    if (oddsMatch) {
      return {
        baseSec: parseInt(oddsMatch[1], 10) * 60,
        blackBaseSec: parseInt(oddsMatch[2], 10) * 60,
        increment: parseInt(oddsMatch[3], 10),
      };
    }
    // Standard format: "Rapid 10+0", "Blitz 3+2", "Custom 5+3"
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
    let blackTime = tc.blackBaseSec || tc.baseSec;
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
        this._blackTimerEl.textContent = this._formatClock(tc.blackBaseSec || tc.baseSec);
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

    // Update analysis detail panel if analysis exists
    if (this._analysisData) {
      this._updateDetailPanel();
      this._updateCriticalNav();
    }
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
    this._playBtn.textContent = '\u23F8';
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
      this._playBtn.textContent = '\u25B6';
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
      return reason ? `Draw \u2014 ${reason}` : 'Draw';
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

    // Auto-Analyze toggle (before close button)
    const toggleWrapper = document.createElement('label');
    toggleWrapper.className = 'auto-analyze-toggle';

    const toggleText = document.createElement('span');
    toggleText.textContent = 'Analyze';

    const switchEl = document.createElement('span');
    switchEl.className = 'auto-analyze-switch';

    this._autoAnalyzeCheckbox = document.createElement('input');
    this._autoAnalyzeCheckbox.type = 'checkbox';
    this._autoAnalyzeCheckbox.checked =
      localStorage.getItem('chess-auto-analyze') !== 'false'; // default on

    const slider = document.createElement('span');
    slider.className = 'auto-analyze-slider';

    this._autoAnalyzeCheckbox.addEventListener('change', () => {
      localStorage.setItem('chess-auto-analyze',
        this._autoAnalyzeCheckbox.checked ? 'true' : 'false');
      // If toggled on and a game is loaded but not yet analyzed, start analysis
      if (this._autoAnalyzeCheckbox.checked && this._game &&
          !this._analysisData && this._analyzeCallback) {
        this._analyzeCallback(this._game);
      }
    });

    switchEl.appendChild(this._autoAnalyzeCheckbox);
    switchEl.appendChild(slider);

    toggleWrapper.appendChild(toggleText);
    toggleWrapper.appendChild(switchEl);
    header.appendChild(toggleWrapper);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'replay-close-btn';
    closeBtn.textContent = '\u00D7';
    closeBtn.addEventListener('click', () => this.close());
    header.appendChild(closeBtn);

    container.appendChild(header);

    // Progress bar (below header)
    this._progressBarEl = document.createElement('div');
    this._progressBarEl.className = 'analysis-progress hidden';
    this._progressFillEl = document.createElement('div');
    this._progressFillEl.className = 'analysis-progress-fill';
    this._progressBarEl.appendChild(this._progressFillEl);
    container.appendChild(this._progressBarEl);

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

    this._critPrevBtn = document.createElement('button');
    this._critPrevBtn.className = 'replay-btn-crit hidden';
    this._critPrevBtn.textContent = '\u25C0 Crit';
    this._critPrevBtn.addEventListener('click', () => this._goToPrevCritical());
    controls.appendChild(this._critPrevBtn);

    const btnStart = this._createBtn('replay-start', '|\u25C0', () => this._goToStart());
    const btnPrev = this._createBtn('replay-prev', '\u25C0', () => this._prev());
    this._playBtn = this._createBtn('replay-play', '\u25B6', () => this._togglePlay());
    this._playBtn.classList.add('replay-btn-play');
    const btnNext = this._createBtn('replay-next', '\u25B6', () => this._next());
    const btnEnd = this._createBtn('replay-end', '\u25B6|', () => this._goToEnd());

    controls.appendChild(btnStart);
    controls.appendChild(btnPrev);
    controls.appendChild(this._playBtn);
    controls.appendChild(btnNext);
    controls.appendChild(btnEnd);

    this._critNextBtn = document.createElement('button');
    this._critNextBtn.className = 'replay-btn-crit hidden';
    this._critNextBtn.textContent = 'Crit \u25B6';
    this._critNextBtn.addEventListener('click', () => this._goToNextCritical());
    controls.appendChild(this._critNextBtn);

    boardArea.appendChild(controls);

    // Analysis detail panel (below controls, inside board area)
    this._detailPanel = document.createElement('div');
    this._detailPanel.className = 'analysis-detail hidden';

    this._detailClassEl = document.createElement('div');
    this._detailClassEl.className = 'analysis-detail-classification';
    this._detailPanel.appendChild(this._detailClassEl);

    this._detailEvalEl = document.createElement('div');
    this._detailEvalEl.className = 'analysis-detail-eval';
    this._detailPanel.appendChild(this._detailEvalEl);

    this._detailBestEl = document.createElement('div');
    this._detailBestEl.className = 'analysis-detail-best';
    this._detailPanel.appendChild(this._detailBestEl);

    this._detailLineEl = document.createElement('div');
    this._detailLineEl.className = 'analysis-detail-line';
    this._detailPanel.appendChild(this._detailLineEl);

    boardArea.appendChild(this._detailPanel);

    body.appendChild(boardArea);
    container.appendChild(body);

    // Accuracy summary panel (below body)
    this._accuracyPanel = document.createElement('div');
    this._accuracyPanel.className = 'analysis-accuracy hidden';
    container.appendChild(this._accuracyPanel);

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
    leftBtn.textContent = '\u25C0';
    strip.appendChild(leftBtn);

    const moves = document.createElement('div');
    moves.className = 'strip-moves';
    strip.appendChild(moves);

    const rightBtn = document.createElement('button');
    rightBtn.className = 'strip-scroll-btn strip-scroll-btn-right';
    rightBtn.textContent = '\u25B6';
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
