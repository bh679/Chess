import { Chess } from './chess.js';
import { Game } from './game.js';
import { Board } from './board.js';
import { Timer } from './timer.js?v=2';
import { AI } from './ai.js?v=3';
import { getAllEngines, getEngineInfo } from './engines/registry.js';
import { GameDatabase } from './database.js?v=6';
import { GameBrowser } from './browser.js?v=3';
import { ReplayViewer } from './replay.js';
import { AnalysisEngine } from './analysis.js';
import { EvalBar } from './eval-bar.js';
import { PostGameSummary } from './post-game-summary.js';

const PIECE_ORDER = { q: 0, r: 1, b: 2, n: 3, p: 4 };
const PIECE_VALUES = { q: 9, r: 5, b: 3, n: 3, p: 1 };
const PIECE_DISPLAY = { k: 'K', q: 'Q', r: 'R', b: 'B', n: 'N', p: 'P' };

// Analysis classification icons (shared with replay.js)
const CLASSIFICATION_ICONS = {
  brilliant:  { text: '!!',    cls: 'analysis-brilliant' },
  great:      { text: '!',     cls: 'analysis-great' },
  best:       { text: '\u2713', cls: 'analysis-best' },
  excellent:  { text: '\u25CF', cls: 'analysis-excellent' },
  good:       { text: '\u25CF', cls: 'analysis-good' },
  book:       { text: '\u2261', cls: 'analysis-book' },
  inaccuracy: { text: '?!',    cls: 'analysis-inaccuracy' },
  mistake:    { text: '?',     cls: 'analysis-mistake' },
  miss:       { text: '\u00D7', cls: 'analysis-miss' },
  blunder:    { text: '??',    cls: 'analysis-blunder' },
};
const ANALYSIS_CACHE_KEY = 'chess-analysis-cache';

// Art style configuration
const STYLE_PATHS = {
  classic: 'img/pieces',
  sovereign: 'img/pieces-sovereign',
  staunton: 'img/pieces-staunton',
  gothic: 'img/pieces-gothic',
  kawaii: 'img/pieces-kawaii',
  pixel: 'img/pieces-pixel',
  neo: 'img/pieces-neo',
  fish: 'img/pieces-fish',
};
window.chessPiecePath = STYLE_PATHS.classic;

const game = new Game();
const statusEl = document.getElementById('status');
const boardEl = document.getElementById('board');
const promotionModal = document.getElementById('promotion-modal');
const newGameBtn = document.getElementById('new-game');
const capturedByWhiteEl = document.getElementById('captured-by-white');
const capturedByBlackEl = document.getElementById('captured-by-black');
const timerWhiteEl = document.getElementById('timer-white');
const timerBlackEl = document.getElementById('timer-black');
const timeControlSelect = document.getElementById('time-control');
const customTimeModal = document.getElementById('custom-time-modal');
const customMinutesInput = document.getElementById('custom-minutes');
const customWhiteMinutes = document.getElementById('custom-white-minutes');
const customBlackMinutes = document.getElementById('custom-black-minutes');
const customIncrementInput = document.getElementById('custom-increment');
const customOddsToggle = document.getElementById('custom-odds-toggle');
const sameTimeFields = document.getElementById('same-time-fields');
const oddsTimeFields = document.getElementById('odds-time-fields');
const customTimeOk = document.getElementById('custom-time-ok');
const customTimeCancel = document.getElementById('custom-time-cancel');
const chess960Toggle = document.getElementById('chess960-toggle');
const animationsToggle = document.getElementById('animations-toggle');
const evalBarToggle = document.getElementById('eval-bar-toggle');
const premovesToggle = document.getElementById('premoves-toggle');
const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel = document.getElementById('settings-panel');
const settingsBackdrop = document.getElementById('settings-backdrop');
const artStylePicker = document.getElementById('art-style-picker');
const aiWhiteToggle = document.getElementById('ai-white-toggle');
const aiWhiteEngineSelect = document.getElementById('ai-white-engine');
const aiWhiteEloSlider = document.getElementById('ai-white-elo');
const aiWhiteEloValue = document.getElementById('ai-white-elo-value');
const aiWhiteEloWrapper = document.getElementById('ai-white-elo-wrapper');
const aiBlackToggle = document.getElementById('ai-black-toggle');
const aiBlackEngineSelect = document.getElementById('ai-black-engine');
const aiBlackEloSlider = document.getElementById('ai-black-elo');
const aiBlackEloValue = document.getElementById('ai-black-elo-value');
const aiBlackEloWrapper = document.getElementById('ai-black-elo-wrapper');
const archiveToggleBtn = document.getElementById('archive-toggle');
const archiveMenu = document.getElementById('archive-menu');
const playerIconWhite = document.getElementById('player-icon-white');
const playerIconBlack = document.getElementById('player-icon-black');
const playerNameWhite = document.getElementById('player-name-white');
const playerNameBlack = document.getElementById('player-name-black');
const playerEloWhite = document.getElementById('player-elo-white');
const playerEloBlack = document.getElementById('player-elo-black');
const gameHistoryBtn = document.getElementById('game-history-btn');
const startGameBtn = document.getElementById('start-game-btn');
const gameTypeLabel = document.getElementById('game-type-label');
const appEl = document.querySelector('.app');

// Confirmation modal DOM elements
const confirmModal = document.getElementById('confirm-modal');
const confirmModalTitle = document.getElementById('confirm-modal-title');
const confirmModalMessage = document.getElementById('confirm-modal-message');
const confirmModalOk = document.getElementById('confirm-modal-ok');
const confirmModalCancel = document.getElementById('confirm-modal-cancel');

// Replay-on-board DOM elements
const replayControlsEl = document.getElementById('replay-controls');
const replayMoveListEl = document.getElementById('replay-move-list');
const replayStartBtn = document.getElementById('replay-main-start');
const replayPrevBtn = document.getElementById('replay-main-prev');
const replayPlayBtn = document.getElementById('replay-main-play');
const replayNextBtn = document.getElementById('replay-main-next');
const replayEndBtn = document.getElementById('replay-main-end');
const replayResultEl = document.getElementById('replay-main-result');

// Analysis DOM elements for main-board replay
const replayAnalyzeCheckbox = document.getElementById('replay-auto-analyze');
const replayProgressEl = document.getElementById('replay-analysis-progress');
const replayProgressFillEl = document.getElementById('replay-analysis-progress-fill');
const replayAccuracyEl = document.getElementById('replay-analysis-accuracy');
const replayDetailEl = document.getElementById('replay-analysis-detail');
const replayClassEl = document.getElementById('replay-analysis-classification');
const replayEvalEl = document.getElementById('replay-analysis-eval');
const replayBestEl = document.getElementById('replay-analysis-best');
const replayLineEl = document.getElementById('replay-analysis-line');
const replayCritPrevBtn = document.getElementById('replay-crit-prev');
const replayCritNextBtn = document.getElementById('replay-crit-next');
const replaySummaryBtn = document.getElementById('replay-summary-btn');

const board = new Board(boardEl, game, promotionModal);
const timer = new Timer(timerWhiteEl, timerBlackEl);
const ai = new AI();
const db = new GameDatabase();
const replayViewer = new ReplayViewer();
const postGameSummary = new PostGameSummary();
const gameBrowser = new GameBrowser(db, replayViewer, enterReplayMode);

let moveCount = 0;
let gameId = 0;
let currentDbGameId = null;
let customWhiteName = null;
let customBlackName = null;

// Replay-on-board state
let isReplayMode = false;
let replayGame = null;
let replayPly = -1;
let replayPlaying = false;
let replayTimer = null;
let replayMoveDetails = [];
let replayClockSnapshots = [];

// Analysis state for main-board replay
let replayAnalysisData = null;
let replayAnalysisEngine = null;

// Eval bar for main board (used in both live play and replay)
const mainEvalBar = new EvalBar();
document.getElementById('main-eval-bar').appendChild(mainEvalBar.el);

// Dedicated analysis engine for live position evaluation (separate from replay/game AI)
let liveEvalEngine = null;

// Dedicated analysis engine for post-game summary
let postGameAnalysisEngine = null;

/**
 * Evaluate the current board position and update the eval bar.
 * Uses a dedicated low-depth Stockfish worker that doesn't conflict
 * with the game AI or the replay analysis engine.
 */
async function liveEval() {
  if (isReplayMode || game.isGameOver()) return;

  if (!liveEvalEngine) {
    liveEvalEngine = new AnalysisEngine();
  }

  try {
    const cp = await liveEvalEngine.quickEval(game.chess.fen());
    // cp is null if a full analysis is running on this engine
    if (cp != null && !isReplayMode) {
      mainEvalBar.update(cp);
    }
  } catch {
    // Worker init failed or was cancelled — ignore
  }
}

// Initialise analysis toggle from localStorage
if (replayAnalyzeCheckbox) {
  replayAnalyzeCheckbox.checked = localStorage.getItem('chess-auto-analyze') !== 'false';
}

