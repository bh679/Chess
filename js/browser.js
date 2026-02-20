/**
 * GameBrowser — Modal overlay listing past games with pagination.
 * Two tabs: "My Games" (filtered by localStorage IDs) and "Public" (all server games).
 * Click a game to review it on the main board (or in the ReplayViewer as fallback).
 *
 * Analysis Review integration: auto-runs Board Analysis and displays
 * classification icons, accuracy, and detail panel in the replay viewer.
 *
 * Filters: quick row (me, player search, in progress) + expandable advanced
 * (result, player type, time control, game type, elo range).
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

    // Filter state
    this._filters = {
      result: 'all',
      playerType: 'all',
      timeControl: 'all',
      gameType: 'all',
      me: false,
      inProgress: false,
      eloMin: '',
      eloMax: '',
      playerSearch: ''
    };
    this._advancedVisible = false;
    this._filterEls = {};
    this._advancedToggleBtn = null;
    this._advancedPanelEl = null;
    this._playerDatalistEl = null;

    // Cache of all loaded games for dynamic filter population
    this._allLoadedGames = [];

    this._buildDOM();

    // Wire up the analyze callback on the replay viewer
    this._replay.setAnalyzeCallback((game) => this._runAnalysis(game));
  }

  /**
   * Open the browser modal and load the first page.
   */
  async open() {
    this._currentPage = 0;
    this._resetFilters();
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

  async _runAnalysis(game) {
    const serverId = game.serverId || null;
    const cached = this._loadCachedAnalysis(serverId);
    if (cached) {
      this._replay.setAnalysis(cached);
      return;
    }

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

  // --- Filters ---

  _resetFilters() {
    this._filters = {
      result: 'all',
      playerType: 'all',
      timeControl: 'all',
      gameType: 'all',
      me: false,
      inProgress: false,
      eloMin: '',
      eloMax: '',
      playerSearch: ''
    };
    this._advancedVisible = false;
    this._syncFilterDOM();
  }

  _syncFilterDOM() {
    if (!this._filterEls.result) return;
    this._filterEls.result.value = this._filters.result;
    this._filterEls.playerType.value = this._filters.playerType;
    this._filterEls.timeControl.value = this._filters.timeControl;
    this._filterEls.gameType.value = this._filters.gameType;
    this._filterEls.me.checked = this._filters.me;
    this._filterEls.inProgress.checked = this._filters.inProgress;
    this._filterEls.eloMin.value = this._filters.eloMin;
    this._filterEls.eloMax.value = this._filters.eloMax;
    this._filterEls.playerSearch.value = this._filters.playerSearch;
    this._advancedPanelEl.classList.toggle('hidden', !this._advancedVisible);
    this._updateAdvancedToggle();
  }

  _readFiltersFromDOM() {
    this._filters.result = this._filterEls.result.value;
    this._filters.playerType = this._filterEls.playerType.value;
    this._filters.timeControl = this._filterEls.timeControl.value;
    this._filters.gameType = this._filterEls.gameType.value;
    this._filters.me = this._filterEls.me.checked;
    this._filters.inProgress = this._filterEls.inProgress.checked;
    this._filters.eloMin = this._filterEls.eloMin.value;
    this._filters.eloMax = this._filterEls.eloMax.value;
    this._filters.playerSearch = this._filterEls.playerSearch.value;
  }

  _advancedFilterCount() {
    let count = 0;
    if (this._filters.result !== 'all') count++;
    if (this._filters.playerType !== 'all') count++;
    if (this._filters.timeControl !== 'all') count++;
    if (this._filters.gameType !== 'all') count++;
    if (this._filters.eloMin !== '') count++;
    if (this._filters.eloMax !== '') count++;
    return count;
  }

  _updateAdvancedToggle() {
    const count = this._advancedFilterCount();
    const chevron = this._advancedVisible ? '\u25B2' : '\u25BC';
    this._advancedToggleBtn.innerHTML = count > 0
      ? `<span class="browser-filter-badge">${count}</span> ${chevron}`
      : chevron;
    this._advancedToggleBtn.classList.toggle('browser-filter-toggle-active', count > 0);
  }

  _onFilterChange() {
    this._readFiltersFromDOM();
    this._updateAdvancedToggle();
    this._currentPage = 0;
    this._loadPage(0);
  }

  _applyFilters(games) {
    const f = this._filters;
    return games.filter(g => {
      // In Progress quick filter
      if (f.inProgress) {
        if (g.result !== null && g.result !== undefined) return false;
      }

      // Result (advanced)
      if (f.result !== 'all') {
        if (f.result === 'in_progress') {
          if (g.result !== null && g.result !== undefined) return false;
        } else if (g.result !== f.result) {
          return false;
        }
      }

      // Player type
      if (f.playerType !== 'all') {
        const wAI = g.white.isAI;
        const bAI = g.black.isAI;
        if (f.playerType === 'hvh' && (wAI || bAI)) return false;
        if (f.playerType === 'hvai' && !(wAI !== bAI)) return false;
        if (f.playerType === 'avai' && !(wAI && bAI)) return false;
      }

      // Time control
      if (f.timeControl !== 'all') {
        const tc = g.timeControl || 'none';
        if (tc !== f.timeControl) return false;
      }

      // Game type
      if (f.gameType !== 'all') {
        if ((g.gameType || 'standard') !== f.gameType) return false;
      }

      // Me (own games)
      if (f.me && !this._db.isOwnGame(g.id)) return false;

      // Elo range
      const eloMin = f.eloMin !== '' ? parseInt(f.eloMin, 10) : null;
      const eloMax = f.eloMax !== '' ? parseInt(f.eloMax, 10) : null;
      if (eloMin !== null || eloMax !== null) {
        const wElo = g.white.elo;
        const bElo = g.black.elo;
        if (wElo == null && bElo == null) return false;
        if (eloMin !== null) {
          const maxElo = Math.max(wElo || 0, bElo || 0);
          if (maxElo < eloMin) return false;
        }
        if (eloMax !== null) {
          const minElo = Math.min(
            wElo != null ? wElo : Infinity,
            bElo != null ? bElo : Infinity
          );
          if (minElo > eloMax) return false;
        }
      }

      // Player search
      if (f.playerSearch !== '') {
        const q = f.playerSearch.toLowerCase();
        const wName = (g.white.name || '').toLowerCase();
        const bName = (g.black.name || '').toLowerCase();
        if (!wName.startsWith(q) && !bName.startsWith(q)) return false;
      }

      return true;
    });
  }

  _hasActiveFilters() {
    const f = this._filters;
    return f.me || f.inProgress || f.playerSearch !== '' ||
      f.result !== 'all' || f.playerType !== 'all' ||
      f.timeControl !== 'all' || f.gameType !== 'all' ||
      f.eloMin !== '' || f.eloMax !== '';
  }

  _populateDynamicFilters(games) {
    // Time controls
    const tcSet = new Set();
    for (const g of games) {
      tcSet.add(g.timeControl || 'none');
    }
    const tcSelect = this._filterEls.timeControl;
    const currentTC = tcSelect.value;
    while (tcSelect.options.length > 1) tcSelect.remove(1);
    for (const tc of [...tcSet].sort()) {
      const opt = document.createElement('option');
      opt.value = tc;
      opt.textContent = tc === 'none' ? 'No clock' : tc;
      tcSelect.appendChild(opt);
    }
    tcSelect.value = currentTC;

    // Player names for datalist
    const nameSet = new Set();
    for (const g of games) {
      if (g.white.name) nameSet.add(g.white.name);
      if (g.black.name) nameSet.add(g.black.name);
    }
    this._playerDatalistEl.innerHTML = '';
    for (const name of [...nameSet].sort()) {
      const opt = document.createElement('option');
      opt.value = name;
      this._playerDatalistEl.appendChild(opt);
    }
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

      this._allLoadedGames = allGames;
      this._populateDynamicFilters(allGames);

      const afterMinMoves = allGames.filter(g => g.moveCount >= MIN_DISPLAY_MOVES);
      const filtered = this._applyFilters(afterMinMoves);
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
      if (this._hasActiveFilters()) {
        empty.textContent = 'No games match the current filters.';
      } else {
        empty.textContent = this._activeTab === 'mine'
          ? 'No games recorded yet.'
          : 'No public games available.';
      }
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
    this._paginationEl.style.display = totalPages <= 1 ? 'none' : '';
  }

  // --- Helpers ---

  _formatDate(timestamp) {
    const d = new Date(timestamp);
    const now = new Date();

    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

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

    // Quick filter row + advanced panel
    this._buildFilterBar(content);

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

    this._overlay.addEventListener('click', (e) => {
      if (e.target === this._overlay) {
        this.close();
      }
    });

    document.body.appendChild(this._overlay);
  }

  _buildFilterBar(parent) {
    const wrapper = document.createElement('div');
    wrapper.className = 'browser-filter-wrapper';

    // --- Quick filter row (always visible) ---
    const quickRow = document.createElement('div');
    quickRow.className = 'browser-filter-quick';

    // My games only checkbox
    const meLabel = document.createElement('label');
    meLabel.className = 'browser-filter-quick-label';
    this._filterEls.me = document.createElement('input');
    this._filterEls.me.type = 'checkbox';
    this._filterEls.me.className = 'browser-filter-checkbox';
    this._filterEls.me.addEventListener('change', () => this._onFilterChange());
    meLabel.appendChild(this._filterEls.me);
    meLabel.appendChild(document.createTextNode(' Mine'));
    quickRow.appendChild(meLabel);

    // In Progress checkbox
    const ipLabel = document.createElement('label');
    ipLabel.className = 'browser-filter-quick-label';
    this._filterEls.inProgress = document.createElement('input');
    this._filterEls.inProgress.type = 'checkbox';
    this._filterEls.inProgress.className = 'browser-filter-checkbox';
    this._filterEls.inProgress.addEventListener('change', () => this._onFilterChange());
    ipLabel.appendChild(this._filterEls.inProgress);
    ipLabel.appendChild(document.createTextNode(' Live'));
    quickRow.appendChild(ipLabel);

    // Player search (combo box)
    this._playerDatalistEl = document.createElement('datalist');
    this._playerDatalistEl.id = 'browser-player-names';
    this._filterEls.playerSearch = document.createElement('input');
    this._filterEls.playerSearch.type = 'text';
    this._filterEls.playerSearch.className = 'browser-filter-input browser-filter-quick-search';
    this._filterEls.playerSearch.placeholder = 'Player...';
    this._filterEls.playerSearch.setAttribute('list', 'browser-player-names');
    this._filterEls.playerSearch.addEventListener('input', () => this._onFilterChange());
    quickRow.appendChild(this._filterEls.playerSearch);
    quickRow.appendChild(this._playerDatalistEl);

    // Advanced toggle button (chevron + badge)
    this._advancedToggleBtn = document.createElement('button');
    this._advancedToggleBtn.className = 'browser-filter-advanced-toggle';
    this._advancedToggleBtn.innerHTML = '\u25BC';
    this._advancedToggleBtn.title = 'More filters';
    this._advancedToggleBtn.addEventListener('click', () => {
      this._advancedVisible = !this._advancedVisible;
      this._advancedPanelEl.classList.toggle('hidden', !this._advancedVisible);
      this._updateAdvancedToggle();
    });
    quickRow.appendChild(this._advancedToggleBtn);

    wrapper.appendChild(quickRow);

    // --- Advanced filter panel (expandable) ---
    this._advancedPanelEl = document.createElement('div');
    this._advancedPanelEl.className = 'browser-filter-advanced hidden';

    const grid = document.createElement('div');
    grid.className = 'browser-filter-grid';

    const makeGroup = (label, controlEl) => {
      const group = document.createElement('div');
      group.className = 'browser-filter-group';
      const lbl = document.createElement('label');
      lbl.className = 'browser-filter-label';
      lbl.textContent = label;
      group.appendChild(lbl);
      group.appendChild(controlEl);
      return group;
    };

    const makeSelect = (options) => {
      const sel = document.createElement('select');
      sel.className = 'browser-filter-select';
      for (const [value, text] of options) {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = text;
        sel.appendChild(opt);
      }
      sel.addEventListener('change', () => this._onFilterChange());
      return sel;
    };

    // Result
    this._filterEls.result = makeSelect([
      ['all', 'All'],
      ['white', 'White wins'],
      ['black', 'Black wins'],
      ['draw', 'Draw'],
      ['abandoned', 'Abandoned'],
      ['in_progress', 'In progress']
    ]);
    grid.appendChild(makeGroup('Result', this._filterEls.result));

    // Player Type
    this._filterEls.playerType = makeSelect([
      ['all', 'All'],
      ['hvh', 'Human vs Human'],
      ['hvai', 'Human vs AI'],
      ['avai', 'AI vs AI']
    ]);
    grid.appendChild(makeGroup('Player Type', this._filterEls.playerType));

    // Time Control
    this._filterEls.timeControl = makeSelect([['all', 'All']]);
    grid.appendChild(makeGroup('Time Control', this._filterEls.timeControl));

    // Game Type
    this._filterEls.gameType = makeSelect([
      ['all', 'All'],
      ['standard', 'Standard'],
      ['chess960', 'Chess960']
    ]);
    grid.appendChild(makeGroup('Game Type', this._filterEls.gameType));

    // Elo range
    const eloGroup = document.createElement('div');
    eloGroup.className = 'browser-filter-group browser-filter-group-full';
    const eloLabel = document.createElement('label');
    eloLabel.className = 'browser-filter-label';
    eloLabel.textContent = 'Elo Range';
    eloGroup.appendChild(eloLabel);
    const eloRow = document.createElement('div');
    eloRow.className = 'browser-filter-elo-row';
    this._filterEls.eloMin = document.createElement('input');
    this._filterEls.eloMin.type = 'number';
    this._filterEls.eloMin.className = 'browser-filter-input browser-filter-elo';
    this._filterEls.eloMin.placeholder = 'Min';
    this._filterEls.eloMin.addEventListener('input', () => this._onFilterChange());
    eloRow.appendChild(this._filterEls.eloMin);
    const eloDash = document.createElement('span');
    eloDash.className = 'browser-filter-elo-dash';
    eloDash.textContent = '\u2013';
    eloRow.appendChild(eloDash);
    this._filterEls.eloMax = document.createElement('input');
    this._filterEls.eloMax.type = 'number';
    this._filterEls.eloMax.className = 'browser-filter-input browser-filter-elo';
    this._filterEls.eloMax.placeholder = 'Max';
    this._filterEls.eloMax.addEventListener('input', () => this._onFilterChange());
    eloRow.appendChild(this._filterEls.eloMax);
    eloGroup.appendChild(eloRow);
    grid.appendChild(eloGroup);

    this._advancedPanelEl.appendChild(grid);

    // Clear all
    const clearBtn = document.createElement('button');
    clearBtn.className = 'browser-filter-clear';
    clearBtn.textContent = 'Clear all';
    clearBtn.addEventListener('click', () => {
      this._filters = {
        result: 'all',
        playerType: 'all',
        timeControl: 'all',
        gameType: 'all',
        me: false,
        inProgress: false,
        eloMin: '',
        eloMax: '',
        playerSearch: ''
      };
      this._syncFilterDOM();
      this._onFilterChange();
    });
    this._advancedPanelEl.appendChild(clearBtn);

    wrapper.appendChild(this._advancedPanelEl);
    parent.appendChild(wrapper);
  }
}

export { GameBrowser };
