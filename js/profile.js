/**
 * Profile — user profile page/modal.
 *
 * Shows username, avatar, bio, per-time-control ratings,
 * W/L/D stats, rating history sparkline, and recent games.
 * Accessible via /#/profile?user=<username>
 */

const API_BASE = '/api';
const CATEGORIES = ['bullet', 'blitz', 'rapid', 'classical'];
const CATEGORY_ICONS = { bullet: '\u26A1', blitz: '\u23F1', rapid: '\u23F0', classical: '\u265A' };
const PROVISIONAL_THRESHOLD = 15;
const PAGE_SIZE = 10;

export class Profile {
  constructor(auth, { onGameClick } = {}) {
    this._auth = auth;
    this._onGameClick = onGameClick;
    this._modal = null;
    this._currentUsername = null;
    this._currentUserId = null;
    this._filters = { result: 'all', gameType: 'all', playerType: 'all', timeControl: 'all', eloMin: '', eloMax: '' };
    this._page = 0;
    this._totalGames = 0;
    this._buildDOM();
  }

  async show(username) {
    if (!username && this._auth.isLoggedIn) {
      username = this._auth.user.username;
    }
    if (!username) return;

    this._currentUsername = username;
    this._filters = { result: 'all', gameType: 'all', playerType: 'all', timeControl: 'all', eloMin: '', eloMax: '' };
    this._page = 0;
    this._modal.classList.remove('hidden');
    this._modal.querySelector('.profile-body').innerHTML = '<div class="profile-loading">Loading...</div>';

    try {
      const headers = this._auth.isLoggedIn ? this._auth.getAuthHeaders() : {};
      const res = await fetch(`${API_BASE}/users/${encodeURIComponent(username)}`, { headers });
      if (!res.ok) {
        this._modal.querySelector('.profile-body').innerHTML = '<div class="profile-error">Profile not found</div>';
        return;
      }
      const data = await res.json();
      this._currentUserId = data.user.id;
      this._renderProfile(data.user, data.ratings);
    } catch (e) {
      this._modal.querySelector('.profile-body').innerHTML = '<div class="profile-error">Failed to load profile</div>';
    }
  }

  hide() {
    this._modal.classList.add('hidden');
  }

  _buildDOM() {
    this._modal = document.createElement('div');
    this._modal.className = 'profile-modal hidden';
    this._modal.innerHTML = `
      <div class="profile-backdrop"></div>
      <div class="profile-panel">
        <button class="profile-close">\u2715</button>
        <div class="profile-body"></div>
      </div>
    `;
    document.body.appendChild(this._modal);

    this._modal.querySelector('.profile-backdrop').addEventListener('click', () => this.hide());
    this._modal.querySelector('.profile-close').addEventListener('click', () => this.hide());
  }

  _renderProfile(user, ratings) {
    const body = this._modal.querySelector('.profile-body');

    // Header
    let avatarHtml;
    if (user.avatarUrl) {
      avatarHtml = `<img class="profile-avatar-img" src="${user.avatarUrl}" alt="">`;
    } else {
      avatarHtml = `<div class="profile-avatar-placeholder">${(user.username || '?')[0].toUpperCase()}</div>`;
    }

    body.innerHTML = `
      <div class="profile-header">
        ${avatarHtml}
        <div class="profile-info">
          <h2 class="profile-display-name">${this._esc(user.displayName)}</h2>
          <span class="profile-username">@${this._esc(user.username)}</span>
          ${user.bio ? `<p class="profile-bio">${this._esc(user.bio)}</p>` : ''}
        </div>
      </div>
      <div class="profile-ratings"></div>
      <div class="profile-games-section">
        <h3>Games</h3>
        <div class="profile-games-filters"></div>
        <div class="profile-games-list"></div>
        <div class="profile-games-pagination"></div>
      </div>
    `;

    // Render rating cards
    const ratingsContainer = body.querySelector('.profile-ratings');
    for (const cat of CATEGORIES) {
      const r = ratings[cat];
      const card = document.createElement('div');
      card.className = 'profile-rating-card';

      if (r) {
        const provisional = r.gamesPlayed < PROVISIONAL_THRESHOLD;
        const total = r.wins + r.losses + r.draws;
        const winPct = total > 0 ? Math.round((r.wins / total) * 100) : 0;
        card.innerHTML = `
          <div class="rating-card-header">
            <span class="rating-card-icon">${CATEGORY_ICONS[cat]}</span>
            <span class="rating-card-label">${cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
          </div>
          <div class="rating-card-value">${Math.round(r.rating)}${provisional ? '?' : ''}</div>
          <div class="rating-card-rd">RD: ${Math.round(r.rd)}</div>
          <div class="rating-card-stats">
            <span class="rating-win">${r.wins}W</span>
            <span class="rating-loss">${r.losses}L</span>
            <span class="rating-draw">${r.draws}D</span>
            <span class="rating-pct">${winPct}%</span>
          </div>
        `;
      } else {
        card.innerHTML = `
          <div class="rating-card-header">
            <span class="rating-card-icon">${CATEGORY_ICONS[cat]}</span>
            <span class="rating-card-label">${cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
          </div>
          <div class="rating-card-value rating-unrated">--</div>
          <div class="rating-card-stats">No games</div>
        `;
      }
      ratingsContainer.appendChild(card);
    }

    // Build filter UI
    this._buildFilters(body.querySelector('.profile-games-filters'));

    // Load games
    this._loadGames();
  }