// Initialise eval bar toggle from localStorage (default: off for live play)
if (evalBarToggle) {
  evalBarToggle.checked = localStorage.getItem('chess-eval-bar') === 'true';
}

function renderCaptured() {
  const captured = game.getCaptured();

  for (const [color, el] of [['w', capturedByWhiteEl], ['b', capturedByBlackEl]]) {
    const pieces = [...captured[color]].sort((a, b) => PIECE_ORDER[a] - PIECE_ORDER[b]);
    el.innerHTML = '';

    for (const p of pieces) {
      const img = document.createElement('img');
      img.className = 'captured-piece';
      // White captured these pieces, so they are black pieces (opponent's color)
      const victimColor = color === 'w' ? 'b' : 'w';
      img.src = `${window.chessPiecePath}/${victimColor}${PIECE_DISPLAY[p]}.svg`;
      img.alt = p;
      el.appendChild(img);
    }

    // Material advantage
    const myTotal = captured[color].reduce((s, p) => s + PIECE_VALUES[p], 0);
    const oppColor = color === 'w' ? 'b' : 'w';
    const oppTotal = captured[oppColor].reduce((s, p) => s + PIECE_VALUES[p], 0);
    const diff = myTotal - oppTotal;
    if (diff > 0) {
      const badge = document.createElement('span');
      badge.className = 'material-advantage';
      badge.textContent = `+${diff}`;
      el.appendChild(badge);
    }
  }
}

let showingGameInfo = false;

function updateStatus(msg, isGameInfo) {
  if (isGameInfo) {
    showingGameInfo = true;
    statusEl.textContent = msg;
    statusEl.className = 'status new-game-info';
    return;
  }
  // Keep showing game info until first move or AI thinking
  if (showingGameInfo && !msg) return;
  showingGameInfo = false;

  statusEl.textContent = msg || game.getGameStatus();
  statusEl.className = 'status';
  if (msg && msg.includes('thinking')) {
    statusEl.classList.add('ai-thinking');
  } else if (game.isGameOver() || msg) {
    statusEl.classList.add('game-over');
  } else if (game.getGameStatus().startsWith('Check')) {
    statusEl.classList.add('in-check');
  }
}

function getTimeConfig() {
  const val = timeControlSelect.value;
  if (val === '0' || val === 'custom') return null;
  const parts = val.split('|').map(Number);
  // Format: whiteSec|increment or whiteSec|increment|blackSec
  return {
    whiteSec: parts[0],
    increment: parts[1],
    blackSec: parts[2] !== undefined ? parts[2] : parts[0],
  };
}

// --- AI Move Trigger ---

function triggerAIMove() {
  if (!ai.isEnabled()) return;
  if (game.isGameOver()) return;
  const turn = game.getTurn();
  if (!ai.isAITurn(turn)) return;
  if (ai.isThinking()) return;

  const currentGameId = gameId;
  const elo = ai.getElo(turn);
  const sideLabel = turn === 'w' ? 'White' : 'Black';

  // Dynamic delay: shorter when clock is ticking to reduce overhead
  let aiDelay = 400;
  if (timer.isEnabled()) {
    const minTime = Math.min(timer.getTime('w'), timer.getTime('b'));
    if (minTime <= 60000) aiDelay = 50;
    else if (minTime <= 300000) aiDelay = 150;
  }

  setTimeout(async () => {
    // Check again after delay in case game state changed
    if (currentGameId !== gameId) return;
    if (game.isGameOver()) return;

    updateStatus(`${sideLabel} AI is thinking...`);

    try {
      const fen = game.chess.fen();
      const wtime = timer.isEnabled() ? timer.getTime('w') : 0;
      const btime = timer.isEnabled() ? timer.getTime('b') : 0;
      const inc = timer.isEnabled() ? timer.getIncrement() : 0;
      const move = await ai.requestMove(fen, elo, wtime, btime, inc);

      // Discard if game changed during thinking
      if (currentGameId !== gameId) return;
      if (!move || game.isGameOver()) return;

      board.executeAIMove(move.from, move.to, move.promotion);
    } catch (e) {
      // Move was cancelled (e.g., new game started)
      if (e !== 'stopped') {
        console.error('AI move error:', e);
      }
    }
  }, aiDelay);
}

// --- Game Database Helpers ---

function getGameResult() {
  if (game.chess.isCheckmate()) {
    const winner = game.getTurn() === 'w' ? 'black' : 'white';
    return { result: winner, reason: 'checkmate' };
  }
  if (game.chess.isStalemate()) {
    return { result: 'draw', reason: 'stalemate' };
  }
  if (game.chess.isInsufficientMaterial()) {
    return { result: 'draw', reason: 'insufficient' };
  }
  if (game.chess.isThreefoldRepetition()) {
    return { result: 'draw', reason: 'threefold' };
  }
  // 50-move rule or other draw
  return { result: 'draw', reason: 'draw' };
}

function getTimeControlLabel() {
  const val = timeControlSelect.value;
  if (val === '0') return 'none';
  const selectedOption = timeControlSelect.selectedOptions[0];
  return selectedOption ? selectedOption.textContent : 'none';
}

/**
 * Build a game record from the current live game state.
 * Converts local database format to the replay-compatible format.
 */
function buildCurrentGameRecord() {
  const g = db.getLocalGame(currentDbGameId);
  if (!g) return null;
  return {
    startingFen: g.metadata.startingFen,
    moves: g.moves,
    white: g.metadata.white,
    black: g.metadata.black,
    result: g.result,
    resultReason: g.resultReason,
    timeControl: g.metadata.timeControl,
    gameType: g.metadata.gameType,
    startTime: g.createdAt,
    serverId: g.serverId,
  };
}

/**
 * Trigger the post-game summary after a game ends.
 */
function triggerPostGameSummary() {
  const record = buildCurrentGameRecord();
  if (!record || !record.moves || record.moves.length === 0) return;

  if (!postGameAnalysisEngine) {
    postGameAnalysisEngine = new AnalysisEngine();
  }

  postGameSummary.setCallbacks({
    onReview: (rec) => enterReplayMode(rec),
    onNewGame: () => startNewGame(),
    onClose: () => {},
  });

  postGameSummary.showWithAnalysis(
    record,
    postGameAnalysisEngine,
    record.serverId || null,
    {
      onReview: (rec) => enterReplayMode(rec),
      onNewGame: () => startNewGame(),
      onClose: () => {},
    }
  );
}

// --- Game Flow ---

