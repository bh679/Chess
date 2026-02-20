/**
 * Engine Registry — maps engine IDs to metadata and lazy-loaded classes.
 *
 * No WASM is loaded until an engine is actually selected and init() is called.
 * The registry provides metadata synchronously for the UI and dynamically
 * imports engine modules on demand.
 */

const ENGINE_REGISTRY = {
  stockfish: {
    id: 'stockfish',
    name: 'Stockfish 17.1',
    description: 'Strongest engine. Full WASM, UCI protocol.',
    icon: '\uD83D\uDC1F',
    eloRange: { min: 100, max: 3200, step: 50, default: 1500 },
    supportsChess960: true,
    estimatedLoadSize: '7 MB',
    load: () => import('./stockfish-engine.js').then(m => m.StockfishEngine),
  },

  // Leela Chess Zero and Fairy-Stockfish require complex Emscripten
  // integration (multi-threaded WASM, TensorFlow.js). The engine
  // classes exist but the WASM binaries are not yet bundled.
  // Uncomment when the integration is ready:
  //
  // lc0: {
  //   id: 'lc0',
  //   name: 'Leela Chess Zero',
  //   description: 'Neural network engine. Human-like play.',
  //   icon: '\uD83E\uDDE0',
  //   eloRange: { min: 1200, max: 2400, step: 100, default: 1800 },
  //   supportsChess960: false,
  //   estimatedLoadSize: '15 MB',
  //   load: () => import('./lc0-engine.js').then(m => m.Lc0Engine),
  // },
  //
  // 'fairy-stockfish': {
  //   id: 'fairy-stockfish',
  //   name: 'Fairy-Stockfish',
  //   description: 'Variant engine. Supports chess variants.',
  //   icon: '\uD83E\uDDDA',
  //   eloRange: { min: 100, max: 3200, step: 50, default: 1500 },
  //   supportsChess960: true,
  //   estimatedLoadSize: '8 MB',
  //   load: () => import('./fairy-stockfish-engine.js').then(m => m.FairyStockfishEngine),
  // },

  lozza: {
    id: 'lozza',
    name: 'Lozza',
    description: 'Lightweight pure JS engine. Fast to load.',
    icon: '\u26A1',
    eloRange: { min: 500, max: 2200, step: 50, default: 1500 },
    supportsChess960: true,
    estimatedLoadSize: '100 KB',
    load: () => import('./lozza-engine.js').then(m => m.LozzaEngine),
  },

  random: {
    id: 'random',
    name: 'Random Mover',
    description: 'Picks a random legal move. For fun.',
    icon: '\uD83C\uDFB2',
    eloRange: { min: 0, max: 0, step: 1, default: 0 },
    supportsChess960: true,
    estimatedLoadSize: '0 KB',
    load: () => import('./random-engine.js').then(m => m.RandomEngine),
  },
};

/** Ordered list of engine IDs for UI display. */
function getEngineIds() {
  return ['stockfish', 'lozza', 'random'];
}

/** Get metadata for a specific engine. */
function getEngineInfo(engineId) {
  return ENGINE_REGISTRY[engineId] || null;
}

/** Get metadata for all registered engines. */
function getAllEngines() {
  return getEngineIds().map(id => ENGINE_REGISTRY[id]);
}

/**
 * Dynamically load and instantiate an engine by ID.
 * Returns an uninitialized instance — caller must call init().
 */
async function createEngine(engineId) {
  const entry = ENGINE_REGISTRY[engineId];
  if (!entry) {
    throw new Error(`Unknown engine: ${engineId}`);
  }
  const EngineClass = await entry.load();
  return new EngineClass();
}

export { getEngineIds, getEngineInfo, getAllEngines, createEngine, ENGINE_REGISTRY };