  _buildFilters(container) {
    container.innerHTML = `
      <div class="profile-filters-row">
        <select class="profile-filter-select" data-filter="result">
          <option value="all">All Results</option>
          <option value="win">Wins</option>
          <option value="loss">Losses</option>
          <option value="draw">Draws</option>
          <option value="abandoned">Abandoned</option>
        </select>
        <select class="profile-filter-select" data-filter="playerType">
          <option value="all">All Players</option>
          <option value="hvai">Human vs AI</option>
          <option value="hvh">Human vs Human</option>
          <option value="avai">AI vs AI</option>
        </select>
        <select class="profile-filter-select" data-filter="gameType">
          <option value="all">All Types</option>
          <option value="standard">Standard</option>
          <option value="chess960">Chess960</option>
        </select>
        <select class="profile-filter-select" data-filter="timeControl">
          <option value="all">All Time Controls</option>
          <option value="none">No Clock</option>
          <option value="Bullet 1+0">Bullet 1+0</option>
          <option value="Bullet 2+1">Bullet 2+1</option>
          <option value="Blitz 3+0">Blitz 3+0</option>
          <option value="Blitz 3+2">Blitz 3+2</option>
          <option value="Blitz 5+0">Blitz 5+0</option>
          <option value="Blitz 5+3">Blitz 5+3</option>
          <option value="Rapid 10+0">Rapid 10+0</option>
          <option value="Rapid 10+5">Rapid 10+5</option>
          <option value="Rapid 15+10">Rapid 15+10</option>
          <option value="Classical 30+0">Classical 30+0</option>
          <option value="Classical 30+20">Classical 30+20</option>
        </select>
      </div>
      <div class="profile-filters-row">
        <label class="profile-filter-label">Elo:</label>
        <input type="number" class="profile-filter-elo" data-filter="eloMin" placeholder="Min" min="0" max="4000">
        <span class="profile-filter-dash">\u2013</span>
        <input type="number" class="profile-filter-elo" data-filter="eloMax" placeholder="Max" min="0" max="4000">
        <button class="profile-filter-clear-btn">Clear</button>
      </div>
    `;

    container.querySelectorAll('.profile-filter-select').forEach(sel => {
      sel.addEventListener('change', () => {
        this._filters[sel.dataset.filter] = sel.value;
        this._page = 0;
        this._loadGames();
      });
    });

    container.querySelectorAll('.profile-filter-elo').forEach(input => {
      let timer;
      input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          this._filters[input.dataset.filter] = input.value;
          this._page = 0;
          this._loadGames();
        }, 500);
      });
    });

    container.querySelector('.profile-filter-clear-btn').addEventListener('click', () => {
      this._filters = { result: 'all', gameType: 'all', playerType: 'all', timeControl: 'all', eloMin: '', eloMax: '' };
      container.querySelectorAll('.profile-filter-select').forEach(s => { s.value = 'all'; });
      container.querySelectorAll('.profile-filter-elo').forEach(i => { i.value = ''; });
      this._page = 0;
      this._loadGames();
    });
  }

  async _loadGames() {
    const container = this._modal.querySelector('.profile-games-list');
    const pagination = this._modal.querySelector('.profile-games-pagination');
    if (!container) return;

    container.innerHTML = '<div class="profile-loading">Loading...</div>';

    try {
      const headers = this._auth.isLoggedIn ? this._auth.getAuthHeaders() : {};
      const params = new URLSearchParams({
        limit: PAGE_SIZE,
        offset: this._page * PAGE_SIZE,
      });
      if (this._filters.result !== 'all') params.set('result', this._filters.result);
      if (this._filters.gameType !== 'all') params.set('gameType', this._filters.gameType);
      if (this._filters.playerType !== 'all') params.set('playerType', this._filters.playerType);
      if (this._filters.timeControl !== 'all') params.set('timeControl', this._filters.timeControl);
      if (this._filters.eloMin) params.set('eloMin', this._filters.eloMin);
      if (this._filters.eloMax) params.set('eloMax', this._filters.eloMax);

      const res = await fetch(
        `${API_BASE}/users/${encodeURIComponent(this._currentUsername)}/games?${params}`,
        { headers }
      );
      if (!res.ok) {
        container.textContent = 'Could not load games';
        if (pagination) pagination.innerHTML = '';
        return;
      }
      const data = await res.json();
      this._totalGames = data.total || 0;

      if (!data.games || data.games.length === 0) {
        container.textContent = 'No games yet';
        if (pagination) pagination.innerHTML = '';
        return;
      }

      container.innerHTML = '';
      for (const g of data.games) {
        const row = document.createElement('a');
        row.className = 'profile-game-row';
        row.href = `/#/game/${g.id}`;
        const date = new Date(g.startTime).toLocaleDateString();

        // Format result display and determine CSS class
        let resultText = g.result || 'ongoing';
        let resultClass = '';
        if (g.result === 'white') {
          resultText = g.white.userId === this._currentUserId ? 'Won' : 'Lost';
          resultClass = g.white.userId === this._currentUserId ? 'pg-result-win' : 'pg-result-loss';
        } else if (g.result === 'black') {
          resultText = g.black.userId === this._currentUserId ? 'Won' : 'Lost';
          resultClass = g.black.userId === this._currentUserId ? 'pg-result-win' : 'pg-result-loss';
        } else if (g.result === 'draw') {
          resultText = 'Draw';
          resultClass = 'pg-result-draw';
        } else if (g.result === 'abandoned') {
          resultText = 'Abandoned';
          resultClass = 'pg-result-abandoned';
        }

        row.innerHTML = `
          <span class="pg-players">${this._esc(g.white.name)} vs ${this._esc(g.black.name)}</span>
          <span class="pg-result ${resultClass}">${resultText}</span>
          <span class="pg-type">${g.gameType}</span>
          <span class="pg-date">${date}</span>
        `;

        row.addEventListener('click', (e) => {
          e.preventDefault();
          if (this._onGameClick) {
            this.hide();
            this._onGameClick(g.id);
          }
        });

        container.appendChild(row);
      }

      // Pagination
      const totalPages = Math.ceil(this._totalGames / PAGE_SIZE);
      if (totalPages > 1 && pagination) {
        pagination.innerHTML = `
          <button class="profile-page-btn profile-page-prev" ${this._page === 0 ? 'disabled' : ''}>Previous</button>
          <span class="profile-page-info">Page ${this._page + 1} of ${totalPages}</span>
          <button class="profile-page-btn profile-page-next" ${this._page >= totalPages - 1 ? 'disabled' : ''}>Next</button>
        `;
        pagination.querySelector('.profile-page-prev')?.addEventListener('click', () => {
          if (this._page > 0) { this._page--; this._loadGames(); }
        });
        pagination.querySelector('.profile-page-next')?.addEventListener('click', () => {
          if (this._page < totalPages - 1) { this._page++; this._loadGames(); }
        });
      } else if (pagination) {
        pagination.innerHTML = '';
      }
    } catch (e) {
      container.textContent = 'Failed to load games';
      if (pagination) pagination.innerHTML = '';
    }
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}
