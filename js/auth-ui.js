/**
 * AuthUI — login modal and user menu in the header.
 *
 * Logged out: shows "Sign In" button in the header.
 * Logged in: shows avatar + username with dropdown menu.
 */

const WP_REGISTER_URL = '/wp/wp-login.php?action=register';

export class AuthUI {
  constructor(auth, { onProfileClick, onFriendsClick } = {}) {
    this._auth = auth;
    this._onProfileClick = onProfileClick;
    this._onFriendsClick = onFriendsClick;
    this._buildDOM();
    this._bindEvents();
    this._auth.onAuthChange(() => this._updateUI());
    this._updateUI();
  }

  _buildDOM() {
    // Auth container in header
    this._container = document.getElementById('auth-container');
    if (!this._container) {
      this._container = document.createElement('div');
      this._container.id = 'auth-container';
      this._container.className = 'auth-container';
      const headerRight = document.querySelector('.header-right');
      if (headerRight) headerRight.prepend(this._container);
    }

    // Sign-in button
    this._signInBtn = document.createElement('button');
    this._signInBtn.id = 'auth-sign-in-btn';
    this._signInBtn.className = 'header-icon-btn auth-sign-in-btn';
    this._signInBtn.textContent = 'Sign In';
    this._container.appendChild(this._signInBtn);

    // Logged-in user badge
    this._userBadge = document.createElement('button');
    this._userBadge.className = 'auth-user-badge hidden';
    this._userBadge.innerHTML = '<span class="auth-avatar-placeholder"></span><span class="auth-badge-name"></span>';
    this._container.appendChild(this._userBadge);

    // Dropdown menu
    this._dropdown = document.createElement('div');
    this._dropdown.className = 'auth-dropdown hidden';
    this._dropdown.innerHTML = `
      <button class="auth-dropdown-item" data-action="profile">Profile</button>
      <button class="auth-dropdown-item" data-action="friends">Friends</button>
      <button class="auth-dropdown-item" data-action="logout">Logout</button>
    `;
    this._container.appendChild(this._dropdown);

    // Login modal
    this._modal = document.createElement('div');
    this._modal.className = 'auth-modal hidden';
    this._modal.innerHTML = `
      <div class="auth-modal-backdrop"></div>
      <div class="auth-modal-content">
        <h3>Sign In</h3>
        <div class="auth-error hidden"></div>
        <label>
          <span>Username</span>
          <input type="text" class="auth-input" id="auth-username" autocomplete="username">
        </label>
        <label>
          <span>Password</span>
          <input type="password" class="auth-input" id="auth-password" autocomplete="current-password">
        </label>
        <button class="auth-submit-btn" id="auth-submit">Sign In</button>
        <div class="auth-register-link">
          Don't have an account? <a href="${WP_REGISTER_URL}" target="_blank" rel="noopener">Register</a>
        </div>
      </div>
    `;
    document.body.appendChild(this._modal);
  }

  _bindEvents() {
    // Open login modal
    this._signInBtn.addEventListener('click', () => this._showModal());

    // Submit login
    this._modal.querySelector('#auth-submit').addEventListener('click', () => this._handleLogin());
    this._modal.querySelector('#auth-password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._handleLogin();
    });

    // Close modal on backdrop click
    this._modal.querySelector('.auth-modal-backdrop').addEventListener('click', () => this._hideModal());

    // User badge toggle dropdown
    this._userBadge.addEventListener('click', (e) => {
      e.stopPropagation();
      this._dropdown.classList.toggle('hidden');
    });

    // Dropdown actions
    this._dropdown.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      this._dropdown.classList.add('hidden');
      if (action === 'profile' && this._onProfileClick) this._onProfileClick();
      if (action === 'friends' && this._onFriendsClick) this._onFriendsClick();
      if (action === 'logout') this._auth.logout();
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
      this._dropdown.classList.add('hidden');
    });
  }

  _showModal() {
    this._modal.classList.remove('hidden');
    this._modal.querySelector('.auth-error').classList.add('hidden');
    this._modal.querySelector('#auth-username').value = '';
    this._modal.querySelector('#auth-password').value = '';
    this._modal.querySelector('#auth-username').focus();
  }

  _hideModal() {
    this._modal.classList.add('hidden');
  }

  async _handleLogin() {
    const username = this._modal.querySelector('#auth-username').value.trim();
    const password = this._modal.querySelector('#auth-password').value;
    const errorEl = this._modal.querySelector('.auth-error');
    const submitBtn = this._modal.querySelector('#auth-submit');

    if (!username || !password) {
      errorEl.textContent = 'Username and password are required';
      errorEl.classList.remove('hidden');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';
    errorEl.classList.add('hidden');

    try {
      await this._auth.login(username, password);
      this._hideModal();
    } catch (e) {
      errorEl.textContent = e.message || 'Login failed';
      errorEl.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  }

  _updateUI() {
    if (this._auth.isLoggedIn) {
      this._signInBtn.classList.add('hidden');
      this._userBadge.classList.remove('hidden');
      const nameEl = this._userBadge.querySelector('.auth-badge-name');
      nameEl.textContent = this._auth.user.displayName || this._auth.user.username;
      const avatarEl = this._userBadge.querySelector('.auth-avatar-placeholder');
      if (this._auth.user.avatarUrl) {
        avatarEl.style.backgroundImage = `url(${this._auth.user.avatarUrl})`;
        avatarEl.textContent = '';
      } else {
        avatarEl.style.backgroundImage = '';
        avatarEl.textContent = (this._auth.user.username || '?')[0].toUpperCase();
      }
    } else {
      this._signInBtn.classList.remove('hidden');
      this._userBadge.classList.add('hidden');
      this._dropdown.classList.add('hidden');
    }
  }
}