async function startNewGame() {
  // Close post-game summary if open
  if (postGameSummary.isOpen()) {
    postGameSummary.close();
  }
  // Stop post-game analysis engine if running
  if (postGameAnalysisEngine) {
    postGameAnalysisEngine.stop();
  }


  // Exit replay mode if active
  if (isReplayMode) {
    exitReplayMode(false);
  }

  // End the current game as abandoned if moves were made and game isn't over
  if (currentDbGameId && moveCount > 0 && !game.isGameOver()) {
    db.endGame(currentDbGameId, 'abandoned', 'abandoned');
  }

  gameId++;
  ai.stop();
  board.clearPremove();
  newGameBtn.classList.remove('game-ended');

  const chess960 = chess960Toggle.checked;
  game.newGame(chess960);
  board.getArrowOverlay().clear();
  board.render();
  moveCount = 0;

  const wIsAI = aiWhiteToggle.checked;
  const bIsAI = aiBlackToggle.checked;

  // Show loading status while engines initialise
  if (wIsAI || bIsAI) {
    updateStatus('Loading engine...', true);
  }

  // Configure AI (per-side) — async: loads engine WASM on first use
  await ai.configure({
    whiteEnabled: wIsAI,
    whiteElo: parseInt(aiWhiteEloSlider.value, 10),
    whiteEngineId: aiWhiteEngineSelect.value,
    blackEnabled: bIsAI,
    blackElo: parseInt(aiBlackEloSlider.value, 10),
    blackEngineId: aiBlackEngineSelect.value,
  });
  board.setAI(ai);
  ai.newGame();

  const config = getTimeConfig();
  if (config) {
    timer.configure(config.whiteSec, config.increment, config.blackSec);
    // Auto-disable animations for timed games to reduce per-move overhead
    board.setAnimationsEnabled(false);
    animationsToggle.checked = false;
  } else {
    timer.configure(0, 0);
    // Restore user's animation preference for untimed games
    board.setAnimationsEnabled(animationsToggle.checked);
  }

  // Update game type label
  gameTypeLabel.textContent = chess960 ? 'Chess960' : 'Standard';

  // Show matchup info in status briefly
  let matchup;
  if (wIsAI && bIsAI) {
    const wElo = aiWhiteEloSlider.value;
    const bElo = aiBlackEloSlider.value;
    const wEng = ai.getEngineName('w');
    const bEng = ai.getEngineName('b');
    matchup = `${wEng} (${wElo}) vs ${bEng} (${bElo})`;
  } else if (wIsAI) {
    matchup = `${ai.getEngineName('w')} (${aiWhiteEloSlider.value}) vs Human`;
  } else if (bIsAI) {
    matchup = `Human vs ${ai.getEngineName('b')} (${aiBlackEloSlider.value})`;
  } else {
    matchup = 'Human vs Human';
  }
  updateStatus(matchup, true);

  // Update player type icons and info — use engine-specific icons
  const wInfo = getEngineInfo(aiWhiteEngineSelect.value);
  const bInfo = getEngineInfo(aiBlackEngineSelect.value);
  playerIconWhite.textContent = wIsAI ? (wInfo?.icon || '\uD83E\uDD16') : '\uD83D\uDC64';
  playerIconBlack.textContent = bIsAI ? (bInfo?.icon || '\uD83E\uDD16') : '\uD83D\uDC64';
  const wEloVal = parseInt(aiWhiteEloSlider.value, 10);
  const bEloVal = parseInt(aiBlackEloSlider.value, 10);
  const wName = wIsAI ? ai.getEngineName('w') : (customWhiteName || 'Human');
  const bName = bIsAI ? ai.getEngineName('b') : (customBlackName || 'Human');
  playerNameWhite.textContent = wName;
  playerNameBlack.textContent = bName;
  playerEloWhite.textContent = wIsAI ? wEloVal : '';
  playerEloBlack.textContent = bIsAI ? bEloVal : '';
  playerEloWhite.classList.toggle('hidden', !wIsAI);
  playerEloBlack.classList.toggle('hidden', !bIsAI);

  // Enable pre-game interactive controls
  appEl.classList.add('pre-game');
  closeAllPopups();

  renderCaptured();

  // Save game to local-first database (always succeeds, syncs to server in background)
  currentDbGameId = db.createGame({
    gameType: chess960 ? 'chess960' : 'standard',
    timeControl: getTimeControlLabel(),
    startingFen: game.chess.fen(),
    white: {
      name: wIsAI ? `${ai.getEngineName('w')} ${wEloVal}` : wName,
      isAI: wIsAI,
      elo: wIsAI ? wEloVal : null,
      engineId: wIsAI ? aiWhiteEngineSelect.value : null,
    },
    black: {
      name: bIsAI ? `${ai.getEngineName('b')} ${bEloVal}` : bName,
      isAI: bIsAI,
      elo: bIsAI ? bEloVal : null,
      engineId: bIsAI ? aiBlackEngineSelect.value : null,
    },
  });

  // Show eval bar if the toggle is enabled, and run initial evaluation
  if (evalBarToggle && evalBarToggle.checked) {
    mainEvalBar.show();
    mainEvalBar.reset();
    liveEval();
  } else {
    mainEvalBar.hide();
    mainEvalBar.reset();
  }

  // If AI plays White, show start button instead of auto-starting
  if (ai.isEnabled() && ai.isAITurn('w')) {
    startGameBtn.classList.remove('hidden');
  } else {
    startGameBtn.classList.add('hidden');
  }
}

board.onMove((result) => {
  if (isReplayMode) return;
  moveCount++;
  showingGameInfo = false;

  // Disable pre-game interactive controls after first move
  if (moveCount === 1) {
    appEl.classList.remove('pre-game');
    closeAllPopups();
    startGameBtn.classList.add('hidden');
  }

  renderCaptured();

  // Save move to local-first database
  const side = game.getTurn() === 'w' ? 'b' : 'w'; // side that just moved
  db.addMove(currentDbGameId, {
    ply: moveCount - 1,
    san: result.san,
    fen: game.chess.fen(),
    timestamp: Date.now(),
    side: side,
  });

  if (timer.isEnabled()) {
    const currentTurn = game.getTurn();
    if (moveCount === 1) {
      // First move: start black's timer (white just moved)
      timer.start(currentTurn);
    } else {
      timer.switchTo(currentTurn);
    }
  }

  // Update live eval bar after every move (if toggle is on)
  if (evalBarToggle && evalBarToggle.checked) {
    liveEval();
  }

  if (game.isGameOver()) {
    timer.stop();
    board.clearPremove();
    newGameBtn.classList.add('game-ended');
    updateStatus();

    // Save game result to local-first database
    const { result: dbResult, reason } = getGameResult();
    db.endGame(currentDbGameId, dbResult, reason);

    // Auto-trigger post-game summary
    triggerPostGameSummary();
    return;
  }

  updateStatus();

  // Check for queued premove before triggering AI
  const turn = game.getTurn();
  if (board.getPremove() && (!ai.isEnabled() || !ai.isAITurn(turn))) {
    setTimeout(() => {
      if (!board.executePremove()) {
        triggerAIMove();
      }
    }, 50);
    return;
  }

  // Trigger AI move if it's the computer's turn
  triggerAIMove();
});

timer.onTimeout((loser) => {
  ai.stop();
  game.setTimedOut();
  newGameBtn.classList.add('game-ended');
  const winner = loser === 'White' ? 'Black' : 'White';
  updateStatus(`Time out! ${winner} wins`);

  // Save timeout result to local-first database
  const dbResult = loser === 'White' ? 'black' : 'white';
  db.endGame(currentDbGameId, dbResult, 'timeout');

  // Auto-trigger post-game summary
  triggerPostGameSummary();
});

newGameBtn.addEventListener('click', startNewGame);

// Start button — deferred AI start
startGameBtn.addEventListener('click', () => {
  startGameBtn.classList.add('hidden');
  appEl.classList.remove('pre-game');
  closeAllPopups();
  triggerAIMove();
});

// --- Editable Player Names ---

function startNameEdit(nameEl, side) {
  if (isReplayMode) return;
  // Prevent double-editing
  if (nameEl.querySelector('.player-name-input')) return;

  const currentName = nameEl.textContent;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'player-name-input';
  input.value = currentName;
  input.maxLength = 20;

  nameEl.textContent = '';
  nameEl.appendChild(input);
  input.focus();
  input.select();

  function commitName() {
    const newName = input.value.trim() || (side === 'white' ? 'Human' : 'Human');
    nameEl.textContent = newName;

    // Only save custom name for human players
    const isAI = side === 'white' ? aiWhiteToggle.checked : aiBlackToggle.checked;
    if (!isAI) {
      if (side === 'white') {
        customWhiteName = newName === 'Human' ? null : newName;
      } else {
        customBlackName = newName === 'Human' ? null : newName;
      }
    }

    // Update local-first database
    db.updatePlayerName(currentDbGameId, side, newName);
  }

  function cancelEdit() {
    nameEl.textContent = currentName;
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitName();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  });

  input.addEventListener('blur', () => {
    // Only commit if input is still in DOM (wasn't cancelled by Escape)
    if (nameEl.contains(input)) {
      commitName();
    }
  });
}

function startEngineSwitch(nameEl, side) {
  if (isReplayMode) return;
  if (nameEl.querySelector('.engine-switch-select')) return;

  const isWhite = side === 'white';
  const settingsSelect = isWhite ? aiWhiteEngineSelect : aiBlackEngineSelect;
  const currentEngineId = settingsSelect.value;
  const currentName = nameEl.textContent;

  const select = document.createElement('select');
  select.className = 'engine-switch-select';
  const engines = getAllEngines();
  for (const eng of engines) {
    const opt = document.createElement('option');
    opt.value = eng.id;
    opt.textContent = `${eng.icon} ${eng.name}`;
    if (eng.id === currentEngineId) opt.selected = true;
    select.appendChild(opt);
  }

  nameEl.textContent = '';
  nameEl.appendChild(select);
  select.focus();

  let committed = false;

  function commit() {
    if (committed) return;
    committed = true;
    const newId = select.value;
    // Remove select safely
    if (select.parentNode) {
      select.parentNode.removeChild(select);
    }
    if (newId !== currentEngineId) {
      settingsSelect.value = newId;
      settingsSelect.dispatchEvent(new Event('change'));
      startNewGame();
    } else {
      nameEl.textContent = currentName;
    }
  }

  select.addEventListener('change', commit);
  select.addEventListener('blur', () => {
    if (!committed && select.parentNode) {
      select.parentNode.removeChild(select);
      nameEl.textContent = currentName;
    }
  });
}

playerNameWhite.addEventListener('click', (e) => {
  e.stopPropagation();
  if (aiWhiteToggle.checked) {
    startEngineSwitch(playerNameWhite, 'white');
  } else {
    startNameEdit(playerNameWhite, 'white');
  }
});

playerNameBlack.addEventListener('click', (e) => {
  e.stopPropagation();
  if (aiBlackToggle.checked) {
    startEngineSwitch(playerNameBlack, 'black');
  } else {
    startNameEdit(playerNameBlack, 'black');
  }
});

// Game history button
gameHistoryBtn.addEventListener('click', () => {
  gameBrowser.open();
});

// Time control select
timeControlSelect.addEventListener('change', () => {
  if (timeControlSelect.value === 'custom') {
    customTimeModal.classList.remove('hidden');
  } else {
    startNewGame();
  }
});

// Toggle between same-time and per-player fields
customOddsToggle.addEventListener('change', () => {
  const odds = customOddsToggle.checked;
  sameTimeFields.classList.toggle('hidden', odds);
  oddsTimeFields.classList.toggle('hidden', !odds);
});

