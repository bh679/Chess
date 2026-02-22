/**
 * NewGameMenu — multi-step wizard for starting a new game.
 *
 * Step 1: Choose opponent (bot, shared device, online, friend)
 * Step 2: Pick time control
 * Step 3: Game settings (variant, eval bar, bot config)
 *
 * Follows the same pattern as MultiplayerUI.
 */
import { getAllEngines, getEngineInfo } from './engines/registry.js';

export class NewGameMenu {
  constructor() {
    this._step = 'opponent'; // 'opponent' | 'time' | 'settings'
    this._mode = null;       // 'bot' | 'local' | 'online' | 'friend'
    this._timeControl = '0'; // pipe-delimited string, '0' for no timer, 'custom'
    this._onStart = null;    // (config) => void
    this._onOnline = null;   // () => void
    this._onFriend = null;   // () => void
    this._onCustomTime = null; // () => void
    this._pendingCustomTime = false;

    this._initElements();
    this._populateEngines();
    this._bindEvents();
    this._loadDefaults();
  }

  // --- Public API ---

  onStart(cb) { this._onStart = cb; }
  onOnline(cb) { this._onOnline = cb; }
  onFriend(cb) { this._onFriend = cb; }
  onCustomTime(cb) { this._onCustomTime = cb; }

  open() {
    this._showStep('opponent');
    this.modal.classList.remove('hidden');
    this.backdrop.classList.remove('hidden');
  }

  close() {
    this.modal.classList.add('hidden');
    this.backdrop.classList.add('hidden');
  }

  isOpen() {
    return !this.modal.classList.contains('hidden');
  }

  /** Resume at settings step after custom time modal completes */
  resumeAtSettings(customTcValue) {
    this._timeControl = customTcValue;
    this._pendingCustomTime = false;
    this._showStep('settings');
    this.modal.classList.remove('hidden');
    this.backdrop.classList.remove('hidden');
  }

  /** Check and clear the pending custom time flag */
  hasPendingCustomTime() {
    return this._pendingCustomTime;
  }

  // --- Private ---

  _initElements() {
    this.modal = document.getElementById('ng-modal');
    this.backdrop = document.getElementById('ng-backdrop');
    this.backBtn = document.getElementById('ng-back');
    this.closeBtn = document.getElementById('ng-close');
    this.titleEl = document.getElementById('ng-title');

    this.stepOpponent = document.getElementById('ng-step-opponent');
    this.stepTime = document.getElementById('ng-step-time');
    this.stepSettings = document.getElementById('ng-step-settings');

    this.opponentBtns = this.stepOpponent.querySelectorAll('.ng-opponent-btn');
    this.tcBtns = this.stepTime.querySelectorAll('.ng-tc-btn');

    this.chess960Checkbox = document.getElementById('ng-chess960');
    this.evalBarCheckbox = document.getElementById('ng-eval-bar');
    this.botSettings = document.getElementById('ng-bot-settings');
    this.engineSelect = document.getElementById('ng-engine-select');
    this.eloSlider = document.getElementById('ng-elo-slider');
    this.eloValue = document.getElementById('ng-elo-value');
    this.eloWrapper = document.getElementById('ng-elo-wrapper');
    this.colorBtns = this.stepSettings.querySelectorAll('.ng-color-btn');
    this.startBtn = document.getElementById('ng-start');
  }

  _populateEngines() {
    const engines = getAllEngines();
    this.engineSelect.innerHTML = '';
    for (const eng of engines) {
      const opt = document.createElement('option');
      opt.value = eng.id;
      opt.textContent = `${eng.icon} ${eng.name}`;
      this.engineSelect.appendChild(opt);
    }
  }

