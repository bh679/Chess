class Timer {
  constructor(whiteEl, blackEl) {
    this.whiteEl = whiteEl;
    this.blackEl = blackEl;
    this._interval = null;
    this._running = false;
    this._activeSide = null;
    this._time = { w: 0, b: 0 }; // remaining time in ms
    this._increment = 0; // increment in ms
    this._lastTick = null;
    this._onTimeout = null;
    this._enabled = false;
  }

  configure(whiteSeconds, increment, blackSeconds) {
    this.stop();
    if (blackSeconds === undefined) blackSeconds = whiteSeconds;
    if (whiteSeconds <= 0 && blackSeconds <= 0) {
      this._enabled = false;
      this.whiteEl.textContent = '--:--';
      this.blackEl.textContent = '--:--';
      this.whiteEl.classList.remove('timer-low', 'timer-active');
      this.blackEl.classList.remove('timer-low', 'timer-active');
      return;
    }
    this._enabled = true;
    this._time.w = whiteSeconds * 1000;
    this._time.b = blackSeconds * 1000;
    this._increment = increment * 1000;
    this._activeSide = null;
    this._render();
  }

  isEnabled() {
    return this._enabled;
  }

  start(side) {
    if (!this._enabled) return;
    this._activeSide = side;
    this._lastTick = performance.now();
    this._running = true;
    this._updateActiveClasses();

    if (this._interval) clearInterval(this._interval);
    this._interval = setInterval(() => this._tick(), 100);
  }

  switchTo(side) {
    if (!this._enabled || !this._running) return;

    // Add increment to the side that just moved (opposite of new active)
    const movedSide = side === 'w' ? 'b' : 'w';
    this._time[movedSide] += this._increment;

    this._activeSide = side;
    this._lastTick = performance.now();
    this._updateActiveClasses();
    this._render();
  }

  stop() {
    this._running = false;
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
    this.whiteEl.classList.remove('timer-active');
    this.blackEl.classList.remove('timer-active');
  }

  onTimeout(callback) {
    this._onTimeout = callback;
  }

  _tick() {
    if (!this._running || !this._activeSide) return;

    const now = performance.now();
    const elapsed = now - this._lastTick;
    this._lastTick = now;

    this._time[this._activeSide] -= elapsed;

    if (this._time[this._activeSide] <= 0) {
      this._time[this._activeSide] = 0;
      this.stop();
      this._render();
      if (this._onTimeout) {
        const loser = this._activeSide === 'w' ? 'White' : 'Black';
        this._onTimeout(loser);
      }
      return;
    }

    this._render();
  }

  _render() {
    this.whiteEl.textContent = this._formatTime(this._time.w);
    this.blackEl.textContent = this._formatTime(this._time.b);

    // Low time warning (under 30 seconds)
    this.whiteEl.classList.toggle('timer-low', this._time.w > 0 && this._time.w < 30000);
    this.blackEl.classList.toggle('timer-low', this._time.b > 0 && this._time.b < 30000);
  }

  _updateActiveClasses() {
    this.whiteEl.classList.toggle('timer-active', this._activeSide === 'w');
    this.blackEl.classList.toggle('timer-active', this._activeSide === 'b');
  }

  _formatTime(ms) {
    if (ms <= 0) return '0:00';
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

export { Timer };
