/**
 * Router — Minimal hash-based routing for the chess SPA.
 *
 * Canonical URLs use the hash: /#/replay, /#/games?gameid=42
 * Path-based URLs (/replay, /games) redirect to their hash equivalent on load.
 *
 * Hash format: #/<path>?<query>
 *   - path: /replay, /games, /history, /live, or /
 *   - query: standard URL query params (gameid=42)
 */

const KNOWN_ROUTES = ['/', '/replay', '/games', '/history', '/live'];

class Router {
  constructor() {
    this._routes = {};
    this._started = false;
    this._navigating = false; // guard against re-entrant hashchange

    window.addEventListener('hashchange', () => {
      if (!this._navigating) this._handleCurrentHash();
    });
  }

  /**
   * Register a route handler.
   * @param {string} path — e.g. '/', '/replay', '/games'
   * @param {Function} handler — called with { path, params }
   */
  on(path, handler) {
    this._routes[path] = handler;
  }

  /**
   * Navigate to a hash route, updating the URL bar (no page reload).
   * @param {string} path — e.g. '/replay'
   * @param {Object} [queryParams] — e.g. { gameid: '42' }
   * @param {boolean} [silent] — if true, update URL without triggering handler
   */
  navigate(path, queryParams = {}, silent = false) {
    const hash = this._buildHash(path, queryParams);
    this._navigating = true;
    window.location.hash = hash;
    this._navigating = false;
    if (!silent) this._handleCurrentHash();
  }

  /**
   * Silently update the hash without triggering route handlers.
   * Useful for reflecting state changes in the URL.
   */
  silentUpdate(path, queryParams = {}) {
    const hash = this._buildHash(path, queryParams);
    this._navigating = true;
    window.location.hash = hash;
    this._navigating = false;
  }

  /**
   * Read current route info without triggering handlers.
   */
  current() {
    return this._parseHash();
  }

  /**
   * Start the router. Redirects path-based URLs to hash equivalents,
   * then processes the current hash route.
   */
  start() {
    this._started = true;

    // Redirect path-based URLs to hash equivalents
    if (this._redirectPathToHash()) return;

    this._handleCurrentHash();
  }

  // --- Private ---

  _parseHash() {
    let hash = window.location.hash;
    // Strip leading #
    if (hash.startsWith('#')) hash = hash.slice(1);
    // Strip leading / if present (hash is #/path, so after # we have /path)
    // Parse path and query from the hash fragment
    const qIndex = hash.indexOf('?');
    let path, queryString;
    if (qIndex >= 0) {
      path = hash.slice(0, qIndex);
      queryString = hash.slice(qIndex + 1);
    } else {
      path = hash;
      queryString = '';
    }

    // Normalize path
    if (!path || path === '') path = '/';
    if (path !== '/' && path.endsWith('/')) path = path.slice(0, -1);

    const params = new URLSearchParams(queryString);
    return { path, params };
  }

  _buildHash(path, queryParams = {}) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(queryParams)) {
      if (v !== null && v !== undefined && v !== '') qs.set(k, String(v));
    }
    const qsStr = qs.toString();
    return qsStr ? `#${path}?${qsStr}` : `#${path}`;
  }

  _handleCurrentHash() {
    if (!this._started) return;
    const { path, params } = this._parseHash();
    const handler = this._routes[path] || this._routes['/'];
    if (handler) handler({ path, params });
  }

  /**
   * If the current URL uses a path-based route (e.g. /replay, /games),
   * redirect to the hash equivalent (/#/replay, /#/games).
   * Also transfers any query params from the path URL into the hash.
   * Returns true if a redirect was performed.
   */
  _redirectPathToHash() {
    const pathname = window.location.pathname;
    // Strip trailing slash for comparison
    const normalized = pathname === '/' ? '/' : pathname.replace(/\/$/, '');

    // Check if pathname matches a known route (or ends with one, for /chess/replay etc.)
    let matchedRoute = null;
    for (const route of KNOWN_ROUTES) {
      if (route === '/') continue; // Don't redirect bare /
      if (normalized === route || normalized.endsWith(route)) {
        matchedRoute = route;
        break;
      }
    }

    if (!matchedRoute) return false;

    // Build the hash URL, preserving any query params from the original URL
    const queryParams = {};
    for (const [k, v] of new URLSearchParams(window.location.search)) {
      queryParams[k] = v;
    }
    const hash = this._buildHash(matchedRoute, queryParams);

    // Redirect: replace the current URL with the base path + hash
    // Use the part of pathname before the route as the base
    const routeIndex = normalized.lastIndexOf(matchedRoute);
    const basePath = normalized.slice(0, routeIndex) || '/';
    window.location.replace(basePath + hash);
    return true;
  }
}

export { Router };
