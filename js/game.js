import { Chess } from './chess.js';

class Game {
  constructor() {
    this.chess = new Chess();
    this._lastMove = null;
  }

  newGame() {
    this.chess.reset();
    this._lastMove = null;
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
}

export { Game };
