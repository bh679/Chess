import { Game } from './game.js';
import { Board } from './board.js';

const game = new Game();
const statusEl = document.getElementById('status');
const boardEl = document.getElementById('board');
const promotionModal = document.getElementById('promotion-modal');
const newGameBtn = document.getElementById('new-game');

const board = new Board(boardEl, game, promotionModal);

function updateStatus() {
  statusEl.textContent = game.getGameStatus();
  statusEl.className = 'status';
  if (game.isGameOver()) {
    statusEl.classList.add('game-over');
  } else if (game.getGameStatus().startsWith('Check')) {
    statusEl.classList.add('in-check');
  }
}

board.onMove(() => updateStatus());

newGameBtn.addEventListener('click', () => {
  game.newGame();
  board.render();
  updateStatus();
});

board.render();
updateStatus();
