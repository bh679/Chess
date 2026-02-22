/**
 * MultiplayerClient — WebSocket client for live multiplayer chess.
 * Manages connection, room lifecycle, move sync, and reconnection.
 */
export class MultiplayerClient {
  constructor() {
    this.ws = null;
    this.sessionId = this._getOrCreateSessionId();
    this.roomId = null;
    this.color = null; // 'w' or 'b'
    this.active = false;
    this._reconnectAttempts = 0;
    this._maxReconnectAttempts = 3;
    this._reconnectTimer = null;
    this._serverUrl = null;

    // Event callbacks (set by app.js)
    this.onGameStart = null;
    this.onOpponentMove = null;
    this.onMoveAck = null;
    this.onClockSync = null;
    this.onDrawOffered = null;
    this.onDrawDeclined = null;
    this.onGameEnd = null;
    this.onRematchOffered = null;
    this.onRematchDeclined = null;
    this.onRematchStart = null;
    this.onOpponentDisconnected = null;
    this.onOpponentReconnected = null;
    this.onReconnect = null;
    this.onQueueJoined = null;
    this.onQueueLeft = null;
    this.onRoomCreated = null;
    this.onConnected = null;
    this.onDisconnected = null;
    this.onError = null;
  }

  /** Connect to the WebSocket server */
  connect(serverUrl) {
    return new Promise((resolve, reject) => {
      this._serverUrl = serverUrl || this._buildWsUrl();
      this.ws = new WebSocket(this._serverUrl);

      this.ws.onopen = () => {
        this._reconnectAttempts = 0;
        // Authenticate with session ID
        this._send('auth', { sessionId: this.sessionId });
      };

      this.ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch (e) {
          return;
        }
        this._handleMessage(msg, resolve);
      };

      this.ws.onclose = () => {
        if (this.active) {
          this._attemptReconnect();
        }
        if (this.onDisconnected) this.onDisconnected();
      };

      this.ws.onerror = (err) => {
        if (this.onError) this.onError('Connection error');
        reject(err);
      };
    });
  }

  /** Create a new room */
  createRoom(timeControl, name) {
    this._send('create_room', { timeControl, name });
  }

  /** Join an existing room by code */
  joinRoom(roomId, name) {
    this._send('join_room', { roomId: roomId.toUpperCase(), name });
  }

  /** Join the quick match queue */
  quickMatch(timeControl, name) {
    this._send('quick_match', { timeControl, name });
  }

  /** Cancel queue search */
  cancelQueue() {
    this._send('cancel_queue', {});
  }

  /** Send a move to the server */
  sendMove(san) {
    this._send('move', { san });
  }

  /** Resign the current game */
  resign() {
    this._send('resign', {});
  }

  /** Offer a draw */
  offerDraw() {
    this._send('draw_offer', {});
  }

  /** Respond to a draw offer */
  respondToDraw(accept) {
    this._send('draw_respond', { accept });
  }

  /** Offer a rematch */
  offerRematch() {
    this._send('rematch_offer', {});
  }

  /** Respond to a rematch offer */
  respondToRematch(accept) {
    this._send('rematch_respond', { accept });
  }

  /** Disconnect from the server */
  disconnect() {
    this.active = false;
    this.roomId = null;
    this.color = null;
    clearTimeout(this._reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /** Whether we're in an active multiplayer game */
  isActive() {
    return this.active;
  }

  /** Whether it's our turn */
  isMyTurn(gameTurn) {
    return this.color === gameTurn;
  }

  // --- Private methods ---

  _buildWsUrl() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}`;
  }

  _send(type, payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  _handleMessage(msg, connectResolve) {
    const { type, payload } = msg;

    switch (type) {
      case 'auth_ok':
        if (this.onConnected) this.onConnected();
        if (connectResolve) connectResolve();
        break;

      case 'room_created':
        this.roomId = payload.roomId;
        this.color = payload.color;
        if (this.onRoomCreated) this.onRoomCreated(payload);
        break;

      case 'queue_joined':
        if (this.onQueueJoined) this.onQueueJoined(payload);
        break;

      case 'queue_left':
        if (this.onQueueLeft) this.onQueueLeft();
        break;

      case 'game_start':
        this.roomId = payload.roomId;
        this.color = payload.color;
        this.active = true;
        if (this.onGameStart) this.onGameStart(payload);
        break;

      case 'move':
        if (this.onOpponentMove) this.onOpponentMove(payload);
        break;

      case 'move_ack':
        if (this.onMoveAck) this.onMoveAck(payload);
        break;

      case 'clock_sync':
        if (this.onClockSync) this.onClockSync(payload);
        break;

      case 'draw_offered':
        if (this.onDrawOffered) this.onDrawOffered();
        break;

      case 'draw_declined':
        if (this.onDrawDeclined) this.onDrawDeclined();
        break;

      case 'game_end':
        this.active = false;
        if (this.onGameEnd) this.onGameEnd(payload);
        break;

      case 'rematch_offered':
        if (this.onRematchOffered) this.onRematchOffered();
        break;

      case 'rematch_declined':
        if (this.onRematchDeclined) this.onRematchDeclined();
        break;

      case 'rematch_start':
        this.roomId = payload.roomId;
        this.color = payload.color;
        this.active = true;
        if (this.onRematchStart) this.onRematchStart(payload);
        break;

      case 'opponent_disconnected':
        if (this.onOpponentDisconnected) this.onOpponentDisconnected(payload);
        break;

      case 'opponent_reconnected':
        if (this.onOpponentReconnected) this.onOpponentReconnected();
        break;

      case 'reconnect':
        this.roomId = payload.roomId;
        this.color = payload.color;
        this.active = true;
        if (this.onReconnect) this.onReconnect(payload);
        break;

      case 'error':
        if (this.onError) this.onError(payload.message);
        break;
    }
  }

  _attemptReconnect() {
    if (this._reconnectAttempts >= this._maxReconnectAttempts) {
      this.active = false;
      if (this.onError) this.onError('Disconnected — could not reconnect');
      return;
    }

    this._reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts - 1), 8000);

    this._reconnectTimer = setTimeout(() => {
      this.connect(this._serverUrl).catch(() => {
        this._attemptReconnect();
      });
    }, delay);
  }

  _getOrCreateSessionId() {
    let id = sessionStorage.getItem('chess-mp-session-id');
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem('chess-mp-session-id', id);
    }
    return id;
  }
}
