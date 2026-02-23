/**
 * Friends — friends list panel.
 *
 * Shows friends, pending incoming/outgoing requests.
 * Add friend by username, accept/reject/remove.
 */

const API_BASE = '/api';

export class Friends {
  constructor(auth) {
    this._auth = auth;
    this._modal = null;
    this._buildDOM();
  }

  show() {
    if (!this._auth.isLoggedIn) return;
    this._modal.classList.remove('hidden');
    this._load();
  }

  hide() {
    this._modal.classList.add('hidden');
  }

  _buildDOM() {
    this._modal = document.createElement('div');
    this._modal.className = 'friends-modal hidden';
    this._modal.innerHTML = `
      <div class="friends-backdrop"></div>
      <div class="friends-panel">
        <button class="friends-close">\u2715</button>
        <h3>Friends</h3>
        <div class="friends-add-row">
          <input type="text" class="friends-add-input" placeholder="Add by username..." maxlength="50">
          <button class="friends-add-btn">Add</button>
        </div>
        <div class="friends-status"></div>
        <div class="friends-section friends-pending-in">
          <h4>Incoming Requests</h4>
          <div class="friends-list"></div>
        </div>
        <div class="friends-section friends-pending-out">
          <h4>Sent Requests</h4>
          <div class="friends-list"></div>
        </div>
        <div class="friends-section friends-accepted">
          <h4>Friends</h4>
          <div class="friends-list"></div>
        </div>
      </div>
    `;
    document.body.appendChild(this._modal);

    this._modal.querySelector('.friends-backdrop').addEventListener('click', () => this.hide());
    this._modal.querySelector('.friends-close').addEventListener('click', () => this.hide());
    this._modal.querySelector('.friends-add-btn').addEventListener('click', () => this._addFriend());
    this._modal.querySelector('.friends-add-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._addFriend();
    });
  }

  async _load() {
    const statusEl = this._modal.querySelector('.friends-status');
    statusEl.textContent = 'Loading...';

    try {
      const res = await fetch(`${API_BASE}/friends`, {
        headers: this._auth.getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      statusEl.textContent = '';
      this._renderList(data);
    } catch (e) {
      statusEl.textContent = 'Failed to load friends';
    }
  }

  _renderList(data) {
    // Incoming
    const inSection = this._modal.querySelector('.friends-pending-in');
    const inList = inSection.querySelector('.friends-list');
    if (data.pendingIncoming.length === 0) {
      inSection.classList.add('hidden');
    } else {
      inSection.classList.remove('hidden');
      inList.innerHTML = data.pendingIncoming.map(f => `
        <div class="friend-row">
          <span class="friend-name">${this._esc(f.displayName || f.username)}</span>
          <button class="friend-accept-btn" data-id="${f.friendshipId}">Accept</button>
          <button class="friend-reject-btn" data-id="${f.friendshipId}">Reject</button>
        </div>
      `).join('');
      inList.querySelectorAll('.friend-accept-btn').forEach(btn => {
        btn.addEventListener('click', () => this._respond(btn.dataset.id, 'accept'));
      });
      inList.querySelectorAll('.friend-reject-btn').forEach(btn => {
        btn.addEventListener('click', () => this._respond(btn.dataset.id, 'reject'));
      });
    }

    // Outgoing
    const outSection = this._modal.querySelector('.friends-pending-out');
    const outList = outSection.querySelector('.friends-list');
    if (data.pendingOutgoing.length === 0) {
      outSection.classList.add('hidden');
    } else {
      outSection.classList.remove('hidden');
      outList.innerHTML = data.pendingOutgoing.map(f => `
        <div class="friend-row">
          <span class="friend-name">${this._esc(f.displayName || f.username)}</span>
          <span class="friend-pending">Pending</span>
        </div>
      `).join('');
    }

    // Accepted friends
    const acceptedSection = this._modal.querySelector('.friends-accepted');
    const acceptedList = acceptedSection.querySelector('.friends-list');
    if (data.friends.length === 0) {
      acceptedList.innerHTML = '<div class="friends-empty">No friends yet</div>';
    } else {
      acceptedList.innerHTML = data.friends.map(f => `
        <div class="friend-row">
          <span class="friend-name">${this._esc(f.displayName || f.username)}</span>
          <button class="friend-remove-btn" data-username="${this._esc(f.username)}">Remove</button>
        </div>
      `).join('');
      acceptedList.querySelectorAll('.friend-remove-btn').forEach(btn => {
        btn.addEventListener('click', () => this._removeFriend(btn.dataset.username));
      });
    }
  }

  async _addFriend() {
    const input = this._modal.querySelector('.friends-add-input');
    const username = input.value.trim();
    if (!username) return;

    const statusEl = this._modal.querySelector('.friends-status');
    try {
      const res = await fetch(`${API_BASE}/friends/request`, {
        method: 'POST',
        headers: this._auth.getAuthHeaders(),
        body: JSON.stringify({ username })
      });
      const data = await res.json();
      if (!res.ok) {
        statusEl.textContent = data.error || 'Failed to send request';
        return;
      }
      input.value = '';
      statusEl.textContent = 'Request sent!';
      setTimeout(() => { statusEl.textContent = ''; }, 2000);
      this._load();
    } catch (e) {
      statusEl.textContent = 'Network error';
    }
  }

  async _respond(friendshipId, action) {
    try {
      await fetch(`${API_BASE}/friends/respond`, {
        method: 'POST',
        headers: this._auth.getAuthHeaders(),
        body: JSON.stringify({ friendshipId: parseInt(friendshipId), action })
      });
      this._load();
    } catch (e) {
      // Silent retry on next load
    }
  }

  async _removeFriend(username) {
    // We need the userId — fetch profile first
    try {
      const res = await fetch(`${API_BASE}/users/${encodeURIComponent(username)}`, {
        headers: this._auth.getAuthHeaders()
      });
      if (!res.ok) return;
      const data = await res.json();
      await fetch(`${API_BASE}/friends/${data.user.id}`, {
        method: 'DELETE',
        headers: this._auth.getAuthHeaders()
      });
      this._load();
    } catch (e) {
      // Silent
    }
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}