customTimeOk.addEventListener('click', () => {
  const odds = customOddsToggle.checked;
  const increment = parseInt(customIncrementInput.value, 10) || 0;
  let wMin, bMin;

  if (odds) {
    wMin = parseInt(customWhiteMinutes.value, 10) || 10;
    bMin = parseInt(customBlackMinutes.value, 10) || 5;
  } else {
    wMin = parseInt(customMinutesInput.value, 10) || 10;
    bMin = wMin;
  }

  // Add custom option and select it
  const existingCustom = timeControlSelect.querySelector('[data-custom]');
  if (existingCustom) existingCustom.remove();
  const opt = document.createElement('option');
  const label = wMin === bMin
    ? `Custom ${wMin}+${increment}`
    : `Custom W${wMin} / B${bMin} +${increment}`;
  opt.value = `${wMin * 60}|${increment}|${bMin * 60}`;
  opt.textContent = label;
  opt.dataset.custom = 'true';
  opt.selected = true;
  timeControlSelect.insertBefore(opt, timeControlSelect.querySelector('[value="custom"]'));
  customTimeModal.classList.add('hidden');
  startNewGame();
});

customTimeCancel.addEventListener('click', () => {
  customTimeModal.classList.add('hidden');
  timeControlSelect.value = '600|0'; // fallback to Rapid 10+0
});

// Animations toggle
animationsToggle.addEventListener('change', () => {
  board.setAnimationsEnabled(animationsToggle.checked);
});

// Eval bar toggle — persists preference and shows/hides bar during live play
if (evalBarToggle) {
  evalBarToggle.addEventListener('change', () => {
    const enabled = evalBarToggle.checked;
    localStorage.setItem('chess-eval-bar', enabled ? 'true' : 'false');

    if (isReplayMode) {
      // In replay mode, show/hide based on toggle + analysis data
      if (enabled && replayAnalysisData) {
        mainEvalBar.show();
        updateMainEvalBar();
      } else {
        mainEvalBar.hide();
      }
      return;
    }

    if (enabled) {
      mainEvalBar.show();
      mainEvalBar.reset();
      liveEval();
    } else {
      mainEvalBar.hide();
      mainEvalBar.reset();
      if (liveEvalEngine) liveEvalEngine.stop();
    }
  });
}

// Premoves toggle
premovesToggle.checked = localStorage.getItem('chess-premoves') === 'true';
board.setPremovesEnabled(premovesToggle.checked);
premovesToggle.addEventListener('change', () => {
  localStorage.setItem('chess-premoves', premovesToggle.checked ? 'true' : 'false');
  board.setPremovesEnabled(premovesToggle.checked);
  if (!premovesToggle.checked) board.clearPremove();
});

// Settings panel toggle (bottom sheet)
function openSettings() {
  settingsPanel.classList.add('open');
  settingsBackdrop.classList.add('visible');
  settingsToggle.classList.add('active');
  settingsToggle.setAttribute('aria-expanded', 'true');
}

function closeSettings() {
  settingsPanel.classList.remove('open');
  settingsBackdrop.classList.remove('visible');
  settingsToggle.classList.remove('active');
  settingsToggle.setAttribute('aria-expanded', 'false');
}

settingsToggle.addEventListener('click', () => {
  if (settingsPanel.classList.contains('open')) {
    closeSettings();
  } else {
    openSettings();
  }
});

settingsBackdrop.addEventListener('click', closeSettings);

// Art style picker
artStylePicker.addEventListener('click', (e) => {
  const btn = e.target.closest('.art-style-option');
  if (!btn) return;

  const style = btn.dataset.style;
  if (!STYLE_PATHS[style]) return;

  window.chessPiecePath = STYLE_PATHS[style];

  artStylePicker.querySelectorAll('.art-style-option').forEach(el => {
    el.classList.toggle('selected', el === btn);
  });

  board.render();
  renderCaptured();
});

// AI per-side toggles - show/hide engine select + ELO sliders
aiWhiteToggle.addEventListener('change', () => {
  const on = aiWhiteToggle.checked;
  aiWhiteEngineSelect.classList.toggle('hidden', !on);
  updateEloSliderRange('w');
});

aiBlackToggle.addEventListener('change', () => {
  const on = aiBlackToggle.checked;
  aiBlackEngineSelect.classList.toggle('hidden', !on);
  updateEloSliderRange('b');
});

// Engine selector change — update ELO slider range and player bar
aiWhiteEngineSelect.addEventListener('change', () => {
  updateEloSliderRange('w');
  saveEngineSelection();
  if (aiWhiteToggle.checked) {
    const info = getEngineInfo(aiWhiteEngineSelect.value);
    if (info) {
      playerNameWhite.textContent = info.name;
      playerIconWhite.textContent = info.icon || '\uD83E\uDD16';
      playerEloWhite.textContent = aiWhiteEloSlider.value;
    }
  }
});

aiBlackEngineSelect.addEventListener('change', () => {
  updateEloSliderRange('b');
  saveEngineSelection();
  if (aiBlackToggle.checked) {
    const info = getEngineInfo(aiBlackEngineSelect.value);
    if (info) {
      playerNameBlack.textContent = info.name;
      playerIconBlack.textContent = info.icon || '\uD83E\uDD16';
      playerEloBlack.textContent = aiBlackEloSlider.value;
    }
  }
});

/**
 * Update ELO slider min/max/step based on selected engine.
 * Hides slider entirely for engines with no ELO range (e.g. Random).
 */
function updateEloSliderRange(side) {
  const isWhite = side === 'w';
  const toggle = isWhite ? aiWhiteToggle : aiBlackToggle;
  const select = isWhite ? aiWhiteEngineSelect : aiBlackEngineSelect;
  const slider = isWhite ? aiWhiteEloSlider : aiBlackEloSlider;
  const valueEl = isWhite ? aiWhiteEloValue : aiBlackEloValue;
  const wrapper = isWhite ? aiWhiteEloWrapper : aiBlackEloWrapper;

  if (!toggle.checked) {
    wrapper.classList.add('hidden');
    return;
  }

  const info = getEngineInfo(select.value);
  if (!info) return;

  const { min, max, step, default: defaultElo } = info.eloRange;

  if (min === max) {
    slider.min = min;
    slider.max = max;
    slider.value = defaultElo;
    valueEl.textContent = defaultElo;
    wrapper.classList.add('hidden');
    return;
  }

  slider.min = min;
  slider.max = max;
  slider.step = step;
  const current = parseInt(slider.value, 10);
  if (current < min || current > max) {
    slider.value = defaultElo;
  }
  valueEl.textContent = slider.value;
  wrapper.classList.remove('hidden');
}

// ELO slider live value display
aiWhiteEloSlider.addEventListener('input', () => {
  aiWhiteEloValue.textContent = aiWhiteEloSlider.value;
});

aiBlackEloSlider.addEventListener('input', () => {
  aiBlackEloValue.textContent = aiBlackEloSlider.value;
});

// Archive menu — dynamically discover archive location
let archiveLoaded = false;

async function loadArchiveMenu() {
  if (archiveLoaded) return;
  archiveLoaded = true;

  archiveMenu.innerHTML = '';
  let archiveBase = 'archive/';
  let currentHref = null;

  // Check if local archive/ exists (main app has archive/ as a subdirectory)
  try {
    const res = await fetch('archive/', { method: 'HEAD' });
    if (!res.ok) throw new Error();
  } catch {
    // Try parent's archive/ (sibling relationship)
    let found = false;
    try {
      const res = await fetch('../archive/', { method: 'HEAD' });
      if (res.ok) {
        archiveBase = '../archive/';
        currentHref = '../';
        found = true;
      }
    } catch { /* continue */ }
    // If not found, check if we're inside the archive directory itself
    if (!found) {
      try {
        const res = await fetch('../');
        if (res.ok) {
          const html = await res.text();
          // If parent listing contains subdirectories, treat it as the archive
          if (html.includes('href="') && !html.includes('<title>404')) {
            archiveBase = '../';
            currentHref = '../../';
          }
        }
      } catch { /* no archive found */ }
    }
  }

  // Add "Current" link when not at the top-level app
  if (currentHref) {
    const currentLink = document.createElement('a');
    currentLink.href = currentHref;
    currentLink.textContent = 'Current';
    archiveMenu.appendChild(currentLink);
  }

  // Scan for subdirectories by fetching the archive index
  try {
    const res = await fetch(archiveBase);
    if (res.ok) {
      const html = await res.text();
      // Parse directory listing links (Apache auto-index format)
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const links = doc.querySelectorAll('a[href]');
      const entries = [];
      for (const link of links) {
        const href = link.getAttribute('href');
        // Skip parent, self, and query/sort links
        if (!href || href === '../' || href === './' || href.startsWith('?') || href.startsWith('/')) continue;
        entries.push(href);
      }
      // Reverse so most recent (date-prefixed) entries appear first
      entries.reverse();
      for (const href of entries) {
        const name = decodeURIComponent(href.replace(/\/$/, ''));
        const a = document.createElement('a');
        a.href = `${archiveBase}${href}index.html`;
        if (!currentHref) a.target = '_blank';
        a.textContent = name;
        archiveMenu.appendChild(a);
      }
    }
  } catch { /* silently fail */ }

  if (archiveMenu.children.length === 0) {
    const empty = document.createElement('span');
    empty.textContent = 'No archives';
    empty.style.color = '#888';
    empty.style.padding = '4px 8px';
    archiveMenu.appendChild(empty);
  }
}

archiveToggleBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  archiveMenu.classList.toggle('hidden');
  if (!archiveMenu.classList.contains('hidden')) {
    loadArchiveMenu();
  }
});

// Close archive menu on outside click
document.addEventListener('click', (e) => {
  if (!archiveMenu.classList.contains('hidden') &&
      !archiveMenu.contains(e.target) &&
      e.target !== archiveToggleBtn) {
    archiveMenu.classList.add('hidden');
  }
});

// --- Pre-game Inline Controls ---

function closeAllPopups() {
  document.querySelectorAll('.timer-dropdown, .elo-popup').forEach(el => el.remove());
}

// Click player icon to toggle Human ↔ AI (only before first move)
playerIconWhite.addEventListener('click', () => {
  if (isReplayMode || moveCount > 0) return;
  aiWhiteToggle.checked = !aiWhiteToggle.checked;
  aiWhiteToggle.dispatchEvent(new Event('change'));
  startNewGame();
});

playerIconBlack.addEventListener('click', () => {
  if (isReplayMode || moveCount > 0) return;
  aiBlackToggle.checked = !aiBlackToggle.checked;
  aiBlackToggle.dispatchEvent(new Event('change'));
  startNewGame();
});

// Click game type label to toggle Chess960 ↔ Standard (only before first move)
gameTypeLabel.addEventListener('click', () => {
  if (isReplayMode || moveCount > 0) return;
  chess960Toggle.checked = !chess960Toggle.checked;
  startNewGame();
});

// Click timer for time control dropdown (only before first move)
function showTimerDropdown(timerEl) {
  if (isReplayMode || moveCount > 0) return;
  closeAllPopups();

  const dropdown = document.createElement('div');
  dropdown.className = 'timer-dropdown';

  // Gather options from the time control select
  const options = timeControlSelect.querySelectorAll('option');
  options.forEach(opt => {
    const item = document.createElement('div');
    item.className = 'timer-dropdown-option';
    if (opt.value === timeControlSelect.value) {
      item.classList.add('selected');
    }
    item.textContent = opt.textContent;
    item.dataset.value = opt.value;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      if (opt.value === 'custom') {
        closeAllPopups();
        customTimeModal.classList.remove('hidden');
        return;
      }
      timeControlSelect.value = opt.value;
      closeAllPopups();
      startNewGame();
    });
    dropdown.appendChild(item);
  });

  // Position near the timer
  const rect = timerEl.getBoundingClientRect();
  dropdown.style.position = 'fixed';
  dropdown.style.left = `${rect.left}px`;
  dropdown.style.top = `${rect.bottom + 4}px`;

  // Prevent dropdown from going off-screen right
  document.body.appendChild(dropdown);
  const dropRect = dropdown.getBoundingClientRect();
  if (dropRect.right > window.innerWidth) {
    dropdown.style.left = `${window.innerWidth - dropRect.width - 8}px`;
  }
  // Prevent going off-screen bottom — show above instead
  if (dropRect.bottom > window.innerHeight) {
    dropdown.style.top = `${rect.top - dropRect.height - 4}px`;
  }
}

timerWhiteEl.addEventListener('click', (e) => {
  e.stopPropagation();
  showTimerDropdown(timerWhiteEl);
});

timerBlackEl.addEventListener('click', (e) => {
  e.stopPropagation();
  showTimerDropdown(timerBlackEl);
});

// Click ELO label for inline slider popup (only before first move, only for AI)
function showEloPopup(eloEl, side) {
  if (isReplayMode || moveCount > 0) return;
  closeAllPopups();

  const isWhite = side === 'w';
  const slider = isWhite ? aiWhiteEloSlider : aiBlackEloSlider;
  const settingsValue = isWhite ? aiWhiteEloValue : aiBlackEloValue;

  // Don't show popup for engines with no ELO range (e.g. Random)
  if (slider.min === slider.max) return;

  const popup = document.createElement('div');
  popup.className = 'elo-popup';

  const rangeInput = document.createElement('input');
  rangeInput.type = 'range';
  rangeInput.min = slider.min;
  rangeInput.max = slider.max;
  rangeInput.step = slider.step;
  rangeInput.value = slider.value;
  rangeInput.className = 'elo-slider';

  const valueDisplay = document.createElement('span');
  valueDisplay.className = 'elo-value';
  valueDisplay.textContent = slider.value;

  rangeInput.addEventListener('input', () => {
    valueDisplay.textContent = rangeInput.value;
    // Sync with settings panel slider
    slider.value = rangeInput.value;
    settingsValue.textContent = rangeInput.value;
    // Update the player bar elo display
    eloEl.textContent = rangeInput.value;
  });

  popup.appendChild(rangeInput);
  popup.appendChild(valueDisplay);

  // Position near the elo label
  const rect = eloEl.getBoundingClientRect();
  popup.style.position = 'fixed';
  popup.style.left = `${rect.left}px`;
  popup.style.top = `${rect.bottom + 4}px`;

  document.body.appendChild(popup);

  // Adjust if off-screen
  const popRect = popup.getBoundingClientRect();
  if (popRect.right > window.innerWidth) {
    popup.style.left = `${window.innerWidth - popRect.width - 8}px`;
  }
  if (popRect.bottom > window.innerHeight) {
    popup.style.top = `${rect.top - popRect.height - 4}px`;
  }

  // Stop click propagation so it doesn't immediately close
  popup.addEventListener('click', (e) => e.stopPropagation());
}

playerEloWhite.addEventListener('click', (e) => {
  e.stopPropagation();
  showEloPopup(playerEloWhite, 'w');
});

playerEloBlack.addEventListener('click', (e) => {
  e.stopPropagation();
  showEloPopup(playerEloBlack, 'b');
});

// Close popups on outside click
document.addEventListener('click', () => {
  const hadPopup = document.querySelector('.elo-popup');
  closeAllPopups();
  // If an elo popup was open and just closed, restart game to apply ELO change
  if (hadPopup && moveCount === 0) {
    startNewGame();
  }
});

// Close popups on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    board.clearPremove();
    const hadPopup = document.querySelector('.elo-popup');
    closeAllPopups();
    if (hadPopup && moveCount === 0) {
      startNewGame();
    }
  }
});

// --- Confirmation Modal ---

function showConfirmation(message, title) {
  return new Promise((resolve) => {
    confirmModalTitle.textContent = title || 'Confirm';
    confirmModalMessage.textContent = message;
    confirmModal.classList.remove('hidden');

    function cleanup() {
      confirmModal.classList.add('hidden');
      confirmModalOk.removeEventListener('click', onOk);
      confirmModalCancel.removeEventListener('click', onCancel);
      confirmModal.removeEventListener('click', onBackdrop);
    }

    function onOk() {
      cleanup();
      resolve(true);
    }

    function onCancel() {
      cleanup();
      resolve(false);
    }

    function onBackdrop(e) {
      if (e.target === confirmModal) {
        cleanup();
        resolve(false);
      }
    }

    confirmModalOk.addEventListener('click', onOk);
    confirmModalCancel.addEventListener('click', onCancel);
    confirmModal.addEventListener('click', onBackdrop);
  });
}

// --- Replay on Main Board ---

