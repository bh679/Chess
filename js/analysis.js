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
const CACHE_VERSION = 3;  // Bump when classification format changes
const MAX_CACHE_ENTRIES = 20;
const MATE_CP = 10000;

// Material values for sacrifice detection
const MATERIAL_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

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
   * Quick evaluation of a single position at low depth.
   * Returns centipawns from white's perspective, or null if busy.
   * @param {string} fen
   * @param {number} [depth=12]
   * @returns {Promise<number|null>}
   */
  async quickEval(fen, depth = 12) {
    await this._ensureWorker();
    if (this._analyzing) return null;
    const result = await this._evaluatePosition(fen, depth);
    return result.eval;
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

      let posEval = result.eval;

      // Fix terminal positions: when the engine returns no bestmove and no
      // info (eval defaults to 0), the position is checkmate or stalemate.
      // Assign the correct eval so cpLoss calculations aren't distorted.
      if (!isStarting && result.bestMoveUci == null && result.eval === 0) {
        const isLast = i === total - 1;
        if (isLast) {
          // Terminal position — side to move has no legal moves.
          // If it's checkmate, the side to move lost.
          const sideToMove = fen.split(' ')[1] || 'w';
          // Assume checkmate (not stalemate) — stalemate eval=0 is correct.
          // For checkmate: mated side is losing, so eval is worst for them.
          posEval = sideToMove === 'w' ? -MATE_CP : MATE_CP;
        }
      }

      positions.push({
        ply: i,
        fen,
        eval: posEval,
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

      // Delivering checkmate is always the best move — skip cpLoss calculation
      const isTerminal = i === positions.length - 1 && curr.bestMoveUci == null;
      if (isTerminal && Math.abs(curr.eval) >= MATE_CP) {
        curr.cpLoss = 0;
        curr.classification = 'best';
        continue;
      }

      let cpLoss;
      if (side === 'w') {
        cpLoss = prev.eval - curr.eval;
      } else {
        cpLoss = curr.eval - prev.eval;
      }
      cpLoss = Math.max(0, cpLoss);

      curr.cpLoss = cpLoss;
      curr.classification = this._classifyMove(cpLoss, prev.eval, curr.eval, side, prev.fen, curr.fen, i, positions);
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
   * Convert centipawns to win probability (0-1) from white's perspective.
   */
  _winProbability(cp) {
    if (cp >= MATE_CP - 100) return 1;
    if (cp <= -(MATE_CP - 100)) return 0;
    return 1 / (1 + Math.pow(10, -cp / 400));
  }

  /**
   * Count total material for each side from a FEN string.
   * @returns {{white: number, black: number}}
   */
  _countMaterial(fen) {
    const board = fen.split(' ')[0];
    let white = 0, black = 0;
    for (const ch of board) {
      const lower = ch.toLowerCase();
      if (MATERIAL_VALUES[lower] != null) {
        if (ch === lower) black += MATERIAL_VALUES[lower];
        else white += MATERIAL_VALUES[lower];
      }
    }
    return { white, black };
  }

  /**
   * Classify a move using expected-points model with 10 categories.
   * @param {number} cpLoss
   * @param {number} prevEval — eval before move (White's perspective)
   * @param {number} currEval — eval after move (White's perspective)
   * @param {string} side — 'w' or 'b'
   * @param {string} prevFen — FEN before the move
   * @param {string} currFen — FEN after the move
   * @param {number} posIdx — position index in the analysis
   * @param {Array} positions — all positions for context
   * @returns {string}
   */
  _classifyMove(cpLoss, prevEval, currEval, side, prevFen, currFen, posIdx, positions) {
    // Book detection: first 8 plies with negligible cp loss
    if (posIdx <= 8 && cpLoss < 5) {
      return 'book';
    }

    // Expected points from moving side's perspective
    const prevWP = this._winProbability(prevEval);
    const currWP = this._winProbability(currEval);
    const prevSideWP = side === 'w' ? prevWP : 1 - prevWP;
    const currSideWP = side === 'w' ? currWP : 1 - currWP;
    const epLost = Math.max(0, prevSideWP - currSideWP);

    // Check for missed forced mate
    const prevIsMate = Math.abs(prevEval) >= (MATE_CP - 100);
    const currIsMate = Math.abs(currEval) >= (MATE_CP - 100);
    if (prevIsMate && !currIsMate) {
      const mateForWhite = prevEval > 0;
      const mateForMovingSide = (side === 'w' && mateForWhite) || (side === 'b' && !mateForWhite);
      if (mateForMovingSide) return 'blunder';
    }

    // Miss detection: opponent just blundered but player didn't capitalize
    if (posIdx >= 2 && epLost >= 0.05) {
      const oppPrev = positions[posIdx - 2];
      const oppCurr = positions[posIdx - 1];
      if (oppPrev && oppCurr) {
        const oppPrevWP = this._winProbability(oppPrev.eval);
        const oppCurrWP = this._winProbability(oppCurr.eval);
        const oppSide = side === 'w' ? 'b' : 'w';
        const oppPrevSideWP = oppSide === 'w' ? oppPrevWP : 1 - oppPrevWP;
        const oppCurrSideWP = oppSide === 'w' ? oppCurrWP : 1 - oppCurrWP;
        const oppLost = Math.max(0, oppPrevSideWP - oppCurrSideWP);
        if (oppLost >= 0.08) {
          return 'miss';
        }
      }
    }

    // Negative classifications (by expected points lost)
    if (epLost >= 0.20) return 'blunder';
    if (epLost >= 0.10) return 'mistake';
    if (epLost >= 0.05) return 'inaccuracy';

    // Positive classifications
    if (cpLoss === 0) {
      // Brilliant: sacrifice + best move + not already winning
      if (prevFen && currFen) {
        const matBefore = this._countMaterial(prevFen);
        const matAfter = this._countMaterial(currFen);
        const sideMat = side === 'w' ? 'white' : 'black';
        const matLost = matBefore[sideMat] - matAfter[sideMat];
        const oppMat = side === 'w' ? 'black' : 'white';
        const oppMatLost = matBefore[oppMat] - matAfter[oppMat];
        // Net sacrifice: side lost more material than opponent
        if (matLost > oppMatLost && prevSideWP < 0.90 && currSideWP > 0.20) {
          return 'brilliant';
        }
      }

      // Great: best move that creates a significant eval swing in player's favour
      const evalSwing = side === 'w' ? (currEval - prevEval) : (prevEval - currEval);
      if (evalSwing >= 100) {
        return 'great';
      }

      return 'best';
    }

    // Excellent: very small expected points loss
    if (epLost < 0.02) return 'excellent';

    // Good: small expected points loss
    return 'good';
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
    const template = {
      totalAccuracy: 0, moveCount: 0,
      brilliant: 0, great: 0, best: 0, excellent: 0, good: 0,
      book: 0, inaccuracy: 0, mistake: 0, miss: 0, blunder: 0
    };
    const stats = {
      white: { ...template },
      black: { ...template }
    };

    for (let i = 1; i < positions.length; i++) {
      const pos = positions[i];
      if (pos.classification == null) continue;

      const side = pos.playedSide === 'w' ? 'white' : 'black';
      stats[side].moveCount++;
      if (stats[side][pos.classification] != null) {
        stats[side][pos.classification]++;
      }

      // Win-probability-based per-move accuracy.
      // Compares win probability before and after the move from the
      // moving side's perspective. A perfect move loses 0 expected points;
      // a terrible move can lose up to 1.0 expected points.
      const prev = positions[i - 1];
      const prevWP = this._winProbability(prev.eval);
      const currWP = this._winProbability(pos.eval);
      const prevSideWP = pos.playedSide === 'w' ? prevWP : 1 - prevWP;
      const currSideWP = pos.playedSide === 'w' ? currWP : 1 - currWP;
      const epLost = Math.max(0, prevSideWP - currSideWP);
      // Map expected points lost to a 0-100 accuracy score per move.
      // Scale factor of 2 means losing 0.5 expected points ≈ 0% accuracy.
      const moveAcc = Math.max(0, Math.min(100, 100 * (1 - epLost * 2)));
      stats[side].totalAccuracy += moveAcc;
    }

    for (const side of ['white', 'black']) {
      const s = stats[side];
      s.accuracy = s.moveCount > 0
        ? Math.round(s.totalAccuracy / s.moveCount * 10) / 10
        : 0;
      delete s.totalAccuracy;
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
      // Reject entries from older classification versions
      if (entry.version !== CACHE_VERSION) {
        delete cache.entries[serverId];
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        return null;
      }
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
      cache.entries[serverId] = { result, accessedAt: Date.now(), version: CACHE_VERSION };

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
