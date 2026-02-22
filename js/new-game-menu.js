/**
 * NewGameMenu — multi-step wizard for starting a new game.
 *
 * Step 1: Choose opponent (bot, shared device, online, friend)
 * Step Online: Name + time control + Find Opponent (auto matchmaking)
 * Step Friend: Name + time control + Create Room / Join Room
 * Step 2: Pick time control (collapsible categories)
 * Step 3: Game settings (variant, eval bar, bot config)
 *
 * Follows the same pattern as MultiplayerUI.
 */
import { getAllEngines, getEngineInfo } from './engines/registry.js';

export class NewGameMenu {
  constructor() {
    this._step = 'opponent'; // 'opponent' | 'online' | 'friend' | 'time' | 'settings'
    this._mode = null;       // 'bot' | 'local' | 'online' | 'friend'
    this._timeControl = '0'; // pipe-delimited string, '0' for no timer, 'custom'
    this._selectedCat = 'bullet'; // currently selected time category
    this._onStart = null;    // (config) => void
    this._onOnline = null;   // (tc, name) => void  — auto matchmaking
    this._onFriend = null;   // (action, tc, name, code?) => void  — create or join
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

    // Step views
    this.stepOpponent = document.getElementById('ng-step-opponent');
    this.stepOnline = document.getElementById('ng-step-online');
    this.stepFriend = document.getElementById('ng-step-friend');
    this.stepTime = document.getElementById('ng-step-time');
    this.stepSettings = document.getElementById('ng-step-settings');

    this.opponentBtns = this.stepOpponent.querySelectorAll('.ng-opponent-btn');

    // Online step elements
    this.onlineNameInput = document.getElementById('ng-online-name');
    this.onlineTcSelect = document.getElementById('ng-online-tc');
    this.findOpponentBtn = document.getElementById('ng-find-opponent');

    // Friend step elements
    this.friendNameInput = document.getElementById('ng-friend-name');
    this.friendTcSelect = document.getElementById('ng-friend-tc');
    this.createRoomBtn = document.getElementById('ng-create-room');
    this.joinCodeInput = document.getElementById('ng-join-code');
    this.joinRoomBtn = document.getElementById('ng-join-room');

    // Time control elements
    this.tcCatBtns = this.stepTime.querySelectorAll('.ng-tc-cat');
    this.tcOptionGroups = this.stepTime.querySelectorAll('.ng-tc-option-group');
    this.tcBtns = this.stepTime.querySelectorAll('.ng-tc-btn');
    this.tcNextBtn = document.getElementById('ng-tc-next');

    // Settings elements
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
          this._showStep('online');
          return;
        }
        if (this._mode === 'friend') {
          this._showStep('friend');
          return;
        }

        this._showStep('time');
      });
    });

    // --- Online step: Find Opponent ---
    this.findOpponentBtn.addEventListener('click', () => {
      const tc = this.onlineTcSelect.value;
      const name = this.onlineNameInput.value.trim() || null;
      this.close();
      if (this._onOnline) this._onOnline(tc, name);
    });

    // --- Friend step: Create Room / Join Room ---
    this.createRoomBtn.addEventListener('click', () => {
      const tc = this.friendTcSelect.value;
      const name = this.friendNameInput.value.trim() || null;
      this.close();
      if (this._onFriend) this._onFriend('create', tc, name);
    });

    this.joinRoomBtn.addEventListener('click', () => {
      const code = this.joinCodeInput.value.trim().toUpperCase();
      if (!code || code.length < 4) return;
      const name = this.friendNameInput.value.trim() || null;
      this.close();
      if (this._onFriend) this._onFriend('join', null, name, code);
    });

    this.joinCodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.joinRoomBtn.click();
    });

    // --- Time control: category selection ---
    this.tcCatBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this._selectCategory(btn.dataset.cat);
      });
    });

    // Time control: specific option selection
    this.tcBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tc = btn.dataset.tc;

        if (tc === 'custom') {
          this._pendingCustomTime = true;
          this.close();
          if (this._onCustomTime) this._onCustomTime();
          return;
        }

        if (tc === '0') {
          // No Timer — deselect all categories and options
          this.tcCatBtns.forEach(c => c.classList.remove('selected'));
          this.tcOptionGroups.forEach(g => g.classList.add('hidden'));
          // Deselect all tc-btns, select No Timer
          this.tcBtns.forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          this._timeControl = '0';
          return;
        }

        // Select within the active group
        const group = btn.closest('.ng-tc-option-group');
        if (group) {
          group.querySelectorAll('.ng-tc-btn').forEach(b => b.classList.remove('selected'));
        }
        // Also deselect No Timer
        this.stepTime.querySelector('.ng-tc-none')?.classList.remove('selected');
        btn.classList.add('selected');
        this._timeControl = tc;
      });
    });

    // Next button on time control step
    this.tcNextBtn.addEventListener('click', () => {
      this._showStep('settings');
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

  _selectCategory(cat) {
    this._selectedCat = cat;

    // Highlight the selected category
    this.tcCatBtns.forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.cat === cat);
    });

    // Show/hide option groups
    this.tcOptionGroups.forEach(group => {
      group.classList.toggle('hidden', group.dataset.cat !== cat);
    });

    // Deselect No Timer
    this.stepTime.querySelector('.ng-tc-none')?.classList.remove('selected');

    // Update _timeControl to the first selected option in this category
    const activeGroup = this.stepTime.querySelector(`.ng-tc-option-group[data-cat="${cat}"]`);
    if (activeGroup) {
      const sel = activeGroup.querySelector('.ng-tc-btn.selected');
      if (sel) {
        this._timeControl = sel.dataset.tc;
      }
    }
  }

  _loadDefaults() {
    // Sync with existing settings panel defaults
    const chess960Pref = document.getElementById('chess960-toggle');
    if (chess960Pref) this.chess960Checkbox.checked = chess960Pref.checked;

    const evalBarPref = localStorage.getItem('chess-eval-bar');
    this.evalBarCheckbox.checked = evalBarPref === 'true';

    this._updateEloRange();

    // Default time category: bullet
    this._selectCategory('bullet');
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

    const steps = ['opponent', 'online', 'friend', 'time', 'settings'];
    const stepEls = {
      opponent: this.stepOpponent,
      online: this.stepOnline,
      friend: this.stepFriend,
      time: this.stepTime,
      settings: this.stepSettings,
    };
    for (const [key, el] of Object.entries(stepEls)) {
      el.classList.toggle('hidden', key !== step);
    }

    this.backBtn.classList.toggle('hidden', step === 'opponent');

    const titles = {
      opponent: 'New Game',
      online: 'Play Online',
      friend: 'Play with Friend',
      time: 'Time Control',
      settings: 'Game Settings',
    };
    this.titleEl.textContent = titles[step];

    if (step === 'settings') {
      this.botSettings.classList.toggle('hidden', this._mode !== 'bot');
    }
  }

  _goBack() {
    if (this._step === 'online' || this._step === 'friend') {
      this._showStep('opponent');
    } else if (this._step === 'time') {
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
