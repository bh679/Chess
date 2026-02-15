import { Chess } from './chess.js';

class Game {
  constructor() {
    this.chess = new Chess();
    this._lastMove = null;
    this._captured = { w: [], b: [] }; // pieces captured BY each color
    this._chess960Enabled = false;
  }

  setChess960(enabled) {
    this._chess960Enabled = enabled;
  }

  newGame() {
    if (this._chess960Enabled) {
      this._setupChess960();
    } else {
      this.chess.reset();
    }
    this._lastMove = null;
    this._captured = { w: [], b: [] };
  }

  _generateChess960Position() {
    // Chess960 rules:
    // 1. Bishops must be on opposite colors
    // 2. King must be between the two rooks
    // 3. Positions are mirrored for black

    const backRank = new Array(8);
    const available = [0, 1, 2, 3, 4, 5, 6, 7];

    // Place bishops on opposite colors
    const lightSquares = [1, 3, 5, 7];
    const darkSquares = [0, 2, 4, 6];

    const lightBishop = lightSquares[Math.floor(Math.random() * lightSquares.length)];
    const darkBishop = darkSquares[Math.floor(Math.random() * darkSquares.length)];

    backRank[lightBishop] = 'b';
    backRank[darkBishop] = 'b';

    // Remove bishops from available positions
    available.splice(available.indexOf(lightBishop), 1);
    available.splice(available.indexOf(darkBishop), 1);

    // Place queen randomly in remaining positions
    const queenPos = available[Math.floor(Math.random() * available.length)];
    backRank[queenPos] = 'q';
    available.splice(available.indexOf(queenPos), 1);

    // Place knights randomly in remaining positions
    const knight1Pos = available[Math.floor(Math.random() * available.length)];
    backRank[knight1Pos] = 'n';
    available.splice(available.indexOf(knight1Pos), 1);

    const knight2Pos = available[Math.floor(Math.random() * available.length)];
    backRank[knight2Pos] = 'n';
    available.splice(available.indexOf(knight2Pos), 1);

    // Place rooks and king (King must be between rooks)
    // The three remaining squares get: rook, king, rook (in that order)
    available.sort((a, b) => a - b);
    backRank[available[0]] = 'r';
    backRank[available[1]] = 'k';
    backRank[available[2]] = 'r';

    return backRank;
  }

  _setupChess960() {
    const backRank = this._generateChess960Position();
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    // Build FEN string for Chess960 position
    const rank8 = backRank.map(p => p.toUpperCase()).join('');
    const rank7 = 'PPPPPPPP';
    const rank2 = 'pppppppp';
    const rank1 = backRank.join('');

    const fen = `${rank8}/${rank7}/8/8/8/8/${rank2}/${rank1} w KQkq - 0 1`;

    this.chess.load(fen);
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
    return this.chess.isGameOver();
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