async function enterReplayMode(gameRecord) {
  // Confirm if there's an active live game (not if already in replay mode)
  if (!isReplayMode && moveCount > 0 && !game.isGameOver()) {
    const confirmed = await showConfirmation(
      'You have a game in progress. Abandon it to review this game?',
      'Abandon Game?'
    );
    if (!confirmed) {
      return;
    }
    // End the current game as abandoned
    if (currentDbGameId) {
      db.endGame(currentDbGameId, 'abandoned', 'abandoned');
    }
    moveCount = 0;
  }

  if (isReplayMode) exitReplayMode(false);

  ai.stop();
  timer.stop();

  // Stop live eval — replay mode uses its own analysis engine
  if (liveEvalEngine) {
    liveEvalEngine.stop();
  }

  isReplayMode = true;
  replayGame = gameRecord;
  replayPly = -1;
  replayPlaying = false;

  // Precompute move details (from/to for highlighting)
  replayMoveDetails = [];
  const scratch = new Chess(gameRecord.startingFen);
  for (const move of gameRecord.moves) {
    const result = scratch.move(move.san);
    if (result) {
      replayMoveDetails.push({
        fen: move.fen,
        from: result.from,
        to: result.to,
        san: move.san,
        side: move.side,
      });
    }
  }

  // Reconstruct clocks
  replayClockSnapshots = reconstructClocks(gameRecord);

  // Disable board input and show replay border
  board.setInteractive(false);
  boardEl.classList.add('replay-mode-border');

  // Update player bars
  updatePlayerBarsForReplay(gameRecord);

  // Update status
  statusEl.textContent = 'Replay Mode';
  statusEl.className = 'status replay-mode';

  // Hide normal game controls that don't apply
  startGameBtn.classList.add('hidden');
  appEl.classList.remove('pre-game');
  closeAllPopups();

  // Build move list
  buildReplayMoveList(gameRecord);

  // Show replay controls
  replayControlsEl.classList.remove('hidden');

  // Show result
  if (gameRecord.result) {
    replayResultEl.textContent = formatReplayResult(gameRecord);
    replayResultEl.style.display = '';
  } else {
    replayResultEl.style.display = 'none';
  }

  // Render starting position
  replayGoToMove(-1);

  // Highlight New Game button to indicate how to exit
  newGameBtn.classList.add('game-ended');

  // Set up keyboard handler
  document.addEventListener('keydown', replayKeyHandler);

  // Auto-analyze if toggle is enabled
  resetMainBoardAnalysis();
  if (replayAnalyzeCheckbox && replayAnalyzeCheckbox.checked) {
    runMainBoardAnalysis(gameRecord);
  }
}

function exitReplayMode(startNew = true) {
  if (!isReplayMode) return;

  stopReplayPlayback();

  // Stop analysis if running
  if (replayAnalysisEngine) {
    replayAnalysisEngine.stop();
  }
  resetMainBoardAnalysis();

  isReplayMode = false;
  replayGame = null;
  replayPly = -1;
  replayMoveDetails = [];
  replayClockSnapshots = [];

  // Clear all arrows
  board.getArrowOverlay().clear();

  // Re-enable board input and remove replay border
  board.setInteractive(true);
  boardEl.classList.remove('replay-mode-border');

  // Hide replay controls
  replayControlsEl.classList.add('hidden');

  // Remove keyboard handler
  document.removeEventListener('keydown', replayKeyHandler);

  if (startNew) startNewGame();
}

// --- Replay Navigation ---

function replayGoToMove(plyIndex) {
  if (!replayGame) return;
  const maxPly = replayGame.moves.length - 1;
  replayPly = Math.max(-1, Math.min(plyIndex, maxPly));

  if (replayPly === -1) {
    game.chess.load(replayGame.startingFen);
    game._lastMove = null;
  } else {
    const detail = replayMoveDetails[replayPly];
    game.chess.load(detail.fen);
    game._lastMove = { from: detail.from, to: detail.to };
  }

  board.render();
  highlightReplayMove();
  updateReplayButtons();
  updateReplayTimers();

  if (replayPly === -1) {
    statusEl.textContent = 'Replay Mode \u2014 Starting Position';
  } else {
    const moveNum = Math.floor(replayPly / 2) + 1;
    const side = replayMoveDetails[replayPly].side === 'w' ? '' : '...';
    statusEl.textContent = `Replay Mode \u2014 ${moveNum}${side} ${replayMoveDetails[replayPly].san}`;
  }
  statusEl.className = 'status replay-mode';

  // Update analysis detail panel and engine arrows for current ply
  if (replayAnalysisData) {
    updateAnalysisDetail();
    updateCriticalNav();
    updateMainEvalBar();
    updateEngineArrows();
  } else {
    board.getArrowOverlay().clearEngineArrows();
  }
}

function replayNext() {
  if (!replayGame) return;
  if (replayPly >= replayGame.moves.length - 1) {
    stopReplayPlayback();
    return;
  }
  replayGoToMove(replayPly + 1);
}

function replayPrev() {
  replayGoToMove(replayPly - 1);
}

function replayGoToStart() {
  stopReplayPlayback();
  replayGoToMove(-1);
}

function replayGoToEnd() {
  stopReplayPlayback();
  if (replayGame) {
    replayGoToMove(replayGame.moves.length - 1);
  }
}

// --- Replay Playback ---

function toggleReplayPlayback() {
  if (replayPlaying) {
    stopReplayPlayback();
  } else {
    startReplayPlayback();
  }
}

function startReplayPlayback() {
  if (!replayGame) return;
  if (replayPly >= replayGame.moves.length - 1) {
    replayGoToMove(-1);
  }
  replayPlaying = true;
  replayPlayBtn.textContent = '\u23F8';
  replayPlayBtn.classList.add('playing');
  scheduleReplayNext();
}

function stopReplayPlayback() {
  replayPlaying = false;
  if (replayTimer) {
    clearTimeout(replayTimer);
    replayTimer = null;
  }
  if (replayPlayBtn) {
    replayPlayBtn.textContent = '\u25B6';
    replayPlayBtn.classList.remove('playing');
  }
}

function scheduleReplayNext() {
  if (!replayPlaying || !replayGame) return;
  if (replayPly >= replayGame.moves.length - 1) {
    stopReplayPlayback();
    return;
  }

  const nextPly = replayPly + 1;
  const nextMove = replayGame.moves[nextPly];
  let delay;

  if (replayPly === -1) {
    delay = nextMove.timestamp - replayGame.startTime;
  } else {
    delay = nextMove.timestamp - replayGame.moves[replayPly].timestamp;
  }

  delay = Math.max(200, Math.min(delay, 5000));

  replayTimer = setTimeout(() => {
    replayNext();
    if (replayPlaying) scheduleReplayNext();
  }, delay);
}

// --- Replay Clock Reconstruction ---

function parseReplayTimeControl(tc) {
  if (!tc || tc === 'none' || tc === 'No Timer') return null;
  const oddsMatch = tc.match(/W(\d+)\s*\/\s*B(\d+)\s*\+(\d+)/);
  if (oddsMatch) {
    return {
      baseSec: parseInt(oddsMatch[1], 10) * 60,
      blackBaseSec: parseInt(oddsMatch[2], 10) * 60,
      increment: parseInt(oddsMatch[3], 10),
    };
  }
  const match = tc.match(/(\d+)\+(\d+)/);
  if (!match) return null;
  return { baseSec: parseInt(match[1], 10) * 60, increment: parseInt(match[2], 10) };
}

function reconstructClocks(gameRecord) {
  const snapshots = [];
  const tc = parseReplayTimeControl(gameRecord.timeControl);
  if (!tc) {
    for (let i = 0; i < gameRecord.moves.length; i++) snapshots.push(null);
    return snapshots;
  }

  let whiteTime = tc.baseSec;
  let blackTime = tc.blackBaseSec || tc.baseSec;
  let prevTimestamp = gameRecord.startTime;

  for (const move of gameRecord.moves) {
    const spent = (move.timestamp - prevTimestamp) / 1000;
    if (move.side === 'w') {
      whiteTime = Math.max(0, whiteTime - spent) + tc.increment;
    } else {
      blackTime = Math.max(0, blackTime - spent) + tc.increment;
    }
    snapshots.push({ w: whiteTime, b: blackTime });
    prevTimestamp = move.timestamp;
  }
  return snapshots;
}

