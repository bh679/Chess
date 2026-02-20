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
    this._defs = null;
    this._engineGroup = null;
    this._userGroup = null;
    this._userArrows = [];     // { from, to, element }
    this._userHighlights = []; // { square, element }
    this._markerCounter = 0;
    this._createSVG();
  }

  /* ── Public API ─────────────────────────────────────── */

  setEngineArrows(bestMoveUci, bestLineUci) {
    this.clearEngineArrows();
    if (!bestMoveUci) return;

    const best = this._parseUci(bestMoveUci);
    if (best) {
      this._drawArrow(this._engineGroup, best.from, best.to,
        COLORS.engineBest, 0.85, 0.28);
    }

    // PV continuation: moves 2-4 (indices 1-3 of bestLineUci)
    if (bestLineUci && bestLineUci.length > 1) {
      const maxPV = Math.min(bestLineUci.length, 4);
      for (let i = 1; i < maxPV; i++) {
        const pv = this._parseUci(bestLineUci[i]);
        if (pv) {
          this._drawArrow(this._engineGroup, pv.from, pv.to,
            COLORS.enginePV, 0.6, 0.2, i + 1);
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
      COLORS.user, 0.75, 0.24);
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

    this._defs = document.createElementNS(SVG_NS, 'defs');
    this._svg.appendChild(this._defs);

    // Layer groups — engine below user
    this._engineGroup = document.createElementNS(SVG_NS, 'g');
    this._engineGroup.classList.add('engine-arrows');
    this._svg.appendChild(this._engineGroup);

    this._userGroup = document.createElementNS(SVG_NS, 'g');
    this._userGroup.classList.add('user-annotations');
    this._svg.appendChild(this._userGroup);

    this._boardEl.appendChild(this._svg);
  }

  _createArrowMarker(color) {
    const id = `arrow-mk-${this._markerCounter++}`;
    const marker = document.createElementNS(SVG_NS, 'marker');
    marker.setAttribute('id', id);
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '7');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '4');
    marker.setAttribute('markerHeight', '4');
    marker.setAttribute('orient', 'auto-start-reverse');

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', 'M 1 1 L 9 5 L 1 9 Q 3 5 1 1 z');
    path.setAttribute('fill', color);
    marker.appendChild(path);

    this._defs.appendChild(marker);
    return id;
  }

  /* ── Drawing Helpers ────────────────────────────────── */

  _drawArrow(group, from, to, color, opacity, width, moveNumber) {
    const fromCoords = this._squareToCoords(from);
    const toCoords = this._squareToCoords(to);
    if (!fromCoords || !toCoords) return null;

    const markerId = this._createArrowMarker(color);

    // Shorten start and end so arrows don't cover piece centers
    const shortened = this._shortenLine(
      fromCoords.x, fromCoords.y,
      toCoords.x, toCoords.y, 0.25
    );
    const shortenedStart = this._shortenLine(
      toCoords.x, toCoords.y,
      fromCoords.x, fromCoords.y, 0.15
    );

    const x1 = shortenedStart.x, y1 = shortenedStart.y;
    const x2 = shortened.x, y2 = shortened.y;

    // Compute a control point perpendicular to the line for a gentle curve
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const curvature = len * 0.15;
    // Perpendicular offset (always curve to the right of the arrow direction)
    const nx = -dy / len * curvature;
    const ny = dx / len * curvature;
    const cx = (x1 + x2) / 2 + nx;
    const cy = (y1 + y2) / 2 + ny;

    const g = document.createElementNS(SVG_NS, 'g');

    // Shadow path for depth
    const shadow = document.createElementNS(SVG_NS, 'path');
    shadow.setAttribute('d', `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`);
    shadow.setAttribute('stroke', 'rgba(0,0,0,0.3)');
    shadow.setAttribute('stroke-opacity', opacity * 0.5);
    shadow.setAttribute('stroke-width', width + 0.08);
    shadow.setAttribute('stroke-linecap', 'round');
    shadow.setAttribute('fill', 'none');
    g.appendChild(shadow);

    // Main curved path
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-opacity', opacity);
    path.setAttribute('stroke-width', width);
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('fill', 'none');
    path.setAttribute('marker-end', `url(#${markerId})`);
    g.appendChild(path);

    // Move number label for PV continuation arrows
    if (moveNumber) {
      // Position the label at the midpoint of the curve
      const labelX = (x1 + 2 * cx + x2) / 4;
      const labelY = (y1 + 2 * cy + y2) / 4;

      // Background circle
      const bg = document.createElementNS(SVG_NS, 'circle');
      bg.setAttribute('cx', labelX);
      bg.setAttribute('cy', labelY);
      bg.setAttribute('r', '0.28');
      bg.setAttribute('fill', color);
      bg.setAttribute('fill-opacity', '0.9');
      g.appendChild(bg);

      // Number text
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', labelX);
      text.setAttribute('y', labelY);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('font-size', '0.32');
      text.setAttribute('font-weight', '700');
      text.setAttribute('fill', '#fff');
      text.setAttribute('font-family', 'system-ui, sans-serif');
      text.textContent = moveNumber;
      g.appendChild(text);
    }

    group.appendChild(g);
    return g;
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
