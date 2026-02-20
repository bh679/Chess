/**
 * Board Analysis — Core analysis engine for evaluating chess positions.
 *
 * Creates a dedicated Stockfish WASM worker (separate from the game AI)
 * to evaluate each position in a completed game. Classifies moves by
 * centipawn loss, detects critical moments, and computes per-side accuracy.
 *
 * This is a data-only module — no UI rendering. Results are consumed by
 * Analysis Review, Post-Game Summary, and Evaluation Bar.
 */

const CACHE_KEY = 'chess-analysis-cache';
const MAX_CACHE_ENTRIES = 20;
const MATE_CP = 10000;

class AnalysisEngine {
  constructor() {
    this._worker = null;
    this._ready = false;
    this._analyzing = false;
    this._cancelled = false;
    this._resolve = null;
    this._reject = null;
    this._currentInfo = null;
    this._positionResolve = null;
  }

  /**
   * Analyze a completed game position-by-position.
   * @param {Array<{san: string, fen: string, side: string}>} moves
   * @param {string} startingFen
   * @param {Object} [options]
   * @param {number} [options.depth=18]
   * @param {Function} [options.onProgress] — called with {current, total, fen}
   * @param {number|null} [options.serverId=null] — for cache lookup/save
   * @returns {Promise<Object>} Analysis result
   */
  async analyze(moves, startingFen, options = {}) {
    const { depth = 18, onProgress = null, serverId = null } = options;

    // Check cache first
    const cached = this._loadFromCache(serverId);
    if (cached) return cached;

    // Cancel any in-progress analysis
    if (this._analyzing) {
      this.stop();
    }

    // Ensure worker is ready
    await this._ensureWorker();

    this._analyzing = true;
    this._cancelled = false;

    return new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;

      this._runAnalysis(moves, startingFen, depth, onProgress, serverId)
        .then(result => {
          this._analyzing = false;
          this._resolve = null;
          this._reject = null;
          resolve(result);
        })
        .catch(err => {
          this._analyzing = false;
          this._resolve = null;
          this._reject = null;
          reject(err);
        });
    });
  }

  /**
   * Cancel in-progress analysis.
   */
  stop() {
    this._cancelled = true;
    if (this._worker) {
      this._send('stop');
    }
    // Resolve any pending single-position evaluation
    if (this._positionResolve) {
      this._positionResolve(null);
      this._positionResolve = null;
    }
    this._analyzing = false;
    if (this._reject) {
      const reject = this._reject;
      this._resolve = null;
      this._reject = null;
      reject('stopped');
    }
  }

  /**
   * Terminate the worker permanently. Cannot be reused after this.
   */
  destroy() {
    this.stop();
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
      this._ready = false;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Worker lifecycle                                                    */
  /* ------------------------------------------------------------------ */

  /**
   * Lazily create and initialize the Stockfish worker.
   * @returns {Promise<void>}
   */
  _ensureWorker() {
    if (this._worker && this._ready) return Promise.resolve();

    return new Promise((resolve, reject) => {
      try {
        this._worker = new Worker('js/lib/stockfish.js');
      } catch (e) {
        console.warn('Analysis: Failed to create Stockfish worker:', e);
        reject(e);
        return;
      }

      this._worker.onmessage = (e) => {
        const line = typeof e.data === 'string' ? e.data : String(e.data);

        if (line === 'uciok') {
          this._send('isready');
        }

        if (line === 'readyok' && !this._ready) {
          this._ready = true;
          // Re-attach message handler for analysis mode
          this._worker.onmessage = (e2) => this._onMessage(e2);
          resolve();
        }
      };

      this._worker.onerror = (e) => {
        console.error('Analysis: Stockfish worker error:', e);
        if (!this._ready) reject(e);
      };

      this._send('uci');
    });
  }

  /**
   * Handle worker messages during analysis.
   */
  _onMessage(e) {
    const line = typeof e.data === 'string' ? e.data : String(e.data);

    if (line === 'readyok') {
      // readyok during analysis — signal that ucinewgame is done
      if (this._readyResolve) {
        this._readyResolve();
        this._readyResolve = null;
      }
      return;
    }

    if (line.startsWith('info') && line.includes(' score ')) {
      const parsed = this._parseInfoLine(line);
      if (parsed && parsed.depth != null) {
        if (!this._currentInfo || parsed.depth >= this._currentInfo.depth) {
          this._currentInfo = parsed;
        }
      }
      return;
    }

    if (line.startsWith('bestmove')) {
      const bestmove = line.split(' ')[1] || null;
      if (this._positionResolve) {
        const resolve = this._positionResolve;
        this._positionResolve = null;
        resolve({
          info: this._currentInfo,
          bestmove: bestmove === '(none)' ? null : bestmove
        });
        this._currentInfo = null;
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  UCI parsing                                                        */
  /* ------------------------------------------------------------------ */

  /**
   * Parse a Stockfish info line for depth, score, and PV.
   * @param {string} line
   * @returns {Object|null}
   */
  _parseInfoLine(line) {
    const parts = line.split(' ');
    const info = {};

    for (let i = 0; i < parts.length; i++) {
      switch (parts[i]) {
        case 'depth':
          info.depth = parseInt(parts[i + 1], 10);
          break;
        case 'score':
          if (parts[i + 1] === 'cp') {
            info.scoreCp = parseInt(parts[i + 2], 10);
            info.scoreMate = null;
          } else if (parts[i + 1] === 'mate') {
            info.scoreMate = parseInt(parts[i + 2], 10);
            info.scoreCp = null;
          }
          break;
        case 'pv':
          info.pv = parts.slice(i + 1);
          i = parts.length; // exit loop
          break;
      }
    }

    if (info.depth == null) return null;
    if (info.scoreCp == null && info.scoreMate == null) return null;
    return info;
  }

  /**
   * Normalize eval to centipawns from White's perspective.
   * @param {number|null} scoreCp
   * @param {number|null} scoreMate
   * @param {string} sideToMove — 'w' or 'b'
   * @returns {number} centipawns from White's perspective
   */
  _normalizeEval(scoreCp, scoreMate, sideToMove) {
    let cp;
    if (scoreMate != null) {
      cp = scoreMate > 0
        ? MATE_CP - Math.abs(scoreMate)
        : -(MATE_CP - Math.abs(scoreMate));
    } else {
      cp = scoreCp || 0;
    }
    return sideToMove === 'w' ? cp : -cp;
  }

  /* ------------------------------------------------------------------ */
  /*  Position evaluation                                                */
  /* ------------------------------------------------------------------ */

  /**
   * Evaluate a single position at the given depth.
   * @param {string} fen
   * @param {number} depth
   * @returns {Promise<{eval: number, bestMoveUci: string|null, bestLineUci: string[]}>}
   */
  _evaluatePosition(fen, depth) {
    return new Promise((resolve) => {
      this._currentInfo = null;
      this._positionResolve = (result) => {
        if (!result) {
          // Cancelled or error
          resolve({ eval: 0, bestMoveUci: null, bestLineUci: [] });
          return;
        }

        const sideToMove = fen.split(' ')[1] || 'w';
        const info = result.info;

        if (!info) {
          resolve({ eval: 0, bestMoveUci: result.bestmove, bestLineUci: [] });
          return;
        }

        const evalCp = this._normalizeEval(info.scoreCp, info.scoreMate, sideToMove);
        resolve({
          eval: evalCp,
          bestMoveUci: (info.pv && info.pv[0]) || result.bestmove,
          bestLineUci: info.pv || []
        });
      };

      this._send(`position fen ${fen}`);
      this._send(`go depth ${depth}`);
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Main analysis loop                                                 */
  /* ------------------------------------------------------------------ */

  /**
   * Run the full analysis pipeline.
   */
  async _runAnalysis(moves, startingFen, depth, onProgress, serverId) {
    // Send ucinewgame and wait for readyok
    await this._sendAndWaitReady('ucinewgame');

    const fens = [startingFen, ...moves.map(m => m.fen)];
    const total = fens.length;
    const positions = [];

    for (let i = 0; i < total; i++) {
      if (this._cancelled) throw 'stopped';

      const fen = fens[i];
      const result = await this._evaluatePosition(fen, depth);

      if (this._cancelled) throw 'stopped';

      const isStarting = i === 0;
      const move = isStarting ? null : moves[i - 1];

      positions.push({
        ply: i,
        fen,
        eval: result.eval,
        bestMoveUci: result.bestMoveUci,
        bestLineUci: result.bestLineUci,
        played: isStarting ? null : move.san,
        playedSide: isStarting ? null : move.side,
        classification: null,
        cpLoss: 0
      });

      if (onProgress) {
        onProgress({ current: i + 1, total, fen });
      }
    }

    // Classify moves (skip starting position)
    for (let i = 1; i < positions.length; i++) {
      const prev = positions[i - 1];
      const curr = positions[i];
      const side = curr.playedSide;

      let cpLoss;
      if (side === 'w') {
        cpLoss = prev.eval - curr.eval;
      } else {
        cpLoss = curr.eval - prev.eval;
      }
      cpLoss = Math.max(0, cpLoss);

      curr.cpLoss = cpLoss;
      curr.classification = this._classifyMove(cpLoss, prev.eval, curr.eval, side);
    }

    const criticalMoments = this._findCriticalMoments(positions);
    const summary = this._calculateAccuracy(positions);

    const analysisResult = { positions, criticalMoments, summary };

    // Cache the result
    this._saveToCache(serverId, analysisResult);

    return analysisResult;
  }

  /**
   * Send a UCI command and wait for readyok.
   */
  _sendAndWaitReady(cmd) {
    return new Promise((resolve) => {
      this._readyResolve = resolve;
      this._send(cmd);
      this._send('isready');
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Move classification                                                */
  /* ------------------------------------------------------------------ */

  /**
   * Classify a move based on centipawn loss.
   * @param {number} cpLoss
   * @param {number} prevEval — eval before move (White's perspective)
   * @param {number} currEval — eval after move (White's perspective)
   * @param {string} side — 'w' or 'b'
   * @returns {string}
   */
  _classifyMove(cpLoss, prevEval, currEval, side) {
    // Check for missed forced mate
    const prevIsMate = Math.abs(prevEval) >= (MATE_CP - 100);
    const currIsMate = Math.abs(currEval) >= (MATE_CP - 100);

    if (prevIsMate && !currIsMate) {
      const mateForWhite = prevEval > 0;
      const mateForMovingSide = (side === 'w' && mateForWhite) || (side === 'b' && !mateForWhite);
      if (mateForMovingSide) return 'blunder';
    }

    if (cpLoss === 0) return 'best';
    if (cpLoss < 50) return 'good';
    if (cpLoss < 100) return 'inaccuracy';
    if (cpLoss < 300) return 'mistake';
    return 'blunder';
  }

  /* ------------------------------------------------------------------ */
  /*  Post-processing                                                    */
  /* ------------------------------------------------------------------ */

  /**
   * Find critical moments — plies where eval swung >= 200cp.
   */
  _findCriticalMoments(positions) {
    const moments = [];
    for (let i = 1; i < positions.length; i++) {
      const swing = Math.abs(positions[i].eval - positions[i - 1].eval);
      if (swing >= 200) {
        moments.push(i);
      }
    }
    return moments;
  }

  /**
   * Calculate per-side accuracy and classification counts.
   */
  _calculateAccuracy(positions) {
    const stats = {
      white: { totalCpLoss: 0, moveCount: 0, best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
      black: { totalCpLoss: 0, moveCount: 0, best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 }
    };

    for (let i = 1; i < positions.length; i++) {
      const pos = positions[i];
      if (pos.classification == null) continue;

      const side = pos.playedSide === 'w' ? 'white' : 'black';
      stats[side].totalCpLoss += pos.cpLoss;
      stats[side].moveCount++;
      stats[side][pos.classification]++;
    }

    for (const side of ['white', 'black']) {
      const s = stats[side];
      const avgCpLoss = s.moveCount > 0 ? s.totalCpLoss / s.moveCount : 0;
      s.accuracy = Math.round(Math.max(0, 100 - avgCpLoss * 0.5) * 10) / 10;
      delete s.totalCpLoss;
      delete s.moveCount;
    }

    return stats;
  }

  /* ------------------------------------------------------------------ */
  /*  localStorage caching                                               */
  /* ------------------------------------------------------------------ */

  /**
   * Load a cached analysis result by serverId.
   * @param {number|null} serverId
   * @returns {Object|null}
   */
  _loadFromCache(serverId) {
    if (!serverId) return null;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const cache = JSON.parse(raw);
      const entry = cache.entries[serverId];
      if (!entry) return null;
      // Update access time
      entry.accessedAt = Date.now();
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      return entry.result;
    } catch {
      return null;
    }
  }

  /**
   * Save an analysis result to cache with LRU eviction.
   * @param {number|null} serverId
   * @param {Object} result
   */
  _saveToCache(serverId, result) {
    if (!serverId) return;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      const cache = raw ? JSON.parse(raw) : { entries: {} };
      cache.entries[serverId] = { result, accessedAt: Date.now() };

      // LRU eviction: keep max entries
      const keys = Object.keys(cache.entries);
      if (keys.length > MAX_CACHE_ENTRIES) {
        keys.sort((a, b) => cache.entries[a].accessedAt - cache.entries[b].accessedAt);
        const toRemove = keys.slice(0, keys.length - MAX_CACHE_ENTRIES);
        for (const k of toRemove) {
          delete cache.entries[k];
        }
      }

      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
      // localStorage full or unavailable — silently fail
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Utility                                                            */
  /* ------------------------------------------------------------------ */

  _send(cmd) {
    if (this._worker) {
      this._worker.postMessage(cmd);
    }
  }
}

export { AnalysisEngine };
