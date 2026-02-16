/**
 * GameBrowser — Modal overlay listing past games with pagination.
 * Click a game to open it in the ReplayViewer.
 */

const PAGE_SIZE = 15;

class GameBrowser {
  constructor(database, replayViewer) {
    this._db = database;
    this._replay = replayViewer;
    this._overlay = null;
    this._listEl = null;
    this._paginationEl = null;
    this._pageInfoEl = null;
    this._prevPageBtn = null;
    this._nextPageBtn = null;
    this._currentPage = 0;
    this._totalGames = 0;
    this._buildDOM();
  }

  /**
   * Open the browser modal and load the first page.
   */
  async open() {
    this._currentPage = 0;
    this._overlay.classList.remove('hidden');
    await this._loadPage(0);
  }

  /**
   * Close the browser modal.
   */
  close() {
    this._overlay.classList.add('hidden');
  }

  // --- Data Loading ---

  async _loadPage(page) {
    this._currentPage = page;

    try {
      this._totalGames = await this._db.getGameCount();
      const games = await this._db.listGames({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      this._renderGameList(games);
      this._updatePagination();
    } catch (err) {
      console.warn('Failed to load games:', err);
      this._listEl.innerHTML = '<div class="browser-empty">Error loading games</div>';
    }
  }

  // --- Rendering ---

  _renderGameList(games) {
    this._listEl.innerHTML = '';

    if (games.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'browser-empty';
      empty.textContent = 'No games recorded yet.';
      this._listEl.appendChild(empty);
      return;
    }

    for (const game of games) {
      const row = document.createElement('div');
      row.className = 'browser-game';
      row.dataset.gameId = game.id;

      const players = document.createElement('div');
      players.className = 'browser-game-players';
      players.textContent = `${game.white.name} vs ${game.black.name}`;
      row.appendChild(players);

      const meta = document.createElement('div');
      meta.className = 'browser-game-meta';

      const dateEl = document.createElement('span');
      dateEl.className = 'browser-game-date';
      dateEl.textContent = this._formatDate(game.startTime);
      meta.appendChild(dateEl);

      const movesEl = document.createElement('span');
      movesEl.className = 'browser-game-moves';
      movesEl.textContent = `${game.moveCount} moves`;
      meta.appendChild(movesEl);

      const resultEl = document.createElement('span');
      resultEl.className = 'browser-game-result';
      if (game.result === 'white') {
        resultEl.textContent = 'White wins';
        resultEl.classList.add('result-white');
      } else if (game.result === 'black') {
        resultEl.textContent = 'Black wins';
        resultEl.classList.add('result-black');
      } else if (game.result === 'draw') {
        resultEl.textContent = 'Draw';
        resultEl.classList.add('result-draw');
      } else if (game.result === 'abandoned') {
        resultEl.textContent = 'Abandoned';
        resultEl.classList.add('result-draw');
      } else {
        resultEl.textContent = 'In progress';
        resultEl.classList.add('result-draw');
      }
      meta.appendChild(resultEl);

      row.appendChild(meta);

      // Click to open replay
      row.addEventListener('click', async () => {
        try {
          const fullGame = await this._db.getGame(game.id);
          if (fullGame && fullGame.moves.length > 0) {
            this.close();
            this._replay.open(fullGame);
          }
        } catch (err) {
          console.warn('Failed to load game:', err);
        }
      });

      this._listEl.appendChild(row);
    }
  }

  _updatePagination() {
    const totalPages = Math.max(1, Math.ceil(this._totalGames / PAGE_SIZE));
    this._pageInfoEl.textContent = `Page ${this._currentPage + 1} of ${totalPages}`;
    this._prevPageBtn.disabled = this._currentPage === 0;
    this._nextPageBtn.disabled = this._currentPage >= totalPages - 1;

    // Hide pagination if only one page
    this._paginationEl.style.display = totalPages <= 1 ? 'none' : '';
  }

  // --- Helpers ---

  _formatDate(timestamp) {
    const d = new Date(timestamp);
    const now = new Date();

    // If today, show time only
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    // If this year, omit year
    if (d.getFullYear() === now.getFullYear()) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    return d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  // --- DOM Construction ---

  _buildDOM() {
    this._overlay = document.createElement('div');
    this._overlay.className = 'modal hidden';
    this._overlay.id = 'game-browser-modal';

    const content = document.createElement('div');
    content.className = 'modal-content browser-content';

    // Header
    const header = document.createElement('div');
    header.className = 'browser-header';

    const title = document.createElement('h3');
    title.textContent = 'Game History';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'browser-close-btn';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this.close());
    header.appendChild(closeBtn);

    content.appendChild(header);

    // Game list
    this._listEl = document.createElement('div');
    this._listEl.className = 'browser-list';
    content.appendChild(this._listEl);

    // Pagination
    this._paginationEl = document.createElement('div');
    this._paginationEl.className = 'browser-pagination';

    this._prevPageBtn = document.createElement('button');
    this._prevPageBtn.textContent = 'Previous';
    this._prevPageBtn.addEventListener('click', () => {
      if (this._currentPage > 0) {
        this._loadPage(this._currentPage - 1);
      }
    });
    this._paginationEl.appendChild(this._prevPageBtn);

    this._pageInfoEl = document.createElement('span');
    this._pageInfoEl.className = 'browser-page-info';
    this._paginationEl.appendChild(this._pageInfoEl);

    this._nextPageBtn = document.createElement('button');
    this._nextPageBtn.textContent = 'Next';
    this._nextPageBtn.addEventListener('click', () => {
      this._loadPage(this._currentPage + 1);
    });
    this._paginationEl.appendChild(this._nextPageBtn);

    content.appendChild(this._paginationEl);

    this._overlay.appendChild(content);

    // Close on backdrop click
    this._overlay.addEventListener('click', (e) => {
      if (e.target === this._overlay) {
        this.close();
      }
    });

    document.body.appendChild(this._overlay);
  }
}

export { GameBrowser };
