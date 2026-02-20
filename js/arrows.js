const SVG_NS = 'http://www.w3.org/2000/svg';
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

const COLORS = {
  engineBest: '#3b82f6',
  enginePV:   '#93c5fd',
  user:       '#dc2626',
};

class ArrowOverlay {
  constructor(boardEl) {
    this._boardEl = boardEl;
    this._svg = null;
    this._engineGroup = null;
    this._userGroup = null;
    this._userArrows = [];     // { from, to, element }
    this._userHighlights = []; // { square, element }
    this._createSVG();
  }

  /* ── Public API ─────────────────────────────────────── */

  setEngineArrows(bestMoveUci, bestLineUci) {
    this.clearEngineArrows();
    if (!bestMoveUci) return;

    const best = this._parseUci(bestMoveUci);
    if (best) {
      this._drawArrow(this._engineGroup, best.from, best.to,
        COLORS.engineBest, 0.8, 0.25, 'arrow-engine');
    }

    // PV continuation: moves 2-4 (indices 1-3 of bestLineUci)
    if (bestLineUci && bestLineUci.length > 1) {
      const maxPV = Math.min(bestLineUci.length, 4);
      for (let i = 1; i < maxPV; i++) {
        const pv = this._parseUci(bestLineUci[i]);
        if (pv) {
          this._drawArrow(this._engineGroup, pv.from, pv.to,
            COLORS.enginePV, 0.5, 0.18, 'arrow-pv');
        }
      }
    }
  }

  clearEngineArrows() {
    if (this._engineGroup) {
      this._engineGroup.innerHTML = '';
    }
  }

  addUserArrow(from, to) {
    // Toggle off if duplicate
    const idx = this._userArrows.findIndex(a => a.from === from && a.to === to);
    if (idx !== -1) {
      this._userArrows[idx].element.remove();
      this._userArrows.splice(idx, 1);
      return;
    }

    const el = this._drawArrow(this._userGroup, from, to,
      COLORS.user, 0.75, 0.22, 'arrow-user');
    this._userArrows.push({ from, to, element: el });
  }

  toggleHighlight(square) {
    const idx = this._userHighlights.findIndex(h => h.square === square);
    if (idx !== -1) {
      this._userHighlights[idx].element.remove();
      this._userHighlights.splice(idx, 1);
      return;
    }

    const el = this._drawHighlight(this._userGroup, square, COLORS.user, 0.4);
    this._userHighlights.push({ square, element: el });
  }

  clearUserAnnotations() {
    for (const a of this._userArrows) a.element.remove();
    for (const h of this._userHighlights) h.element.remove();
    this._userArrows = [];
    this._userHighlights = [];
  }

  clear() {
    this.clearEngineArrows();
    this.clearUserAnnotations();
  }

  destroy() {
    if (this._svg && this._svg.parentNode) {
      this._svg.remove();
    }
  }

  /* ── SVG Setup ──────────────────────────────────────── */

  _createSVG() {
    this._svg = document.createElementNS(SVG_NS, 'svg');
    this._svg.setAttribute('viewBox', '0 0 8 8');
    this._svg.classList.add('arrow-overlay');

    // Marker definitions
    const defs = document.createElementNS(SVG_NS, 'defs');
    defs.appendChild(this._createMarker('arrow-engine', COLORS.engineBest));
    defs.appendChild(this._createMarker('arrow-pv', COLORS.enginePV));
    defs.appendChild(this._createMarker('arrow-user', COLORS.user));
    this._svg.appendChild(defs);

    // Layer groups — engine below user
    this._engineGroup = document.createElementNS(SVG_NS, 'g');
    this._engineGroup.classList.add('engine-arrows');
    this._svg.appendChild(this._engineGroup);

    this._userGroup = document.createElementNS(SVG_NS, 'g');
    this._userGroup.classList.add('user-annotations');
    this._svg.appendChild(this._userGroup);

    this._boardEl.appendChild(this._svg);
  }

  _createMarker(id, color) {
    const marker = document.createElementNS(SVG_NS, 'marker');
    marker.setAttribute('id', id);
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '8');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '3');
    marker.setAttribute('markerHeight', '3');
    marker.setAttribute('orient', 'auto-start-reverse');

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    path.setAttribute('fill', color);
    marker.appendChild(path);

    return marker;
  }

  /* ── Drawing Helpers ────────────────────────────────── */

  _drawArrow(group, from, to, color, opacity, width, markerId) {
    const fromCoords = this._squareToCoords(from);
    const toCoords = this._squareToCoords(to);
    if (!fromCoords || !toCoords) return null;

    // Shorten endpoint so arrowhead doesn't cover piece center
    const shortened = this._shortenLine(
      fromCoords.x, fromCoords.y,
      toCoords.x, toCoords.y, 0.2
    );

    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', fromCoords.x);
    line.setAttribute('y1', fromCoords.y);
    line.setAttribute('x2', shortened.x);
    line.setAttribute('y2', shortened.y);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-opacity', opacity);
    line.setAttribute('stroke-width', width);
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('marker-end', `url(#${markerId})`);

    group.appendChild(line);
    return line;
  }

  _drawHighlight(group, square, color, opacity) {
    const coords = this._squareToCoords(square);
    if (!coords) return null;

    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', coords.x - 0.5);
    rect.setAttribute('y', coords.y - 0.5);
    rect.setAttribute('width', 1);
    rect.setAttribute('height', 1);
    rect.setAttribute('fill', color);
    rect.setAttribute('fill-opacity', opacity);
    rect.setAttribute('rx', '0.05');

    group.appendChild(rect);
    return rect;
  }

  /* ── Coordinate Helpers ─────────────────────────────── */

  _squareToCoords(square) {
    if (!square || square.length < 2) return null;
    const fileIdx = FILES.indexOf(square[0]);
    const rankIdx = RANKS.indexOf(square[1]);
    if (fileIdx === -1 || rankIdx === -1) return null;
    return { x: fileIdx + 0.5, y: rankIdx + 0.5 };
  }

  _parseUci(uci) {
    if (!uci || uci.length < 4) return null;
    return { from: uci.substring(0, 2), to: uci.substring(2, 4) };
  }

  _shortenLine(x1, y1, x2, y2, amount) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < amount * 2) return { x: x2, y: y2 };
    const ratio = (len - amount) / len;
    return { x: x1 + dx * ratio, y: y1 + dy * ratio };
  }
}

export { ArrowOverlay };
