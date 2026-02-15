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
    // Chess960 (Fischer Random Chess) rules:
    // 1. Bishops must be on opposite-colored squares
    // 2. King must be between the two rooks
    // Same position is used for both white and black

    const pieces = new Array(8);
    const empty = [0, 1, 2, 3, 4, 5, 6, 7];

    // Step 1: Place light-squared bishop (squares 1, 3, 5, 7)
    const lightSquareIndices = empty.filter(i => i % 2 === 1);
    const lightBishopPos = lightSquareIndices[Math.floor(Math.random() * lightSquareIndices.length)];
    pieces[lightBishopPos] = 'B';
    empty.splice(empty.indexOf(lightBishopPos), 1);

    // Step 2: Place dark-squared bishop (squares 0, 2, 4, 6)
    const darkSquareIndices = empty.filter(i => i % 2 === 0);
    const darkBishopPos = darkSquareIndices[Math.floor(Math.random() * darkSquareIndices.length)];
    pieces[darkBishopPos] = 'B';
    empty.splice(empty.indexOf(darkBishopPos), 1);

    // Step 3: Place queen
    const queenPos = empty[Math.floor(Math.random() * empty.length)];
    pieces[queenPos] = 'Q';
    empty.splice(empty.indexOf(queenPos), 1);

    // Step 4: Place knights
    const knight1Pos = empty[Math.floor(Math.random() * empty.length)];
    pieces[knight1Pos] = 'N';
    empty.splice(empty.indexOf(knight1Pos), 1);

    const knight2Pos = empty[Math.floor(Math.random() * empty.length)];
    pieces[knight2Pos] = 'N';
    empty.splice(empty.indexOf(knight2Pos), 1);

    // Step 5: Place rook, king, rook in remaining positions (left to right)
    empty.sort((a, b) => a - b);
    pieces[empty[0]] = 'R';
    pieces[empty[1]] = 'K';
    pieces[empty[2]] = 'R';

    return pieces;
  }

  _setupChess960() {
    // Generate random Chess960 position
    const whitePieces = this._generateChess960Position();
    const blackPieces = [...whitePieces]; // Same arrangement for black

    // Build FEN from rank 8 (black) to rank 1 (white)
    // FEN format: rank8/rank7/.../rank2/rank1 turn castling ep halfmove fullmove
    const fen = [
      blackPieces.join(''),     // Rank 8: black pieces (uppercase)
      'PPPPPPPP',                // Rank 7: black pawns
      '8',                       // Rank 6: empty
      '8',                       // Rank 5: empty
      '8',                       // Rank 4: empty
      '8',                       // Rank 3: empty
      'pppppppp',                // Rank 2: white pawns
      whitePieces.map(p => p.toLowerCase()).join(''), // Rank 1: white pieces (lowercase)
    ].join('/');

    // Load position (no castling rights in Chess960 for this implementation)
    this.chess.load(`${fen} w - - 0 1`);
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
