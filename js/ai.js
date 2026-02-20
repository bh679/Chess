/**
 * AI Module — Abstract engine coordinator with per-side engine selection.
 *
 * Delegates to engine instances loaded via the engine registry.
 * Each side (white/black) can use a different engine. Engines are
 * lazy-loaded — no WASM is fetched until a side is enabled.
 */
import { createEngine, getEngineInfo } from './engines/registry.js';

class AI {
  constructor() {
    this._whiteEnabled = false;
    this._blackEnabled = false;
    this._whiteElo = 1500;
    this._blackElo = 1500;
    this._whiteEngineId = 'stockfish';
    this._blackEngineId = 'stockfish';
    this._whiteEngine = null;
    this._blackEngine = null;
  }

  /**
   * Initialize — no-op. Engines are loaded lazily in configure().
   */
  async init() {
    // Engines are initialized in configure() when a side is enabled.
  }

  /**
   * Configure AI per-side. If engine ID changed or a side is newly enabled,
   * lazy-load and init the engine.
   */
  async configure({ whiteEnabled, whiteElo, whiteEngineId = 'stockfish',
                     blackEnabled, blackElo, blackEngineId = 'stockfish' }) {
    this._whiteEnabled = whiteEnabled;
    this._blackEnabled = blackEnabled;
    this._whiteElo = whiteElo;
    this._blackElo = blackElo;

    await Promise.all([
      this._ensureEngine('w', whiteEngineId, whiteEnabled),
      this._ensureEngine('b', blackEngineId, blackEnabled),
    ]);
  }

  async _ensureEngine(side, newEngineId, enabled) {
    const isWhite = side === 'w';
    const currentId = isWhite ? this._whiteEngineId : this._blackEngineId;
    const currentEngine = isWhite ? this._whiteEngine : this._blackEngine;

    if (isWhite) this._whiteEngineId = newEngineId;
    else this._blackEngineId = newEngineId;

    if (!enabled) return;

    // Already loaded and ready with same engine
    if (currentEngine && currentId === newEngineId && currentEngine.isReady()) {
      return;
    }

    // Destroy old engine if switching
    if (currentEngine && currentId !== newEngineId) {
      currentEngine.destroy();
    }

    try {
      const engine = await createEngine(newEngineId);
      await engine.init();
      if (isWhite) this._whiteEngine = engine;
      else this._blackEngine = engine;
    } catch (e) {
      console.warn(`AI: Failed to load engine '${newEngineId}':`, e);
      if (isWhite) this._whiteEngine = null;
      else this._blackEngine = null;
    }
  }

  /**
   * Check if AI is enabled for at least one side with a ready engine.
   */
  isEnabled() {
    return (this._whiteEnabled && this._whiteEngine?.isReady()) ||
           (this._blackEnabled && this._blackEngine?.isReady());
  }

  /**
   * Check if it's AI's turn.
   */
  isAITurn(currentTurn) {
    if (currentTurn === 'w') return this._whiteEnabled;
    if (currentTurn === 'b') return this._blackEnabled;
    return false;
  }

  /**
   * Get the ELO for a given side.
   */
  getElo(turn) {
    return turn === 'w' ? this._whiteElo : this._blackElo;
  }

  /**
   * Get the engine ID for a given side.
   */
  getEngineId(turn) {
    return turn === 'w' ? this._whiteEngineId : this._blackEngineId;
  }

  /**
   * Get the engine name. With a turn argument, returns per-side name.
   * Without, returns the first active engine name (backward compat).
   */
  getEngineName(turn) {
    if (turn !== undefined) {
      const engine = turn === 'w' ? this._whiteEngine : this._blackEngine;
      return engine ? engine.getEngineName() : 'AI';
    }
    // Backward compatibility: return first active engine name
    if (this._whiteEnabled && this._whiteEngine) return this._whiteEngine.getEngineName();
    if (this._blackEnabled && this._blackEngine) return this._blackEngine.getEngineName();
    return 'AI';
  }

  /**
   * Check if any engine is currently computing.
   */
  isThinking() {
    return (this._whiteEngine?.isThinking() || false) ||
           (this._blackEngine?.isThinking() || false);
  }

  /**
   * Request the AI to compute the best move.
   * Determines the correct engine from the FEN's side to move.
   */
  requestMove(fen, elo, wtime = 0, btime = 0, increment = 0) {
    const sideToMove = fen.split(' ')[1] || 'w';
    const engine = sideToMove === 'w' ? this._whiteEngine : this._blackEngine;

    if (!engine || !engine.isReady()) return Promise.resolve(null);

    return engine.requestMove(fen, elo, { wtime, btime, increment });
  }

  /**
   * Stop all engines.
   */
  stop() {
    if (this._whiteEngine) this._whiteEngine.stop();
    if (this._blackEngine) this._blackEngine.stop();
  }

  /**
   * Signal new game to all engines.
   */
  newGame() {
    if (this._whiteEngine) this._whiteEngine.newGame();
    if (this._blackEngine) this._blackEngine.newGame();
  }
}

export { AI };
