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

export class Profile {
  constructor(auth) {
    this._auth = auth;
    this._modal = null;
    this._buildDOM();
  }

  async show(username) {
    if (!username && this._auth.isLoggedIn) {
      username = this._auth.user.username;
    }
    if (!username) return;

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
    const isOwn = this._auth.isLoggedIn && this._auth.user.id === user.id;
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
        <h3>Recent Games</h3>
        <div class="profile-games-list"></div>
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

    // Load recent games
    this._loadRecentGames(user.username, body.querySelector('.profile-games-list'));
  }

  async _loadRecentGames(username, container) {
    try {
      const headers = this._auth.isLoggedIn ? this._auth.getAuthHeaders() : {};
      const res = await fetch(`${API_BASE}/users/${encodeURIComponent(username)}/games?limit=10`, { headers });
      if (!res.ok) {
        container.textContent = 'Could not load games';
        return;
      }
      const data = await res.json();
      if (!data.games || data.games.length === 0) {
        container.textContent = 'No games yet';
        return;
      }
      container.innerHTML = data.games.map(g => {
        const date = new Date(g.startTime).toLocaleDateString();
        const result = g.result || 'ongoing';
        return `
          <div class="profile-game-row">
            <span class="pg-players">${this._esc(g.white.name)} vs ${this._esc(g.black.name)}</span>
            <span class="pg-result">${result}</span>
            <span class="pg-type">${g.gameType}</span>
            <span class="pg-date">${date}</span>
          </div>
        `;
      }).join('');
    } catch (e) {
      container.textContent = 'Failed to load games';
    }
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}
