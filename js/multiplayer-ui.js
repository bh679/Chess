/**
 * MultiplayerUI — manages the multiplayer modal, in-game controls,
 * and connection status. Works with MultiplayerClient and app.js.
 */
export class MultiplayerUI {
  constructor(mp) {
    this.mp = mp; // MultiplayerClient instance
    this._onStartGame = null; // callback from app.js
    this._currentView = 'menu'; // 'menu' | 'waiting' | 'searching' | 'ingame'

    this._initElements();
    this._bindEvents();
  }

  /** Set callback for when a multiplayer game starts */
  onStartGame(cb) {
    this._onStartGame = cb;
  }

  /** Open the multiplayer modal (main menu) */
  open() {
    this._showView('menu');
    this.modal.classList.remove('hidden');
    this.backdrop.classList.remove('hidden');
  }

  /** Close the modal */
  close() {
    this.modal.classList.add('hidden');
    this.backdrop.classList.add('hidden');
    // If searching, cancel
    if (this._currentView === 'searching') {
      this.mp.cancelQueue();
    }
  }

  /** Show the in-game multiplayer controls */
  showGameControls() {
    this.gameControls.classList.remove('hidden');
    this.drawOfferToast.classList.add('hidden');
    this.rematchControls.classList.add('hidden');
  }

  /** Hide in-game controls */
  hideGameControls() {
    this.gameControls.classList.add('hidden');
    this.drawOfferToast.classList.add('hidden');
    this.rematchControls.classList.add('hidden');
  }

  /** Show draw offer toast */
  showDrawOffer() {
    this.drawOfferToast.classList.remove('hidden');
  }

  /** Hide draw offer toast */
  hideDrawOffer() {
    this.drawOfferToast.classList.add('hidden');
  }

  /** Show rematch controls after game ends */
  showRematchControls() {
    this.rematchControls.classList.remove('hidden');
    this.rematchStatus.textContent = '';
    this.rematchOfferBtn.classList.remove('hidden');
  }

  /** Show rematch offer received */
  showRematchOffer() {
    this.rematchControls.classList.remove('hidden');
    this.rematchStatus.textContent = 'Opponent wants a rematch!';
    this.rematchOfferBtn.textContent = 'Accept';
    this.rematchOfferBtn.classList.remove('hidden');
  }

  /** Update connection status indicator */
  setConnectionStatus(status) {
    this.connectionStatus.className = 'mp-connection-status ' + status;
    const labels = {
      connected: 'Connected',
      reconnecting: 'Reconnecting...',
      disconnected: 'Disconnected',
      'opponent-disconnected': 'Opponent disconnected',
    };
    this.connectionStatus.textContent = labels[status] || status;
  }

  /** Show waiting screen with room code */
  showWaiting(roomId) {
    this._showView('waiting');
    this.roomCodeDisplay.textContent = roomId;
    // Build the share URL
    const shareUrl = `${location.origin}${location.pathname}?room=${roomId}`;
    this.shareUrlDisplay.textContent = shareUrl;
  }

  /** Show searching screen */
  showSearching() {
    this._showView('searching');
  }

  // --- Private ---

  _initElements() {
    // Modal and backdrop
    this.modal = document.getElementById('mp-modal');
    this.backdrop = document.getElementById('mp-backdrop');

    // Menu view
    this.menuView = document.getElementById('mp-menu');
    this.quickMatchBtn = document.getElementById('mp-quick-match-btn');
    this.createRoomBtn = document.getElementById('mp-create-room-btn');
    this.joinRoomBtn = document.getElementById('mp-join-room-btn');
    this.joinCodeInput = document.getElementById('mp-join-code');
    this.mpTimeControl = document.getElementById('mp-time-control');
    this.mpPlayerName = document.getElementById('mp-player-name');

    // Waiting view (room created, waiting for opponent)
    this.waitingView = document.getElementById('mp-waiting');
    this.roomCodeDisplay = document.getElementById('mp-room-code');
    this.shareUrlDisplay = document.getElementById('mp-share-url');
    this.cancelWaitBtn = document.getElementById('mp-cancel-wait');
    this.copyCodeBtn = document.getElementById('mp-copy-code');

    // Searching view (in queue)
    this.searchingView = document.getElementById('mp-searching');
    this.cancelSearchBtn = document.getElementById('mp-cancel-search');

    // In-game controls
    this.gameControls = document.getElementById('mp-game-controls');
    this.resignBtn = document.getElementById('mp-resign-btn');
    this.drawOfferBtn = document.getElementById('mp-draw-offer-btn');

    // Draw offer toast
    this.drawOfferToast = document.getElementById('mp-draw-toast');
    this.drawAcceptBtn = document.getElementById('mp-draw-accept');
    this.drawDeclineBtn = document.getElementById('mp-draw-decline');

    // Rematch controls
    this.rematchControls = document.getElementById('mp-rematch-controls');
    this.rematchOfferBtn = document.getElementById('mp-rematch-offer-btn');
    this.rematchStatus = document.getElementById('mp-rematch-status');

    // Connection status
    this.connectionStatus = document.getElementById('mp-connection-status');
  }

