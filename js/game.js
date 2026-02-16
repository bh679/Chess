import { Chess } from './chess.js';

class Game {
  constructor() {
    this.chess = new Chess();
    this._lastMove = null;
    this._captured = { w: [], b: [] }; // pieces captured BY each color
    this._chess960 = false;
    this._timedOut = false;
  }

  newGame(chess960 = false) {
    this._chess960 = chess960;
    this._timedOut = false;
    if (chess960) {
      const fen = this._generateChess960FEN();
      this.chess.load(fen);
    } else {
      this.chess.reset();
    }
    this._lastMove = null;
    this._captured = { w: [], b: [] };
  }

  _generateChess960FEN() {
    // Generate a random Chess960 starting position
    const pieces = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

    // Shuffle back rank with Chess960 constraints
    let backRank;
    let valid = false;
    while (!valid) {
      backRank = this._shuffle(pieces.slice());

      // Check constraints:
      // 1. King must be between rooks
      const kingPos = backRank.indexOf('k');
      const rook1Pos = backRank.indexOf('r');
      const rook2Pos = backRank.lastIndexOf('r');

      // 2. Bishops must be on opposite colored squares
      const bishop1Pos = backRank.indexOf('b');
      const bishop2Pos = backRank.lastIndexOf('b');
      const bishopsOnOppositeColors = (bishop1Pos % 2) !== (bishop2Pos % 2);

      const kingBetweenRooks = rook1Pos < kingPos && kingPos < rook2Pos;

      valid = bishopsOnOppositeColors && kingBetweenRooks;
    }

    // Build FEN with positions flipped: FEN lists ranks from 8 to 1
    // Flip the board: white pieces on top (ranks 8-7), black pieces on bottom (ranks 2-1)
    const rank8 = backRank.join('').toLowerCase(); // White pieces on rank 8
    const rank1 = backRank.join('').toUpperCase(); // Black pieces on rank 1

    // Disable castling in Chess960 — chess.js doesn't support non-standard
    // rook positions for castling, which causes illegal moves and stuck AI.
    return `${rank8}/pppppppp/8/8/8/8/PPPPPPPP/${rank1} w - - 0 1`;
  }

  _shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  makeMove(from, to, promotion) {
    const moveObj = { from, to };
    if (promotion) {
      moveObj.promotion = promotion;
    }

    const result = this.chess.move(moveObj);
    if (!result) {
      return { success: false };
    }

    this._lastMove = { from, to };

    // Track captured pieces — result.color is the color that moved
    if (result.captured) {
      this._captured[result.color].push(result.captured);
    }

    return {
      success: true,
      san: result.san,
      captured: result.captured || null,
      isCheck: this.chess.isCheck(),
      isCheckmate: this.chess.isCheckmate(),
      isStalemate: this.chess.isStalemate(),
      isDraw: this.chess.isDraw(),
    };
  }

  getLegalMoves(square) {
    const moves = this.chess.moves({ square, verbose: true });
    return [...new Set(moves.map((m) => m.to))];
  }

  isPromotion(from, to) {
    const piece = this.chess.get(from);
    if (!piece || piece.type !== 'p') return false;
    const rank = to.charAt(1);
    return (piece.color === 'w' && rank === '8') ||
           (piece.color === 'b' && rank === '1');
  }

  getBoard() {
    return this.chess.board();
  }

  getTurn() {
    return this.chess.turn();
  }

  isGameOver() {
    return this._timedOut || this.chess.isGameOver();
  }

  setTimedOut() {
    this._timedOut = true;
  }

  getGameStatus() {
    if (this.chess.isCheckmate()) {
      const winner = this.chess.turn() === 'w' ? 'Black' : 'White';
      return `Checkmate! ${winner} wins`;
    }
    if (this.chess.isStalemate()) {
      return 'Stalemate \u2014 Draw';
    }
    if (this.chess.isInsufficientMaterial()) {
      return 'Draw \u2014 Insufficient material';
    }
    if (this.chess.isThreefoldRepetition()) {
      return 'Draw \u2014 Threefold repetition';
    }
    if (this.chess.isDraw()) {
      return 'Draw';
    }

    const turn = this.chess.turn() === 'w' ? 'White' : 'Black';
    if (this.chess.isCheck()) {
      return `Check! ${turn} to move`;
    }
    return `${turn} to move`;
  }

  getLastMove() {
    return this._lastMove;
  }

  getCaptured() {
    return this._captured;
  }
}

export { Game };
