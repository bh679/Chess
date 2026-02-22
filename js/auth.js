/**
 * Auth — manages authentication state and token storage.
 *
 * Stores JWT token and user data in localStorage. Provides methods for
 * login, logout, token validation, and auth headers for API calls.
 */

const API_BASE = '/api';
const TOKEN_KEY = 'chess-auth-token';
const USER_KEY = 'chess-auth-user';

export class Auth {
  constructor() {
    this._user = null;
    this._token = null;
    this._onAuthChange = [];
    this._loadFromStorage();
  }

  get user() { return this._user; }
  get token() { return this._token; }
  get isLoggedIn() { return !!this._token && !!this._user; }

  onAuthChange(fn) {
    this._onAuthChange.push(fn);
  }

  async login(username, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Login failed');
    }
    const data = await res.json();
    this._token = data.token;
    this._user = data.user;
    this._saveToStorage();
    this._notifyChange();
    return this._user;
  }

  logout() {
    this._token = null;
    this._user = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._notifyChange();
  }

  async validateToken() {
    if (!this._token) return false;
    try {
      const res = await fetch(`${API_BASE}/auth/validate`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });
      if (!res.ok) {
        this.logout();
        return false;
      }
      return true;
    } catch (e) {
      // Offline — keep token, assume valid
      return true;
    }
  }

  async fetchMe() {
    if (!this._token) return null;
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: this.getAuthHeaders()
      });
      if (!res.ok) return null;
      const data = await res.json();
      this._user = data.user;
      this._saveToStorage();
      return data;
    } catch (e) {
      return null;
    }
  }

  getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this._token) {
      headers['Authorization'] = `Bearer ${this._token}`;
    }
    return headers;
  }

  _loadFromStorage() {
    this._token = localStorage.getItem(TOKEN_KEY);
    try {
      const raw = localStorage.getItem(USER_KEY);
      this._user = raw ? JSON.parse(raw) : null;
    } catch (e) {
      this._user = null;
    }
  }

  _saveToStorage() {
    if (this._token) {
      localStorage.setItem(TOKEN_KEY, this._token);
    }
    if (this._user) {
      localStorage.setItem(USER_KEY, JSON.stringify(this._user));
    }
  }

  _notifyChange() {
    for (const fn of this._onAuthChange) {
      try { fn(this._user); } catch (e) { console.error('Auth change handler error:', e); }
    }
  }
}