  _bindEvents() {
    // Close modal
    this.backdrop.addEventListener('click', () => this.close());

    // Quick Match
    this.quickMatchBtn.addEventListener('click', () => {
      const tc = this.mpTimeControl.value;
      const name = this.mpPlayerName.value.trim() || null;
      this.mp.quickMatch(tc, name);
      this.showSearching();
    });

    // Create Room
    this.createRoomBtn.addEventListener('click', () => {
      const tc = this.mpTimeControl.value;
      const name = this.mpPlayerName.value.trim() || null;
      this.mp.createRoom(tc, name);
    });

    // Join Room
    this.joinRoomBtn.addEventListener('click', () => {
      const code = this.joinCodeInput.value.trim().toUpperCase();
      if (!code || code.length < 4) return;
      const name = this.mpPlayerName.value.trim() || null;
      this.mp.joinRoom(code, name);
    });

    // Join on Enter key
    this.joinCodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.joinRoomBtn.click();
    });

    // Cancel waiting
    this.cancelWaitBtn.addEventListener('click', () => {
      this.mp.disconnect();
      this.close();
    });

    // Copy room code
    this.copyCodeBtn.addEventListener('click', () => {
      const shareUrl = this.shareUrlDisplay.textContent;
      navigator.clipboard.writeText(shareUrl).then(() => {
        this.copyCodeBtn.textContent = 'Copied!';
        setTimeout(() => { this.copyCodeBtn.textContent = 'Copy Link'; }, 2000);
      });
    });

    // Cancel search
    this.cancelSearchBtn.addEventListener('click', () => {
      this.mp.cancelQueue();
      this._showView('menu');
    });

    // Resign
    this.resignBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to resign?')) {
        this.mp.resign();
      }
    });

    // Offer draw
    this.drawOfferBtn.addEventListener('click', () => {
      this.mp.offerDraw();
      this.drawOfferBtn.textContent = 'Draw Offered';
      this.drawOfferBtn.disabled = true;
      setTimeout(() => {
        this.drawOfferBtn.textContent = 'Offer Draw';
        this.drawOfferBtn.disabled = false;
      }, 5000);
    });

    // Accept/decline draw
    this.drawAcceptBtn.addEventListener('click', () => {
      this.mp.respondToDraw(true);
      this.hideDrawOffer();
    });
    this.drawDeclineBtn.addEventListener('click', () => {
      this.mp.respondToDraw(false);
      this.hideDrawOffer();
    });

    // Rematch
    this.rematchOfferBtn.addEventListener('click', () => {
      if (this.rematchOfferBtn.textContent === 'Accept') {
        this.mp.respondToRematch(true);
        this.rematchStatus.textContent = 'Starting rematch...';
      } else {
        this.mp.offerRematch();
        this.rematchOfferBtn.classList.add('hidden');
        this.rematchStatus.textContent = 'Rematch offered — waiting for opponent...';
      }
    });
  }

  _showView(view) {
    this._currentView = view;
    this.menuView.classList.toggle('hidden', view !== 'menu');
    this.waitingView.classList.toggle('hidden', view !== 'waiting');
    this.searchingView.classList.toggle('hidden', view !== 'searching');
  }
}
