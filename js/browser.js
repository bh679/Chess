/**
 * GameBrowser — Modal overlay listing past games with pagination.
 * Two tabs: "My Games" (filtered by localStorage IDs) and "Public" (all server games).
 * Click a game to review it on the main board (or in the ReplayViewer as fallback).
 *
 * Analysis Review integration: auto-runs Board Analysis and displays
 * classification icons, accuracy, and detail panel in the replay viewer.
 */

import { AnalysisEngine } from './analysis.js';

const PAGE_SIZE = 15;
const MIN_DISPLAY_MOVES = 4; // at least 2 moves per player
const CACHE_KEY = 'chess-analysis-cache';

class GameBrowser {
  constructor(database, replayViewer, onReviewOnBoard) {
    this._db = database;
    this._replay = replayViewer;
    this._onReviewOnBoard = onReviewOnBoard || null;
    this._overlay = null;
    this._listEl = null;
    this._paginationEl = null;
    this._pageInfoEl = null;
    this._prevPageBtn = null;
    this._nextPageBtn = null;
    this._tabMine = null;
    this._tabPublic = null;
    this._currentPage = 0;
    this._totalGames = 0;
    this._activeTab = 'mine'; // 'mine' | 'public'
    this._analysisEngine = null; // lazy-created on first analyze
    this._buildDOM();

    // Wire up the analyze callback on the replay viewer
    this._replay.setAnalyzeCallback((game) => this._runAnalysis(game));
  }

  /**
   * Open the browser modal and load the first page.
   */
  async open() {
    this._currentPage = 0;
    this._overlay.classList.remove('hidden');
    this._setActiveTab(this._activeTab);
    await this._loadPage(0);
  }

  /**
   * Close the browser modal.
   */
  close() {
    this._overlay.classList.add('hidden');
  }

  // --- Analysis ---

  /**
   * Run analysis on a game, checking cache first.
   * @param {Object} game — full game record
   */
  async _runAnalysis(game) {
    // Check cache for existing analysis
    const serverId = game.serverId || null;
    const cached = this._loadCachedAnalysis(serverId);
    if (cached) {
      this._replay.setAnalysis(cached);
      return;
    }

    // Lazily create engine
    if (!this._analysisEngine) {
      this._analysisEngine = new AnalysisEngine();
    }

    const totalPositions = game.moves.length + 1;
    this._replay.showAnalysisProgress(0, totalPositions);

    try {
      const result = await this._analysisEngine.analyze(
        game.moves,
        game.startingFen,
        {
          depth: 18,
          serverId: serverId,
          onProgress: ({ current, total }) => {
            this._replay.showAnalysisProgress(current, total);
          }
        }
      );
      this._replay.setAnalysis(result);
    } catch (err) {
      if (err !== 'stopped') {
        console.warn('Analysis failed:', err);
      }
      this._replay.hideAnalysisProgress();
    }
  }

  /**
   * Load cached analysis from localStorage.
   * @param {number|null} serverId
   * @returns {Object|null}
   */
  _loadCachedAnalysis(serverId) {
    if (!serverId) return null;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const cache = JSON.parse(raw);
      const entry = cache.entries[serverId];
      return entry ? entry.result : null;
    } catch {
      return null;
    }
  }

  // --- Tab Switching ---

  _setActiveTab(tab) {
    this._activeTab = tab;
    this._tabMine.classList.toggle('browser-tab-active', tab === 'mine');
    this._tabPublic.classList.toggle('browser-tab-active', tab === 'public');
  }

  async _switchTab(tab) {
    if (this._activeTab === tab) return;
    this._setActiveTab(tab);
    this._currentPage = 0;
    await this._loadPage(0);
  }

  // --- Data Loading ---

  async _loadPage(page) {
    this._currentPage = page;

    try {
      let allGames;
      if (this._activeTab === 'mine') {
        allGames = await this._db.listGames({ limit: 9999, offset: 0 });
      } else {
        allGames = await this._db.listAllGames({ limit: 9999, offset: 0 });
      }
      const filtered = allGames.filter(g => g.moveCount >= MIN_DISPLAY_MOVES);
      this._totalGames = filtered.length;

      const start = page * PAGE_SIZE;
      const pageGames = filtered.slice(start, start + PAGE_SIZE);

      this._renderGameList(pageGames);
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
      empty.textContent = this._activeTab === 'mine'
        ? 'No games recorded yet.'
        : 'No public games available.';
      this._listEl.appendChild(empty);
      return;
    }

    for (const game of games) {
      const row = document.createElement('div');
      row.className = 'browser-game';
      if (this._activeTab === 'public' && this._db.isOwnGame(game.id)) {
        row.classList.add('browser-game-own');
      }
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

      if (game.timeControl && game.timeControl !== 'none') {
        const tcEl = document.createElement('span');
        tcEl.className = 'browser-game-tc';
        tcEl.textContent = game.timeControl;
        meta.appendChild(tcEl);
      }

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

      // Click to review on main board (preferred) or open replay modal (fallback)
      row.addEventListener('click', async () => {
        try {
          const fullGame = await this._db.getGame(game.id);
          if (fullGame && fullGame.moves.length > 0) {
            this.close();
            if (this._onReviewOnBoard) {
              this._onReviewOnBoard(fullGame);
            } else {
              this._replay.open(fullGame);
            }
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
    closeBtn.textContent = '\u00D7';
    closeBtn.addEventListener('click', () => this.close());
    header.appendChild(closeBtn);

    content.appendChild(header);

    // Tabs
    const tabs = document.createElement('div');
    tabs.className = 'browser-tabs';

    this._tabMine = document.createElement('button');
    this._tabMine.className = 'browser-tab browser-tab-active';
    this._tabMine.textContent = 'My Games';
    this._tabMine.addEventListener('click', () => this._switchTab('mine'));
    tabs.appendChild(this._tabMine);

    this._tabPublic = document.createElement('button');
    this._tabPublic.className = 'browser-tab';
    this._tabPublic.textContent = 'Public';
    this._tabPublic.addEventListener('click', () => this._switchTab('public'));
    tabs.appendChild(this._tabPublic);

    content.appendChild(tabs);

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
