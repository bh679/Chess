import { Game } from './game.js';
import { Board } from './board.js';
import { Timer } from './timer.js';

const PIECE_ORDER = { q: 0, r: 1, b: 2, n: 3, p: 4 };
const PIECE_VALUES = { q: 9, r: 5, b: 3, n: 3, p: 1 };
const PIECE_DISPLAY = { k: 'K', q: 'Q', r: 'R', b: 'B', n: 'N', p: 'P' };

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
const animationsToggle = document.getElementById('animations-toggle');

const board = new Board(boardEl, game, promotionModal);
const timer = new Timer(timerWhiteEl, timerBlackEl);

let moveCount = 0;

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
      img.src = `img/pieces/${victimColor}${PIECE_DISPLAY[p]}.svg`;
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

function updateStatus(msg) {
  statusEl.textContent = msg || game.getGameStatus();
  statusEl.className = 'status';
  if (game.isGameOver() || msg) {
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

function startNewGame() {
  game.newGame();
  board.render();
  moveCount = 0;

  const config = getTimeConfig();
  if (config) {
    timer.configure(config.whiteSec, config.increment, config.blackSec);
  } else {
    timer.configure(0, 0);
  }

  updateStatus();
  renderCaptured();
}

board.onMove((result) => {
  moveCount++;
  renderCaptured();

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
  }

  updateStatus();
});

timer.onTimeout((loser) => {
  const winner = loser === 'White' ? 'Black' : 'White';
  updateStatus(`Time out! ${winner} wins`);
});

newGameBtn.addEventListener('click', startNewGame);

// Time control select
timeControlSelect.addEventListener('change', () => {
  if (timeControlSelect.value === 'custom') {
    customTimeModal.classList.remove('hidden');
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
});

customTimeCancel.addEventListener('click', () => {
  customTimeModal.classList.add('hidden');
  timeControlSelect.value = '600|0'; // fallback to Rapid 10+0
});

// Animations toggle
animationsToggle.addEventListener('change', () => {
  board.setAnimationsEnabled(animationsToggle.checked);
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

// Start initial game
startNewGame();
