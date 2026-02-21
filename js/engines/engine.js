/**
 * Abstract Engine base class.
 * All chess engines must extend this and implement every method.
 *
 * Lifecycle:
 *   1. new SomeEngine()     — constructor, no heavy work
 *   2. await engine.init()  — load WASM/workers, one-time setup
 *   3. engine.requestMove() — called repeatedly during gameplay
 *   4. engine.stop()        — cancel current computation
 *   5. engine.newGame()     — reset between games
 *   6. engine.destroy()     — permanent teardown
 */
class Engine {
  constructor() {
    if (new.target === Engine) {
      throw new Error('Engine is abstract and cannot be instantiated directly');
    }
  }

  /**
   * One-time initialization (load WASM, create Web Worker, UCI handshake).
   * Resolves when the engine is ready to accept requestMove() calls.
   * @returns {Promise<void>}
   */
  async init() {
    throw new Error('init() not implemented');
  }

  /** @returns {boolean} */
  isReady() {
    throw new Error('isReady() not implemented');
  }

  /**
   * Compute the best move for the given position.
   * @param {string} fen
   * @param {number} elo — requested strength
   * @param {Object} [timeInfo]
   * @param {number} [timeInfo.wtime=0]
   * @param {number} [timeInfo.btime=0]
   * @param {number} [timeInfo.increment=0]
   * @returns {Promise<{from: string, to: string, promotion: string|null}|null>}
   */
  async requestMove(fen, elo, timeInfo = {}) {
    throw new Error('requestMove() not implemented');
  }

  /** Cancel in-progress computation. Safe to call when not thinking. */
  stop() {
    throw new Error('stop() not implemented');
  }

  /** Signal a new game (clear transposition tables, history, etc). */
  newGame() {
    throw new Error('newGame() not implemented');
  }

  /** Permanently terminate the engine. Cannot be reused after this. */
  destroy() {
    // Default no-op; engines override if they hold resources.
  }

  /** @returns {boolean} */
  isThinking() {
    throw new Error('isThinking() not implemented');
  }

  /** @returns {string} e.g. "Stockfish 17.1" */
  getEngineName() {
    throw new Error('getEngineName() not implemented');
  }

  /**
   * Engine's unique ID for persistence and registry lookup.
   * @returns {string}
   */
  static get engineId() {
    throw new Error('engineId not implemented');
  }

  /**
   * ELO capabilities for the UI slider.
   * @returns {{ min: number, max: number, step: number, default: number }}
   */
  static getEloRange() {
    throw new Error('getEloRange() not implemented');
  }
}

export { Engine };