  _bindEvents() {
    // Close
    this.backdrop.addEventListener('click', () => this.close());
    this.closeBtn.addEventListener('click', () => this.close());

    // Back
    this.backBtn.addEventListener('click', () => this._goBack());

    // Opponent selection
    this.opponentBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this._mode = btn.dataset.mode;

        if (this._mode === 'online') {
          this.close();
          if (this._onOnline) this._onOnline();
          return;
        }
        if (this._mode === 'friend') {
          this.close();
          if (this._onFriend) this._onFriend();
          return;
        }

        this._showStep('time');
      });
    });

    // Time control selection
    this.tcBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tc = btn.dataset.tc;

        if (tc === 'custom') {
          this._pendingCustomTime = true;
          this.close();
          if (this._onCustomTime) this._onCustomTime();
          return;
        }

        // Deselect all, select this one
        this.tcBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this._timeControl = tc;

        this._showStep('settings');
      });
    });

    // Color picker
    this.colorBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.colorBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });

    // Engine change -> update ELO range
    this.engineSelect.addEventListener('change', () => {
      this._updateEloRange();
    });

    // ELO slider display
    this.eloSlider.addEventListener('input', () => {
      this.eloValue.textContent = this.eloSlider.value;
    });

    // Start game
    this.startBtn.addEventListener('click', () => {
      this._startGame();
    });
  }

  _loadDefaults() {
    // Sync with existing settings panel defaults
    const chess960Pref = document.getElementById('chess960-toggle');
    if (chess960Pref) this.chess960Checkbox.checked = chess960Pref.checked;

    const evalBarPref = localStorage.getItem('chess-eval-bar');
    this.evalBarCheckbox.checked = evalBarPref === 'true';

    this._updateEloRange();
  }

  _updateEloRange() {
    const info = getEngineInfo(this.engineSelect.value);
    if (!info) return;
    const range = info.eloRange;
    this.eloSlider.min = range.min;
    this.eloSlider.max = range.max;
    this.eloSlider.step = range.step;

    let val = parseInt(this.eloSlider.value, 10);
    if (val < range.min) val = range.min;
    if (val > range.max) val = range.max;
    this.eloSlider.value = val;
    this.eloValue.textContent = val;

    // Hide slider if fixed ELO (e.g., random mover)
    this.eloWrapper.classList.toggle('hidden', range.min === range.max);
  }

  _showStep(step) {
    this._step = step;

    this.stepOpponent.classList.toggle('hidden', step !== 'opponent');
    this.stepTime.classList.toggle('hidden', step !== 'time');
    this.stepSettings.classList.toggle('hidden', step !== 'settings');

    this.backBtn.classList.toggle('hidden', step === 'opponent');

    const titles = {
      opponent: 'New Game',
      time: 'Time Control',
      settings: 'Game Settings',
    };
    this.titleEl.textContent = titles[step];

    if (step === 'settings') {
      this.botSettings.classList.toggle('hidden', this._mode !== 'bot');
    }
  }

  _goBack() {
    if (this._step === 'time') {
      this._showStep('opponent');
    } else if (this._step === 'settings') {
      this._showStep('time');
    }
  }

  _startGame() {
    // Resolve color selection
    let selectedColor = 'white';
    const selectedBtn = this.stepSettings.querySelector('.ng-color-btn.selected');
    if (selectedBtn) {
      selectedColor = selectedBtn.dataset.color;
    }

    // Handle random color
    if (selectedColor === 'random') {
      selectedColor = Math.random() < 0.5 ? 'white' : 'black';
    }

    const config = {
      mode: this._mode,
      chess960: this.chess960Checkbox.checked,
      evalBar: this.evalBarCheckbox.checked,
      timeControl: this._timeControl,
      // Bot-specific: bot plays the opposite side of the user
      botSide: this._mode === 'bot' ? (selectedColor === 'white' ? 'black' : 'white') : null,
      engineId: this._mode === 'bot' ? this.engineSelect.value : null,
      elo: this._mode === 'bot' ? parseInt(this.eloSlider.value, 10) : null,
    };

    this.close();
    if (this._onStart) this._onStart(config);
  }
}