function formatClockTime(seconds) {
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

function updateReplayTimers() {
  if (!replayGame) return;

  if (replayPly === -1) {
    const tc = parseReplayTimeControl(replayGame.timeControl);
    if (tc) {
      timerWhiteEl.textContent = formatClockTime(tc.baseSec);
      timerBlackEl.textContent = formatClockTime(tc.blackBaseSec || tc.baseSec);
    } else {
      timerWhiteEl.textContent = '--:--';
      timerBlackEl.textContent = '--:--';
    }
    timerWhiteEl.classList.remove('timer-active', 'timer-low');
    timerBlackEl.classList.remove('timer-active', 'timer-low');
    return;
  }

  const snapshot = replayClockSnapshots[replayPly];
  if (!snapshot) {
    timerWhiteEl.textContent = '--:--';
    timerBlackEl.textContent = '--:--';
    timerWhiteEl.classList.remove('timer-active', 'timer-low');
    timerBlackEl.classList.remove('timer-active', 'timer-low');
    return;
  }

  timerWhiteEl.textContent = formatClockTime(snapshot.w);
  timerBlackEl.textContent = formatClockTime(snapshot.b);

  const nextPly = replayPly + 1;
  if (nextPly < replayGame.moves.length) {
    const nextSide = replayGame.moves[nextPly].side;
    timerWhiteEl.classList.toggle('timer-active', nextSide === 'w');
    timerBlackEl.classList.toggle('timer-active', nextSide === 'b');
  } else {
    timerWhiteEl.classList.remove('timer-active');
    timerBlackEl.classList.remove('timer-active');
  }
}

// --- Replay Player Bars ---

function updatePlayerBarsForReplay(gameRecord) {
  const w = gameRecord.white;
  const b = gameRecord.black;

  playerNameWhite.textContent = w.name || 'White';
  playerNameBlack.textContent = b.name || 'Black';
  const wEngInfo = w.engineId ? getEngineInfo(w.engineId) : null;
  const bEngInfo = b.engineId ? getEngineInfo(b.engineId) : null;
  playerIconWhite.textContent = w.isAI ? (wEngInfo?.icon || '\uD83E\uDD16') : '\uD83D\uDC64';
  playerIconBlack.textContent = b.isAI ? (bEngInfo?.icon || '\uD83E\uDD16') : '\uD83D\uDC64';

  if (w.elo) {
    playerEloWhite.textContent = w.elo;
    playerEloWhite.classList.remove('hidden');
  } else {
    playerEloWhite.classList.add('hidden');
  }

  if (b.elo) {
    playerEloBlack.textContent = b.elo;
    playerEloBlack.classList.remove('hidden');
  } else {
    playerEloBlack.classList.add('hidden');
  }

  capturedByWhiteEl.innerHTML = '';
  capturedByBlackEl.innerHTML = '';

  gameTypeLabel.textContent = gameRecord.gameType === 'chess960' ? 'Chess960' : 'Standard';
}

// --- Replay Move List ---

function buildReplayMoveList(gameRecord) {
  replayMoveListEl.innerHTML = '';

  for (let i = 0; i < gameRecord.moves.length; i++) {
    const move = gameRecord.moves[i];
    const moveNum = Math.floor(i / 2) + 1;
    const isWhite = move.side === 'w';

    if (isWhite) {
      const numEl = document.createElement('span');
      numEl.className = 'strip-move-num';
      numEl.textContent = `${moveNum}.`;
      replayMoveListEl.appendChild(numEl);
    }

    const moveEl = document.createElement('span');
    moveEl.className = 'strip-move';
    moveEl.textContent = move.san;
    moveEl.dataset.ply = i;
    moveEl.addEventListener('click', () => {
      stopReplayPlayback();
      replayGoToMove(parseInt(moveEl.dataset.ply, 10));
    });
    replayMoveListEl.appendChild(moveEl);
  }
}

function highlightReplayMove() {
  replayMoveListEl.querySelectorAll('.strip-move-active').forEach(el => {
    el.classList.remove('strip-move-active');
  });

  if (replayPly >= 0) {
    const el = replayMoveListEl.querySelector(`.strip-move[data-ply="${replayPly}"]`);
    if (el) {
      el.classList.add('strip-move-active');
      el.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
    }
  } else {
    replayMoveListEl.scrollLeft = 0;
  }
}

// --- Replay Button State ---

function updateReplayButtons() {
  if (!replayGame) return;
  const atStart = replayPly === -1;
  const atEnd = replayPly >= replayGame.moves.length - 1;

  replayStartBtn.disabled = atStart;
  replayPrevBtn.disabled = atStart;
  replayNextBtn.disabled = atEnd;
  replayEndBtn.disabled = atEnd;
}

function formatReplayResult(gameRecord) {
  if (!gameRecord.result) return '';
  if (gameRecord.result === 'abandoned') return 'Abandoned';

  const reasons = {
    checkmate: 'Checkmate',
    stalemate: 'Stalemate',
    timeout: 'Time out',
    insufficient: 'Insufficient material',
    threefold: 'Threefold repetition',
    '50-move': 'Fifty-move rule',
    draw: 'Draw',
  };

  const reason = reasons[gameRecord.resultReason] || '';
  if (gameRecord.result === 'draw') return reason ? `Draw \u2014 ${reason}` : 'Draw';
  const winner = gameRecord.result === 'white' ? 'White' : 'Black';
  return reason ? `${reason}! ${winner} wins` : `${winner} wins`;
}

// --- Main-Board Analysis ---

function loadCachedAnalysis(serverId) {
  if (!serverId) return null;
  try {
    const raw = localStorage.getItem(ANALYSIS_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    const entry = cache.entries[serverId];
    return entry ? entry.result : null;
  } catch {
    return null;
  }
}

async function runMainBoardAnalysis(gameRecord) {
  if (!gameRecord || !gameRecord.moves || gameRecord.moves.length === 0) return;

  // Check cache first
  const serverId = gameRecord.serverId || null;
  const cached = loadCachedAnalysis(serverId);
  if (cached) {
    setMainBoardAnalysis(cached);
    return;
  }

  // Lazily create engine
  if (!replayAnalysisEngine) {
    replayAnalysisEngine = new AnalysisEngine();
  }

  const totalPositions = gameRecord.moves.length + 1;
  replayProgressEl.classList.remove('hidden');
  replayProgressFillEl.style.width = '0%';

  try {
    const result = await replayAnalysisEngine.analyze(
      gameRecord.moves,
      gameRecord.startingFen,
      {
        depth: 18,
        serverId: serverId,
        onProgress: ({ current, total }) => {
          const pct = total > 0 ? (current / total * 100) : 0;
          replayProgressFillEl.style.width = `${pct}%`;
        }
      }
    );
    setMainBoardAnalysis(result);
  } catch (err) {
    if (err !== 'stopped') {
      console.warn('Analysis failed:', err);
    }
    replayProgressEl.classList.add('hidden');
    replayProgressFillEl.style.width = '0%';
  }
}

function setMainBoardAnalysis(result) {
  replayAnalysisData = result;

  // Hide progress bar
  replayProgressEl.classList.add('hidden');
  replayProgressFillEl.style.width = '0%';

  // Add classification icons to move list
  addClassificationIcons();

  // Render accuracy summary
  renderAccuracy();

  // Update critical moment nav
  updateCriticalNav();

  // Show detail and engine arrows for current move
  updateAnalysisDetail();
  updateEngineArrows();

  // Show and update eval bar (only if toggle is on)
  if (evalBarToggle && evalBarToggle.checked) {
    mainEvalBar.show();
  }
  updateMainEvalBar();

  // Show summary button
  if (replaySummaryBtn) replaySummaryBtn.classList.remove('hidden');
}

function addClassificationIcons() {
  if (!replayAnalysisData) return;

  const moveEls = replayMoveListEl.querySelectorAll('.strip-move[data-ply]');
  const criticalSet = new Set(replayAnalysisData.criticalMoments);

  moveEls.forEach(el => {
    const ply = parseInt(el.dataset.ply, 10);
    const posIdx = ply + 1; // positions[0] = starting, positions[ply+1] = after move
    if (posIdx >= replayAnalysisData.positions.length) return;

    const pos = replayAnalysisData.positions[posIdx];
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

function renderAccuracy() {
  if (!replayAnalysisData || !replayAccuracyEl) return;

  const summary = replayAnalysisData.summary;
  replayAccuracyEl.innerHTML = '';
  replayAccuracyEl.classList.remove('hidden');

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
    const bkParts = [];
    if (s.brilliant) bkParts.push(`!!:${s.brilliant}`);
    if (s.great) bkParts.push(`!:${s.great}`);
    bkParts.push(`B:${s.best || 0}`);
    if (s.excellent) bkParts.push(`E:${s.excellent}`);
    bkParts.push(`G:${s.good || 0}`);
    if (s.book) bkParts.push(`Bk:${s.book}`);
    bkParts.push(`I:${s.inaccuracy || 0}`);
    bkParts.push(`M:${s.mistake || 0}`);
    if (s.miss) bkParts.push(`Ms:${s.miss}`);
    bkParts.push(`BL:${s.blunder || 0}`);
    breakdown.textContent = bkParts.join(' ');
    div.appendChild(breakdown);

    replayAccuracyEl.appendChild(div);
  }
}

function updateAnalysisDetail() {
  if (!replayAnalysisData || !replayDetailEl) {
    if (replayDetailEl) replayDetailEl.classList.add('hidden');
    return;
  }

  const posIdx = replayPly + 1;
  if (posIdx < 0 || posIdx >= replayAnalysisData.positions.length) {
    replayDetailEl.classList.add('hidden');
    return;
  }

  const pos = replayAnalysisData.positions[posIdx];
  replayDetailEl.classList.remove('hidden');

  // Classification + cpLoss
  if (pos.classification) {
    const iconDef = CLASSIFICATION_ICONS[pos.classification] || {};
    replayClassEl.innerHTML = '';
    const icon = document.createElement('span');
    icon.className = `analysis-icon ${iconDef.cls || ''}`;
    icon.textContent = iconDef.text || '';
    replayClassEl.appendChild(icon);
    const label = document.createElement('span');
    const classLabel = pos.classification.charAt(0).toUpperCase() + pos.classification.slice(1);
    label.textContent = ` ${classLabel}${pos.cpLoss > 0 ? ` (${pos.cpLoss}cp)` : ''}`;
    replayClassEl.appendChild(label);
  } else {
    replayClassEl.textContent = 'Starting position';
  }

  // Eval
  const evalPawns = pos.eval / 100;
  const evalSign = evalPawns >= 0 ? '+' : '';
  const evalDisplay = Math.abs(pos.eval) >= 9900
    ? (pos.eval > 0 ? '+M' : '-M')
    : `${evalSign}${evalPawns.toFixed(2)}`;
  replayEvalEl.textContent = `Eval: ${evalDisplay}`;

  // Best move
  if (pos.bestMoveUci) {
    replayBestEl.textContent = `Best: ${pos.bestMoveUci}`;
  } else {
    replayBestEl.textContent = '';
  }

  // PV line (first 5 moves)
  if (pos.bestLineUci && pos.bestLineUci.length > 0) {
    const line = pos.bestLineUci.slice(0, 5).join(' ');
    replayLineEl.textContent = `Line: ${line}`;
  } else {
    replayLineEl.textContent = '';
  }
}

function updateEngineArrows() {
  const overlay = board.getArrowOverlay();
  overlay.clearEngineArrows();

  if (!replayAnalysisData) return;
  const posIdx = replayPly + 1;
  if (posIdx < 0 || posIdx >= replayAnalysisData.positions.length) return;

  const pos = replayAnalysisData.positions[posIdx];
  if (pos.bestMoveUci) {
    overlay.setEngineArrows(pos.bestMoveUci, pos.bestLineUci || []);
  }
}

function updateCriticalNav() {
  if (!replayAnalysisData || !replayAnalysisData.criticalMoments.length) {
    if (replayCritPrevBtn) replayCritPrevBtn.classList.add('hidden');
    if (replayCritNextBtn) replayCritNextBtn.classList.add('hidden');
    return;
  }

  replayCritPrevBtn.classList.remove('hidden');
  replayCritNextBtn.classList.remove('hidden');

  const moments = replayAnalysisData.criticalMoments;
  const curPos = replayPly + 1;

  const prevCrit = moments.filter(m => m < curPos);
  const nextCrit = moments.filter(m => m > curPos);

  replayCritPrevBtn.disabled = prevCrit.length === 0;
  replayCritNextBtn.disabled = nextCrit.length === 0;
}

function goToPrevCritical() {
  if (!replayAnalysisData) return;
  const moments = replayAnalysisData.criticalMoments;
  const curPos = replayPly + 1;
  const prev = moments.filter(m => m < curPos);
  if (prev.length > 0) {
    const targetPos = prev[prev.length - 1];
    stopReplayPlayback();
    replayGoToMove(targetPos - 1);
  }
}

function goToNextCritical() {
  if (!replayAnalysisData) return;
  const moments = replayAnalysisData.criticalMoments;
  const curPos = replayPly + 1;
  const next = moments.filter(m => m > curPos);
  if (next.length > 0) {
    const targetPos = next[0];
    stopReplayPlayback();
    replayGoToMove(targetPos - 1);
  }
}

function resetMainBoardAnalysis() {
  replayAnalysisData = null;

  // Hide progress
  if (replayProgressEl) {
    replayProgressEl.classList.add('hidden');
    replayProgressFillEl.style.width = '0%';
  }
  // Hide detail panel
  if (replayDetailEl) {
    replayDetailEl.classList.add('hidden');
  }
  // Hide accuracy panel
  if (replayAccuracyEl) {
    replayAccuracyEl.classList.add('hidden');
    replayAccuracyEl.innerHTML = '';
  }
  // Hide critical nav
  if (replayCritPrevBtn) replayCritPrevBtn.classList.add('hidden');
  if (replayCritNextBtn) replayCritNextBtn.classList.add('hidden');
  // Hide eval bar
  mainEvalBar.hide();
  mainEvalBar.reset();
  // Hide summary button
  if (replaySummaryBtn) replaySummaryBtn.classList.add('hidden');

  // Remove classification icons and critical markers
  replayMoveListEl.querySelectorAll('.analysis-icon').forEach(el => el.remove());
  replayMoveListEl.querySelectorAll('.analysis-critical').forEach(el => {
    el.classList.remove('analysis-critical');
  });
}

function updateMainEvalBar() {
  if (!replayAnalysisData) return;
  const posIdx = replayPly + 1;
  if (posIdx < 0 || posIdx >= replayAnalysisData.positions.length) return;
  mainEvalBar.update(replayAnalysisData.positions[posIdx].eval);
}

// --- Replay Keyboard Handler ---

function replayKeyHandler(e) {
  if (!isReplayMode) return;

  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault();
      replayPrev();
      break;
    case 'ArrowRight':
      e.preventDefault();
      replayNext();
      break;
    case ' ':
      e.preventDefault();
      toggleReplayPlayback();
      break;
    case 'Home':
      e.preventDefault();
      replayGoToStart();
      break;
    case 'End':
      e.preventDefault();
      replayGoToEnd();
      break;
  }
}

// Wire up replay control buttons
replayStartBtn.addEventListener('click', replayGoToStart);
replayPrevBtn.addEventListener('click', replayPrev);
replayPlayBtn.addEventListener('click', toggleReplayPlayback);
replayNextBtn.addEventListener('click', replayNext);
replayEndBtn.addEventListener('click', replayGoToEnd);

// Wire up analysis toggle and critical nav buttons
if (replayAnalyzeCheckbox) {
  replayAnalyzeCheckbox.addEventListener('change', () => {
    const enabled = replayAnalyzeCheckbox.checked;
    localStorage.setItem('chess-auto-analyze', enabled ? 'true' : 'false');
    if (enabled) {
      if (isReplayMode && replayGame && !replayAnalysisData) {
        runMainBoardAnalysis(replayGame);
      }
    } else {
      if (replayAnalysisEngine) replayAnalysisEngine.stop();
      resetMainBoardAnalysis();
    }
  });
}
if (replayCritPrevBtn) replayCritPrevBtn.addEventListener('click', goToPrevCritical);
if (replayCritNextBtn) replayCritNextBtn.addEventListener('click', goToNextCritical);

// Wire up post-game summary callback on the full-screen replay viewer
replayViewer.setSummaryCallback((gameRecord, analysisData) => {
  if (!postGameAnalysisEngine) {
    postGameAnalysisEngine = new AnalysisEngine();
  }

  const callbacks = {
    onReview: () => {},  // Already in replay, no action needed
    onNewGame: () => { replayViewer.close(); startNewGame(); },
    onClose: () => {},
  };

  postGameSummary.setCallbacks(callbacks);

  if (analysisData) {
    postGameSummary.show(gameRecord, analysisData);
  } else {
    postGameSummary.showWithAnalysis(
      gameRecord,
      postGameAnalysisEngine,
      gameRecord.serverId || null,
      callbacks
    );
  }
});

// Wire up main-board replay summary button
if (replaySummaryBtn) {
  replaySummaryBtn.addEventListener('click', () => {
    if (!isReplayMode || !replayGame) return;

    if (!postGameAnalysisEngine) {
      postGameAnalysisEngine = new AnalysisEngine();
    }

    const callbacks = {
      onReview: () => {},  // Already in replay mode
      onNewGame: () => startNewGame(),
      onClose: () => {},
    };

    postGameSummary.setCallbacks(callbacks);

    if (replayAnalysisData) {
      postGameSummary.show(replayGame, { summary: replayAnalysisData.summary });
    } else {
      postGameSummary.showWithAnalysis(
        replayGame,
        postGameAnalysisEngine,
        replayGame.serverId || null,
        callbacks
      );
    }
  });
}

// Dev indicator management
const devIndicator = document.getElementById('dev-indicator');
const DEV_MODE_KEY = 'chess-dev-mode';

function checkDevMode() {
  const devMode = localStorage.getItem(DEV_MODE_KEY);
  if (devMode === 'true') {
    devIndicator.classList.remove('hidden');
  } else {
    devIndicator.classList.add('hidden');
  }
}

// Check on load
checkDevMode();

// Poll for changes every 500ms
setInterval(checkDevMode, 500);

// --- Engine Selection Persistence ---

const LS_ENGINE_KEY = 'chess-engine-selection';

/** Populate engine dropdowns from the registry. */
function populateEngineDropdowns() {
  const engines = getAllEngines();
  for (const select of [aiWhiteEngineSelect, aiBlackEngineSelect]) {
    select.innerHTML = '';
    for (const eng of engines) {
      const opt = document.createElement('option');
      opt.value = eng.id;
      opt.textContent = `${eng.icon} ${eng.name}`;
      select.appendChild(opt);
    }
  }
}

function saveEngineSelection() {
  localStorage.setItem(LS_ENGINE_KEY, JSON.stringify({
    white: aiWhiteEngineSelect.value,
    black: aiBlackEngineSelect.value,
  }));
}

function loadEngineSelection() {
  try {
    const raw = localStorage.getItem(LS_ENGINE_KEY);
    if (raw) {
      const { white, black } = JSON.parse(raw);
      if (white && getEngineInfo(white)) aiWhiteEngineSelect.value = white;
      if (black && getEngineInfo(black)) aiBlackEngineSelect.value = black;
    }
  } catch { /* ignore */ }
}

// Populate dropdowns, restore saved selection, sync ELO ranges
populateEngineDropdowns();
loadEngineSelection();
updateEloSliderRange('w');
updateEloSliderRange('b');

// Initialize DB, then start game (engines load lazily in startNewGame)
db.open().catch(e => { console.warn('Database unavailable:', e); }).then(() => {
  startNewGame();
});
