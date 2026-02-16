import { Game } from './game.js';
import { Board } from './board.js';
import { Timer } from './timer.js';
import { AI } from './ai.js';
import { GameDatabase } from './database.js';
import { GameBrowser } from './browser.js';
import { ReplayViewer } from './replay.js';

const PIECE_ORDER = { q: 0, r: 1, b: 2, n: 3, p: 4 };
const PIECE_VALUES = { q: 9, r: 5, b: 3, n: 3, p: 1 };
const PIECE_DISPLAY = { k: 'K', q: 'Q', r: 'R', b: 'B', n: 'N', p: 'P' };

// Art style configuration
const STYLE_PATHS = {
  classic: 'img/pieces',
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
const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel = document.getElementById('settings-panel');
const artStylePicker = document.getElementById('art-style-picker');
const aiWhiteToggle = document.getElementById('ai-white-toggle');
const aiWhiteEloSlider = document.getElementById('ai-white-elo');
const aiWhiteEloValue = document.getElementById('ai-white-elo-value');
const aiWhiteEloWrapper = document.getElementById('ai-white-elo-wrapper');
const aiBlackToggle = document.getElementById('ai-black-toggle');
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

const board = new Board(boardEl, game, promotionModal);
const timer = new Timer(timerWhiteEl, timerBlackEl);
const ai = new AI();
const db = new GameDatabase();
const replayViewer = new ReplayViewer();
const gameBrowser = new GameBrowser(db, replayViewer);

let moveCount = 0;
let gameId = 0;
let currentDbGameId = null;
let customWhiteName = null;
let customBlackName = null;

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

  setTimeout(async () => {
    // Check again after delay in case game state changed
    if (currentGameId !== gameId) return;
    if (game.isGameOver()) return;

    updateStatus(`${sideLabel} AI is thinking...`);

    try {
      const fen = game.chess.fen();
      const move = await ai.requestMove(fen, elo);

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
  }, 400);
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

// --- Game Flow ---

function startNewGame() {
  // End the current game as abandoned if moves were made and game isn't over
  if (currentDbGameId !== null && moveCount > 0 && !game.isGameOver()) {
    db.endGame(currentDbGameId, 'abandoned', 'abandoned')
      .catch(err => console.warn('Failed to abandon game in DB:', err));
  }

  gameId++;
  ai.stop();

  const chess960 = chess960Toggle.checked;
  game.newGame(chess960);
  board.render();
  moveCount = 0;

  // Configure AI (per-side)
  ai.configure({
    whiteEnabled: aiWhiteToggle.checked,
    whiteElo: parseInt(aiWhiteEloSlider.value, 10),
    blackEnabled: aiBlackToggle.checked,
    blackElo: parseInt(aiBlackEloSlider.value, 10),
  });
  board.setAI(ai);
  ai.newGame();

  const config = getTimeConfig();
  if (config) {
    timer.configure(config.whiteSec, config.increment, config.blackSec);
  } else {
    timer.configure(0, 0);
  }

  // Update game type label
  gameTypeLabel.textContent = chess960 ? 'Chess960' : 'Standard';

  // Show matchup info in status briefly
  const wIsAI = aiWhiteToggle.checked;
  const bIsAI = aiBlackToggle.checked;
  let matchup;
  if (wIsAI && bIsAI) {
    const wElo = aiWhiteEloSlider.value;
    const bElo = aiBlackEloSlider.value;
    matchup = wElo === bElo ? `AI vs AI (${wElo})` : `AI (${wElo}) vs AI (${bElo})`;
  } else if (wIsAI) {
    matchup = `AI (${aiWhiteEloSlider.value}) vs Human`;
  } else if (bIsAI) {
    matchup = `Human vs AI (${aiBlackEloSlider.value})`;
  } else {
    matchup = 'Human vs Human';
  }
  updateStatus(matchup, true);

  // Update player type icons and info
  playerIconWhite.textContent = wIsAI ? '🤖' : '👤';
  playerIconBlack.textContent = bIsAI ? '🤖' : '👤';
  const wEloVal = parseInt(aiWhiteEloSlider.value, 10);
  const bEloVal = parseInt(aiBlackEloSlider.value, 10);
  const wName = wIsAI ? 'Stockfish' : (customWhiteName || 'Human');
  const bName = bIsAI ? 'Stockfish' : (customBlackName || 'Human');
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

  // Save game to database
  currentDbGameId = null;
  db.createGame({
    gameType: chess960 ? 'chess960' : 'standard',
    timeControl: getTimeControlLabel(),
    startingFen: game.chess.fen(),
    white: {
      name: wIsAI ? `Stockfish ${wEloVal}` : wName,
      isAI: wIsAI,
      elo: wIsAI ? wEloVal : null,
    },
    black: {
      name: bIsAI ? `Stockfish ${bEloVal}` : bName,
      isAI: bIsAI,
      elo: bIsAI ? bEloVal : null,
    },
  }).then(id => {
    currentDbGameId = id;
  }).catch(err => {
    console.warn('Failed to save game to database:', err);
    currentDbGameId = null;
  });

  // If AI plays White, show start button instead of auto-starting
  if (ai.isEnabled() && ai.isAITurn('w')) {
    startGameBtn.classList.remove('hidden');
  } else {
    startGameBtn.classList.add('hidden');
  }
}

board.onMove((result) => {
  moveCount++;
  showingGameInfo = false;

  // Disable pre-game interactive controls after first move
  if (moveCount === 1) {
    appEl.classList.remove('pre-game');
    closeAllPopups();
    startGameBtn.classList.add('hidden');
  }

  renderCaptured();

  // Save move to database
  if (currentDbGameId !== null) {
    const side = game.getTurn() === 'w' ? 'b' : 'w'; // side that just moved
    db.addMove(currentDbGameId, {
      ply: moveCount - 1,
      san: result.san,
      fen: game.chess.fen(),
      timestamp: Date.now(),
      side: side,
    }).catch(err => console.warn('Failed to save move:', err));
  }

  if (timer.isEnabled()) {
    const currentTurn = game.getTurn();
    if (moveCount === 1) {
      // First move: start black's timer (white just moved)
      timer.start(currentTurn);
    } else {
      timer.switchTo(currentTurn);
    }
  }

  if (game.isGameOver()) {
    timer.stop();
    updateStatus();

    // Save game result to database
    if (currentDbGameId !== null) {
      const { result: dbResult, reason } = getGameResult();
      db.endGame(currentDbGameId, dbResult, reason)
        .catch(err => console.warn('Failed to end game in DB:', err));
    }
    return;
  }

  updateStatus();

  // Trigger AI move if it's the computer's turn
  triggerAIMove();
});

timer.onTimeout((loser) => {
  ai.stop();
  game.setTimedOut();
  const winner = loser === 'White' ? 'Black' : 'White';
  updateStatus(`Time out! ${winner} wins`);

  // Save timeout result to database
  if (currentDbGameId !== null) {
    const dbResult = loser === 'White' ? 'black' : 'white';
    db.endGame(currentDbGameId, dbResult, 'timeout')
      .catch(err => console.warn('Failed to end game in DB:', err));
  }
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

    // Update database
    if (currentDbGameId !== null) {
      db.updatePlayerName(currentDbGameId, side, newName)
        .catch(err => console.warn('Failed to update player name:', err));
    }
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

playerNameWhite.addEventListener('click', (e) => {
  e.stopPropagation();
  startNameEdit(playerNameWhite, 'white');
});

playerNameBlack.addEventListener('click', (e) => {
  e.stopPropagation();
  startNameEdit(playerNameBlack, 'black');
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

// Settings panel toggle
settingsToggle.addEventListener('click', () => {
  const isHidden = settingsPanel.classList.toggle('hidden');
  settingsToggle.classList.toggle('active', !isHidden);
  settingsToggle.setAttribute('aria-expanded', !isHidden);

  // Toggle scroll mode — enable scrolling when settings are open
  document.querySelector('.app').classList.toggle('settings-open', !isHidden);
});

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

// AI per-side toggles - show/hide ELO sliders
aiWhiteToggle.addEventListener('change', () => {
  aiWhiteEloWrapper.classList.toggle('hidden', !aiWhiteToggle.checked);
});

aiBlackToggle.addEventListener('change', () => {
  aiBlackEloWrapper.classList.toggle('hidden', !aiBlackToggle.checked);
});

// ELO slider live value display
aiWhiteEloSlider.addEventListener('input', () => {
  aiWhiteEloValue.textContent = aiWhiteEloSlider.value;
});

aiBlackEloSlider.addEventListener('input', () => {
  aiBlackEloValue.textContent = aiBlackEloSlider.value;
});

// Archive menu toggle
archiveToggleBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  archiveMenu.classList.toggle('hidden');
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
  if (moveCount > 0) return;
  aiWhiteToggle.checked = !aiWhiteToggle.checked;
  aiWhiteToggle.dispatchEvent(new Event('change'));
  startNewGame();
});

playerIconBlack.addEventListener('click', () => {
  if (moveCount > 0) return;
  aiBlackToggle.checked = !aiBlackToggle.checked;
  aiBlackToggle.dispatchEvent(new Event('change'));
  startNewGame();
});

// Click game type label to toggle Chess960 ↔ Standard (only before first move)
gameTypeLabel.addEventListener('click', () => {
  if (moveCount > 0) return;
  chess960Toggle.checked = !chess960Toggle.checked;
  startNewGame();
});

// Click timer for time control dropdown (only before first move)
function showTimerDropdown(timerEl) {
  if (moveCount > 0) return;
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
  if (moveCount > 0) return;
  closeAllPopups();

  const isWhite = side === 'w';
  const slider = isWhite ? aiWhiteEloSlider : aiBlackEloSlider;
  const settingsValue = isWhite ? aiWhiteEloValue : aiBlackEloValue;

  const popup = document.createElement('div');
  popup.className = 'elo-popup';

  const rangeInput = document.createElement('input');
  rangeInput.type = 'range';
  rangeInput.min = '100';
  rangeInput.max = '3200';
  rangeInput.step = '50';
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
    const hadPopup = document.querySelector('.elo-popup');
    closeAllPopups();
    if (hadPopup && moveCount === 0) {
      startNewGame();
    }
  }
});

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

// Initialize DB and AI engine, then start game
Promise.all([
  db.open().catch(e => { console.warn('Database unavailable:', e); }),
  ai.init().catch(e => { console.warn('AI engine failed to load, continuing without AI:', e); }),
]).then(() => {
  startNewGame();
});
