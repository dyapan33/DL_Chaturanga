// Defines fundamental numeric constants obeying the number ending rule.
const Zero = 0;
const One = 1;
const Two = One + One;
const Three = 3;
const Four = Three + One;
const Five = 5;
const Six = Five + One;
const Seven = 7;
const Eight = Seven + One;
const Nine = 9;
const Ten = 10;
const NegativeOne = -1;
const FiftyMoveLimit = 100;
const DrawAcceptMargin = 350;
const DefaultBotElo = 1000;
const SixtySeconds = 60;
const BulletOneMinSeconds = 60;
const BlitzThreeMinSeconds = 180;
const BlitzFiveMinSeconds = 300;
const RapidTenMinSeconds = 600;
const PawnPoints = One;
const MinorPiecePoints = Three;
const RookPoints = Five;
const QueenPoints = Nine;
const EllaBotElo = One;
const EllaBotName = 'Ella';
const BotFirstElo = 100;
const BotLastElo = 2700;
const BotEloStep = 100;
const BotStandardNames = [
    'Bramble',
    'Pippin',
    'Clover',
    'Tumble',
    'Barnaby',
    'Marigold',
    'Zephyr',
    'Juniper',
    'Caspian',
    'Rowan',
    'Sylvie',
    'Gideon',
    'Lyra',
    'Dorian',
    'Astrid',
    'Lucian',
    'Thalia',
    'Alaric',
    'Vesper',
    'Cassian',
    'Isolde',
    'Orion',
    'Seraphina',
    'Kaelen',
    'Valkyrie',
    'Hyperion',
    'Chronos'
];

// Returns the unique bot name corresponding to the given Elo rating.
function GetBotName(EloRating) {
    // Returns Ella for the 1 Elo bot or looks up the name in BotStandardNames.
    if (EloRating <= EllaBotElo) {
        return EllaBotName;
    }
    const Index = Math.round((EloRating - BotFirstElo) / BotEloStep);
    if (Index >= Zero && Index < BotStandardNames.length) {
        return BotStandardNames[Index];
    }
    return EllaBotName;
}

// Defines file and rank lookup tables for board coordinates.
const FileLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const DisplayFileLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const RankNumbers = [
    Eight,
    Seven,
    Six,
    Five,
    Four,
    Three,
    Two,
    One
];
const PromotionPiecesWhite = ['Q', 'R', 'B', 'N'];
const PromotionPiecesBlack = ['q', 'r', 'b', 'n'];

// Manages FIDE laws of chess, legal move generation, draws, en passant, and game state.
class ChessGame {
    Initialize() {
        // Sets default configuration values and prepares the starting board.
        this.BotElo = DefaultBotElo;
        this.OddsPieces = '';
        this.OddsTimes = One;
        this.PlayerColor = 'w';
        this.IsMultiplayer = false;
        this.IsSandbox = false;
        this.Start(DefaultBotElo, '', One, 'w', false, false);
    }

    // Starts a new game with the selected bot Elo, handicap, side color, and mode.
    Start(EloRating, OddsPieces, OddsTimes, PlayerColor, IsMultiplayer, IsSandbox) {
        // Stores the game configuration parameters and resets state flags.
        this.BotElo = EloRating;
        this.OddsPieces = OddsPieces;
        this.OddsTimes = OddsTimes;
        this.PlayerColor = PlayerColor || 'w';
        this.IsMultiplayer = Boolean(IsMultiplayer);
        this.IsSandbox = Boolean(IsSandbox);
        this.TimesTaken = Zero;
        this.WhiteTurn = true;
        this.HalfMoveClock = Zero;
        this.FullMoveNumber = One;
        this.EnPassantRow = NegativeOne;
        this.EnPassantCol = NegativeOne;
        this.WhiteKingSide = true;
        this.WhiteQueenSide = true;
        this.BlackKingSide = true;
        this.BlackQueenSide = true;
        this.History = [];
        this.SanHistory = [];
        this.Snapshots = [];
        this.Frames = [];
        this.PositionCounts = {};
        this.LastMove = null;
        this.LastSpecialText = '';
        this.Result = '';
        this.GameOver = false;
        this.IsCheckmate = false;

        // Populates the starting board, applies material odds, and records frame zero.
        this.SetupInitialBoard();
        if (!this.IsMultiplayer && !this.IsSandbox) {
            this.ApplyOdds(OddsPieces, this.PlayerColor === 'b');
        }
        this.UpdateCastlingFlagsFromBoard();
        this.RecordPositionCount();
        this.RecordFrame();
    }

    // Populates the standard 8x8 starting chess position.
    SetupInitialBoard() {
        // Creates the initial rows for Black, empty middle ranks, and White.
        this.Board = [
            ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
            ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
            ['', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', ''],
            ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
            ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
        ];
    }

    // Removes bot pieces according to the chosen material odds preset and bot color.
    ApplyOdds(OddsPieces, BotIsWhite) {
        // Maps each preset name to the bot's back rank and pawn rank coordinates.
        const BackRow = BotIsWhite ? Seven : Zero;
        const PawnRow = BotIsWhite ? Six : One;
        const Presets = {
            pawnb1: [[BackRow, One]],
            knightsb1g1: [[BackRow, One], [BackRow, Six]],
            rooksa1h1: [[BackRow, Zero], [BackRow, Seven]],
            queen: [[BackRow, Three]],
            rook: [[BackRow, Zero]],
            minor: [[BackRow, One]],
            pawn: [[PawnRow, One]]
        };
        const Targets = Presets[OddsPieces] || [];

        // Clears each target square on the board.
        for (let Index = Zero; Index < Targets.length; Index += One) {
            const Coord = Targets[Index];
            this.Board[Coord[Zero]][Coord[One]] = '';
        }
    }

    // Synchronizes castling availability with the presence of rooks and kings.
    UpdateCastlingFlagsFromBoard() {
        // Permanently revokes castling rights when a king or rook leaves its starting square.
        if (this.Board[Seven][Four] !== 'K') {
            this.WhiteKingSide = false;
            this.WhiteQueenSide = false;
        }
        if (this.Board[Seven][Seven] !== 'R') {
            this.WhiteKingSide = false;
        }
        if (this.Board[Seven][Zero] !== 'R') {
            this.WhiteQueenSide = false;
        }
        if (this.Board[Zero][Four] !== 'k') {
            this.BlackKingSide = false;
            this.BlackQueenSide = false;
        }
        if (this.Board[Zero][Seven] !== 'r') {
            this.BlackKingSide = false;
        }
        if (this.Board[Zero][Zero] !== 'r') {
            this.BlackQueenSide = false;
        }
    }

    // Appends a non-destructive board frame for history inspection.
    RecordFrame() {
        // Stores the current FEN, last move, and checked/checkmated king squares.
        const InCheck = this.IsKingInCheck(this.Board, this.WhiteTurn);
        const CheckedKingSquare = InCheck ? this.FindKingSquare(this.Board, this.WhiteTurn) : null;
        const CheckmatedKingSquare = this.IsCheckmate ? CheckedKingSquare : null;
        this.Frames.push({
            Fen: this.GenerateFen(),
            LastMove: this.LastMove,
            InCheck: InCheck,
            CheckedKingSquare: CheckedKingSquare,
            CheckmatedKingSquare: CheckmatedKingSquare
        });
    }

    // Checks whether an en passant capture is currently a legal move under FIDE Article 9.2.2.
    HasLegalEnPassantCapture() {
        // Returns false immediately when no en passant target square exists.
        if (this.EnPassantRow === NegativeOne || this.EnPassantCol === NegativeOne) {
            return false;
        }

        // Checks whether any legal move of the side to move is a pawn landing on the en passant square.
        const TargetSquare = this.CoordsToSquare(this.EnPassantRow, this.EnPassantCol);
        const LegalMoves = this.GenerateLegalMoves(this.WhiteTurn);
        for (let Index = Zero; Index < LegalMoves.length; Index += One) {
            const MoveUci = LegalMoves[Index];
            if (MoveUci.slice(Two, Four) === TargetSquare && MoveUci[Zero] !== MoveUci[Two]) {
                const Coords = this.ParseUci(MoveUci);
                if (this.Board[Coords.FromRow][Coords.FromCol].toUpperCase() === 'P') {
                    return true;
                }
            }
        }
        return false;
    }

    // Increments the occurrence count for the current FIDE position key.
    RecordPositionCount() {
        // Includes the en passant square in the key only if an en passant capture is legally available.
        const FenParts = this.GenerateFen().split(' ');
        const EpField = this.HasLegalEnPassantCapture() ? FenParts[Three] : '-';
        const Key = `${FenParts[Zero]} ${FenParts[One]} ${FenParts[Two]} ${EpField}`;
        const Previous = this.PositionCounts[Key] || Zero;
        this.PositionCounts[Key] = Previous + One;
        return this.PositionCounts[Key];
    }

    // Builds and returns a snapshot of the current game state for the UI.
    GetState() {
        // Computes legal moves, check status, checked/checkmated king squares, and en passant.
        const LegalMoves = this.GameOver ? [] : this.GenerateLegalMoves(this.WhiteTurn);
        const InCheck = this.IsKingInCheck(this.Board, this.WhiteTurn);
        const CheckedKingSquare = InCheck ? this.FindKingSquare(this.Board, this.WhiteTurn) : null;
        const CheckmatedKingSquare = this.IsCheckmate ? CheckedKingSquare : null;
        const EnPassantSquare = this.EnPassantRow === NegativeOne ? null : this.CoordsToSquare(this.EnPassantRow, this.EnPassantCol);

        // Returns the formatted state object including history frames.
        return {
            Fen: this.GenerateFen(),
            Turn: this.WhiteTurn ? 'w' : 'b',
            PlayerColor: this.PlayerColor,
            IsMultiplayer: this.IsMultiplayer,
            IsSandbox: this.IsSandbox,
            History: this.History.slice(),
            SanHistory: this.SanHistory.slice(),
            Pgn: this.GeneratePgn(),
            Material: this.GetMaterialSummary(),
            Frames: this.Frames.slice(),
            LegalMoves: LegalMoves,
            InCheck: InCheck,
            IsCheckmate: this.IsCheckmate,
            CheckedKingSquare: CheckedKingSquare,
            CheckmatedKingSquare: CheckmatedKingSquare,
            GameOver: this.GameOver,
            Result: this.Result,
            BotElo: this.BotElo,
            OddsPieces: this.OddsPieces,
            OddsTimes: this.OddsTimes,
            TimesTaken: this.TimesTaken,
            LastMove: this.LastMove,
            LastSpecialText: this.LastSpecialText,
            EnPassantSquare: EnPassantSquare
        };
    }

    // Checks whether there is at least one saved snapshot available to undo.
    CanUndo() {
        // Returns true when the undo stack is non-empty.
        return this.Snapshots.length > Zero;
    }

    // Saves a deep copy of the current state onto the undo stack.
    SaveSnapshot() {
        // Copies the board rows, position counts, frames, and state properties.
        const CopiedBoard = this.CloneBoard(this.Board);
        const CopiedCounts = Object.assign({}, this.PositionCounts);
        this.Snapshots.push({
            Board: CopiedBoard,
            WhiteTurn: this.WhiteTurn,
            HalfMoveClock: this.HalfMoveClock,
            FullMoveNumber: this.FullMoveNumber,
            EnPassantRow: this.EnPassantRow,
            EnPassantCol: this.EnPassantCol,
            WhiteKingSide: this.WhiteKingSide,
            WhiteQueenSide: this.WhiteQueenSide,
            BlackKingSide: this.BlackKingSide,
            BlackQueenSide: this.BlackQueenSide,
            History: this.History.slice(),
            SanHistory: this.SanHistory.slice(),
            Frames: this.Frames.slice(),
            PositionCounts: CopiedCounts,
            TimesTaken: this.TimesTaken,
            LastMove: this.LastMove,
            LastSpecialText: this.LastSpecialText,
            Result: this.Result,
            GameOver: this.GameOver,
            IsCheckmate: this.IsCheckmate
        });
    }

    // Restores the state prior to the most recent saved move.
    Undo() {
        // Rejects the undo request if no snapshots exist.
        if (this.Snapshots.length === Zero) {
            return false;
        }

        // Pops the saved snapshot and restores all board fields.
        const Saved = this.Snapshots.pop();
        this.Board = Saved.Board;
        this.WhiteTurn = Saved.WhiteTurn;
        this.HalfMoveClock = Saved.HalfMoveClock;
        this.FullMoveNumber = Saved.FullMoveNumber;
        this.EnPassantRow = Saved.EnPassantRow;
        this.EnPassantCol = Saved.EnPassantCol;
        this.WhiteKingSide = Saved.WhiteKingSide;
        this.WhiteQueenSide = Saved.WhiteQueenSide;
        this.BlackKingSide = Saved.BlackKingSide;
        this.BlackQueenSide = Saved.BlackQueenSide;
        this.History = Saved.History;
        this.SanHistory = Saved.SanHistory ? Saved.SanHistory : Saved.History.slice();
        this.Frames = Saved.Frames;
        this.PositionCounts = Saved.PositionCounts;
        this.TimesTaken = Saved.TimesTaken;
        this.LastMove = Saved.LastMove;
        this.LastSpecialText = Saved.LastSpecialText;
        this.Result = Saved.Result;
        this.GameOver = Saved.GameOver;
        this.IsCheckmate = Saved.IsCheckmate;

        // Returns true to indicate that the undo succeeded.
        return true;
    }

    // Reverts the game state back to a specific half-move count for multiplayer sync.
    UndoToPly(TargetPly) {
        // Rejects the request if no snapshots are available.
        if (this.Snapshots.length === Zero) {
            return false;
        }

        // Pops snapshots until the history length matches TargetPly.
        let DidUndo = false;
        while (this.History.length > TargetPly && this.Snapshots.length > Zero) {
            this.Undo();
            DidUndo = true;
        }
        return DidUndo;
    }

    // Reverts moves until control returns to TargetColor or the undo stack is empty.
    UndoForColor(TargetColor) {
        // Rejects the undo request if no snapshots exist.
        if (this.Snapshots.length === Zero) {
            return false;
        }

        // Pops at least one move and continues until the active turn matches TargetColor.
        const TargetIsWhite = (TargetColor || this.PlayerColor) === 'w';
        this.Undo();
        while (this.WhiteTurn !== TargetIsWhite && this.Snapshots.length > Zero) {
            this.Undo();
        }
        return true;
    }

    // Handles a draw offer from the player based on the current evaluation score.
    OfferDraw(WhiteEvaluationScore) {
        // Rejects draw offers if the game is already over.
        if (this.GameOver) {
            return false;
        }

        // Computes the bot's advantage and accepts when not ahead by DrawAcceptMargin.
        const BotIsWhite = this.PlayerColor === 'b';
        const BotAdvantage = BotIsWhite ? WhiteEvaluationScore : -WhiteEvaluationScore;
        if (BotAdvantage <= DrawAcceptMargin) {
            this.AcceptDraw();
            return true;
        }

        // Declines the draw offer when the bot holds a decisive advantage.
        return false;
    }

    // Ends the game as a draw by mutual agreement under FIDE Article 5.2.3.
    AcceptDraw() {
        // Marks the game finished with an agreed draw result.
        if (this.GameOver) {
            return false;
        }
        this.GameOver = true;
        this.Result = 'Draw by agreement!';
        return true;
    }

    // Ends the game immediately via resignation under FIDE Article 5.1.2.
    Resign(ResigningColor) {
        // Ignores resignation if the game has already finished.
        if (this.GameOver) {
            return false;
        }

        // Determines the winner text based on game mode and resigning side.
        this.GameOver = true;
        const Color = ResigningColor || this.PlayerColor;
        if (this.IsMultiplayer || this.IsSandbox) {
            this.Result = Color === 'w' ? 'White resigned. Black wins!' : 'Black resigned. White wins!';
        } else {
            const BotName = GetBotName(this.BotElo);
            this.Result = `You resigned. ${BotName} wins!`;
        }
        return true;
    }

    // Ends the game when FlaggedColor runs out of time under FIDE Article 6.9.
    Timeout(FlaggedColor) {
        // Ignores timeout if the game has already finished.
        if (this.GameOver) {
            return false;
        }
        this.GameOver = true;
        const LoserIsWhite = (FlaggedColor || 'w') === 'w';
        const OpponentIsWhite = !LoserIsWhite;

        // Declares a draw under FIDE Article 6.9 if the opponent lacks mating material.
        if (!this.SideHasMatingMaterial(OpponentIsWhite)) {
            this.Result = 'Draw on time (insufficient mating material)!';
            return true;
        }

        // Awards a win on time to the opponent with sufficient mating material.
        if (this.IsMultiplayer || this.IsSandbox) {
            this.Result = LoserIsWhite ? 'Black wins on time!' : 'White wins on time!';
        } else {
            const BotName = GetBotName(this.BotElo);
            const PlayerLost = (LoserIsWhite ? 'w' : 'b') === this.PlayerColor;
            this.Result = PlayerLost ? `${BotName} wins on time!` : 'You win on time!';
        }
        return true;
    }

    // Checks whether the specified side has enough material to deliver checkmate (FIDE Article 6.9).
    SideHasMatingMaterial(ForWhite) {
        // Counts pawns, rooks, queens, and minor pieces belonging to ForWhite.
        let MinorCount = Zero;
        for (let Row = Zero; Row < Eight; Row += One) {
            for (let Col = Zero; Col < Eight; Col += One) {
                const Piece = this.Board[Row][Col];
                if (Piece === '' || this.IsWhitePiece(Piece) !== ForWhite) {
                    continue;
                }
                const Upper = Piece.toUpperCase();
                if (Upper === 'P' || Upper === 'Q' || Upper === 'R') {
                    return true;
                }
                if (Upper === 'B' || Upper === 'N') {
                    MinorCount += One;
                }
            }
        }
        return MinorCount >= Two;
    }

    // Computes captured pieces for both sides and the current material advantage in points.
    GetMaterialSummary() {
        // Tallies remaining pieces for White and Black on the current board.
        const StartCounts = { Q: One, R: Two, B: Two, N: Two, P: Eight };
        const PointValues = { Q: QueenPoints, R: RookPoints, B: MinorPiecePoints, N: MinorPiecePoints, P: PawnPoints };
        const WhiteFound = { Q: Zero, R: Zero, B: Zero, N: Zero, P: Zero };
        const BlackFound = { Q: Zero, R: Zero, B: Zero, N: Zero, P: Zero };
        let WhitePoints = Zero;
        let BlackPoints = Zero;
        for (let Row = Zero; Row < Eight; Row += One) {
            for (let Col = Zero; Col < Eight; Col += One) {
                const Piece = this.Board[Row][Col];
                if (Piece === '' || Piece.toUpperCase() === 'K') {
                    continue;
                }
                const Upper = Piece.toUpperCase();
                const Value = PointValues[Upper] || Zero;
                if (Piece === Upper) {
                    WhiteFound[Upper] += One;
                    WhitePoints += Value;
                } else {
                    BlackFound[Upper] += One;
                    BlackPoints += Value;
                }
            }
        }

        // Builds ordered arrays of captured pieces for White (captured Black pieces) and Black.
        const Order = ['Q', 'R', 'B', 'N', 'P'];
        const CapturedByWhite = [];
        const CapturedByBlack = [];
        for (let Index = Zero; Index < Order.length; Index += One) {
            const Key = Order[Index];
            const MissingBlack = Math.max(Zero, StartCounts[Key] - BlackFound[Key]);
            for (let Count = Zero; Count < MissingBlack; Count += One) {
                CapturedByWhite.push(Key.toLowerCase());
            }
            const MissingWhite = Math.max(Zero, StartCounts[Key] - WhiteFound[Key]);
            for (let Count = Zero; Count < MissingWhite; Count += One) {
                CapturedByBlack.push(Key);
            }
        }
        return {
            CapturedByWhite: CapturedByWhite,
            CapturedByBlack: CapturedByBlack,
            WhiteAdvantage: WhitePoints - BlackPoints
        };
    }

    // Formats a PGN move text string from the recorded Standard Algebraic Notation history.
    GeneratePgn() {
        // Pairs consecutive White and Black SAN moves into numbered PGN tokens.
        const Tokens = [];
        for (let Index = Zero; Index < this.SanHistory.length; Index += Two) {
            const MoveNum = Math.floor(Index / Two) + One;
            let Pair = `${MoveNum}. ${this.SanHistory[Index]}`;
            if (Index + One < this.SanHistory.length) {
                Pair += ` ${this.SanHistory[Index + One]}`;
            }
            Tokens.push(Pair);
        }
        return Tokens.join(' ');
    }

    // Loads a custom board state from a FEN string and records an undo snapshot.
    LoadFen(FenString) {
        // Validates the FEN placement field and ensures both kings are present.
        const Trimmed = String(FenString || '').trim();
        if (Trimmed === '') {
            return false;
        }
        const Parts = Trimmed.split(/\s+/);
        const Ranks = Parts[Zero].split('/');
        if (Ranks.length !== Eight) {
            return false;
        }
        const NewBoard = [];
        let HasWhiteKing = false;
        let HasBlackKing = false;
        for (let Row = Zero; Row < Eight; Row += One) {
            const RankText = Ranks[Row];
            const RowCells = [];
            for (let Index = Zero; Index < RankText.length; Index += One) {
                const Char = RankText[Index];
                if (Char >= '1' && Char <= '8') {
                    const EmptyLen = Number(Char);
                    for (let Step = Zero; Step < EmptyLen; Step += One) {
                        RowCells.push('');
                    }
                } else if ('kqrbnpKQRBNP'.includes(Char)) {
                    if (Char === 'K') {
                        HasWhiteKing = true;
                    }
                    if (Char === 'k') {
                        HasBlackKing = true;
                    }
                    RowCells.push(Char);
                } else {
                    return false;
                }
            }
            if (RowCells.length !== Eight) {
                return false;
            }
            NewBoard.push(RowCells);
        }
        if (!HasWhiteKing || !HasBlackKing) {
            return false;
        }

        // Applies the parsed board, turn, castling rights, and en passant square.
        this.SaveSnapshot();
        this.Board = NewBoard;
        this.WhiteTurn = (Parts[One] || 'w') !== 'b';
        const CastlingField = Parts[Two] || '-';
        this.WhiteKingSide = CastlingField.includes('K');
        this.WhiteQueenSide = CastlingField.includes('Q');
        this.BlackKingSide = CastlingField.includes('k');
        this.BlackQueenSide = CastlingField.includes('q');
        this.UpdateCastlingFlagsFromBoard();
        const EpField = Parts[Three] || '-';
        if (EpField !== '-' && EpField.length === Two) {
            this.EnPassantCol = FileLetters.indexOf(EpField[Zero]);
            this.EnPassantRow = Eight - Number(EpField[One]);
        } else {
            this.EnPassantRow = NegativeOne;
            this.EnPassantCol = NegativeOne;
        }
        this.HalfMoveClock = Number(Parts[Four]) || Zero;
        this.FullMoveNumber = Number(Parts[Five]) || One;
        this.GameOver = false;
        this.IsCheckmate = false;
        this.Result = '';
        this.LastMove = null;
        this.LastSpecialText = 'Loaded FEN position.';
        this.EvaluateTerminalState();
        this.RecordFrame();
        return true;
    }

    // Converts a legal UCI move into FIDE Standard Algebraic Notation prior to board mutation.
    FormatMoveAsSan(MoveUci) {
        // Extracts moving piece, capture state, destination square, and castling notation.
        const Coords = this.ParseUci(MoveUci);
        const MovingPiece = this.Board[Coords.FromRow][Coords.FromCol];
        if (!MovingPiece) {
            return MoveUci;
        }
        const PieceUpper = MovingPiece.toUpperCase();
        const IsWhite = MovingPiece === PieceUpper;
        const TargetPiece = this.Board[Coords.ToRow][Coords.ToCol];
        const IsEnPassant = (
            PieceUpper === 'P' &&
            Coords.FromCol !== Coords.ToCol &&
            Coords.ToRow === this.EnPassantRow &&
            Coords.ToCol === this.EnPassantCol
        );
        const IsCapture = TargetPiece !== '' || IsEnPassant;
        const DestSquare = MoveUci.slice(Two, Four);
        if (PieceUpper === 'K' && Math.abs(Coords.ToCol - Coords.FromCol) === Two) {
            return Coords.ToCol === Six ? 'O-O' : 'O-O-O';
        }
        if (PieceUpper === 'P') {
            const Prefix = IsCapture ? `${MoveUci[Zero]}x` : '';
            const PromoText = Coords.Promotion !== '' ? `=${Coords.Promotion.toUpperCase()}` : '';
            return `${Prefix}${DestSquare}${PromoText}`;
        }

        // Computes file/rank disambiguation when identical pieces can reach DestSquare.
        const CurrentLegal = this.GenerateLegalMoves(IsWhite);
        let AmbiguousCount = Zero;
        let SameFile = false;
        let SameRank = false;
        for (let Index = Zero; Index < CurrentLegal.length; Index += One) {
            const OtherUci = CurrentLegal[Index];
            if (OtherUci === MoveUci || OtherUci.slice(Two, Four) !== DestSquare) {
                continue;
            }
            const OtherCoords = this.ParseUci(OtherUci);
            if (this.Board[OtherCoords.FromRow][OtherCoords.FromCol] === MovingPiece) {
                AmbiguousCount += One;
                if (OtherCoords.FromCol === Coords.FromCol) {
                    SameFile = true;
                }
                if (OtherCoords.FromRow === Coords.FromRow) {
                    SameRank = true;
                }
            }
        }
        let Disambig = '';
        if (AmbiguousCount > Zero) {
            if (!SameFile) {
                Disambig = MoveUci[Zero];
            } else if (!SameRank) {
                Disambig = MoveUci[One];
            } else {
                Disambig = MoveUci.slice(Zero, Two);
            }
        }
        const CaptureSign = IsCapture ? 'x' : '';
        return `${PieceUpper}${Disambig}${CaptureSign}${DestSquare}`;
    }

    // Places or removes a piece on SquareName during Sandbox mode editing.
    SetSquarePiece(SquareName, PieceCode) {
        // Parses the target square coordinates and validates board boundaries.
        const Col = FileLetters.indexOf(SquareName[Zero]);
        const Row = Eight - Number(SquareName[One]);
        if (!this.IsInsideBoard(Row, Col)) {
            return false;
        }

        // Saves an undo snapshot and updates the target square piece.
        this.SaveSnapshot();
        this.Board[Row][Col] = PieceCode || '';
        this.EnPassantRow = NegativeOne;
        this.EnPassantCol = NegativeOne;
        this.GameOver = false;
        this.IsCheckmate = false;
        this.Result = '';
        this.LastMove = null;
        this.LastSpecialText = PieceCode ? `Placed ${PieceCode} on ${SquareName}` : `Cleared ${SquareName}`;
        this.UpdateCastlingFlagsFromBoard();
        this.RecordFrame();
        return true;
    }

    // Changes the active turn side in Sandbox mode.
    SetActiveTurn(ForWhite) {
        // Updates WhiteTurn and clears any stale en passant or terminal flags.
        this.WhiteTurn = Boolean(ForWhite);
        this.EnPassantRow = NegativeOne;
        this.EnPassantCol = NegativeOne;
        this.GameOver = false;
        this.IsCheckmate = false;
        this.Result = '';
    }

    // Clears all non-king pieces from the board in Sandbox mode.
    ClearBoardToKings() {
        // Saves an undo snapshot and removes every piece except K and k.
        this.SaveSnapshot();
        for (let Row = Zero; Row < Eight; Row += One) {
            for (let Col = Zero; Col < Eight; Col += One) {
                const Piece = this.Board[Row][Col];
                if (Piece !== 'K' && Piece !== 'k') {
                    this.Board[Row][Col] = '';
                }
            }
        }
        this.EnPassantRow = NegativeOne;
        this.EnPassantCol = NegativeOne;
        this.GameOver = false;
        this.IsCheckmate = false;
        this.Result = '';
        this.LastMove = null;
        this.LastSpecialText = 'Cleared non-king pieces.';
        this.UpdateCastlingFlagsFromBoard();
        this.RecordFrame();
    }

    // Executes a human move in UCI notation if legal.
    PlayerMove(MoveUci) {
        // Rejects moves when the game is finished or it is the bot's turn.
        if (this.GameOver) {
            return false;
        }
        const ExpectedWhite = (this.IsMultiplayer || this.IsSandbox) ? this.WhiteTurn : (this.PlayerColor === 'w');
        if (this.WhiteTurn !== ExpectedWhite) {
            return false;
        }

        // Verifies that the requested UCI string is in the legal move list.
        const LegalMoves = this.GenerateLegalMoves(this.WhiteTurn);
        if (!LegalMoves.includes(MoveUci)) {
            return false;
        }

        // Saves a snapshot for undo, commits the move, and updates turn state.
        this.SaveSnapshot();
        this.CommitMove(MoveUci);
        this.TimesTaken = Zero;
        this.WhiteTurn = !this.WhiteTurn;
        if (this.WhiteTurn) {
            this.FullMoveNumber += One;
        }
        this.EvaluateTerminalState();
        this.RecordFrame();

        // Signals that the player move was applied.
        return true;
    }

    // Executes a bot move in UCI notation and updates multi-move odds counters.
    ApplyBotMove(MoveUci) {
        // Rejects moves if the game has ended or it is the player's turn.
        const BotIsWhite = this.PlayerColor === 'b';
        if (this.GameOver || this.IsMultiplayer || this.WhiteTurn !== BotIsWhite) {
            return false;
        }

        // Checks that the chosen bot move is legal.
        const LegalMoves = this.GenerateLegalMoves(BotIsWhite);
        if (!LegalMoves.includes(MoveUci)) {
            return false;
        }

        // Saves a snapshot for undo, applies the bot move, and increments the turn counter.
        this.SaveSnapshot();
        this.CommitMove(MoveUci);
        this.TimesTaken += One;
        if (!BotIsWhite) {
            this.FullMoveNumber += One;
        }

        // Decides whether the bot gets another move under multi-move odds.
        const GivesCheck = this.IsKingInCheck(this.Board, !BotIsWhite);
        if (this.TimesTaken < this.OddsTimes && !GivesCheck) {
            this.WhiteTurn = BotIsWhite;
            const NextBotMoves = this.GenerateLegalMoves(BotIsWhite);
            if (NextBotMoves.length === Zero) {
                this.WhiteTurn = !BotIsWhite;
            }
        } else {
            this.WhiteTurn = !BotIsWhite;
        }

        // Evaluates terminal state and records the updated history frame.
        this.EvaluateTerminalState();
        this.RecordFrame();
        return true;
    }

    // Applies a validated UCI move to the live board state.
    CommitMove(MoveUci) {
        // Formats the move in Standard Algebraic Notation before mutating the board.
        const SanText = this.FormatMoveAsSan(MoveUci);
        const Coords = this.ParseUci(MoveUci);
        const MovingPiece = this.Board[Coords.FromRow][Coords.FromCol];
        const TargetPiece = this.Board[Coords.ToRow][Coords.ToCol];
        const PieceUpper = MovingPiece.toUpperCase();
        const IsWhite = MovingPiece === PieceUpper;
        let WasEnPassant = false;
        this.LastSpecialText = '';

        // Handles en passant pawn capture removal under FIDE Article 3.7.3.
        if (
            PieceUpper === 'P' &&
            Coords.FromCol !== Coords.ToCol &&
            Coords.ToRow === this.EnPassantRow &&
            Coords.ToCol === this.EnPassantCol
        ) {
            const CapturedPawnRow = IsWhite ? Coords.ToRow + One : Coords.ToRow - One;
            this.Board[CapturedPawnRow][Coords.ToCol] = '';
            WasEnPassant = true;
            this.LastSpecialText = 'En passant capture!';
        }

        // Handles rook movement during kingside or queenside castling under FIDE Article 3.8.2.
        if (PieceUpper === 'K' && Math.abs(Coords.ToCol - Coords.FromCol) === Two) {
            if (Coords.ToCol === Six) {
                this.Board[Coords.FromRow][Five] = this.Board[Coords.FromRow][Seven];
                this.Board[Coords.FromRow][Seven] = '';
            } else if (Coords.ToCol === Two) {
                this.Board[Coords.FromRow][Three] = this.Board[Coords.FromRow][Zero];
                this.Board[Coords.FromRow][Zero] = '';
            }
            this.LastSpecialText = 'Castled!';
        }

        // Moves the piece and applies pawn promotion when present under FIDE Article 3.7.5.
        let PlacedPiece = MovingPiece;
        if (Coords.Promotion !== '') {
            PlacedPiece = IsWhite ? Coords.Promotion.toUpperCase() : Coords.Promotion.toLowerCase();
            this.LastSpecialText = `Promoted to ${PlacedPiece.toUpperCase()}!`;
        }
        this.Board[Coords.ToRow][Coords.ToCol] = PlacedPiece;
        this.Board[Coords.FromRow][Coords.FromCol] = '';

        // Updates the en passant target square if a pawn advanced two ranks.
        if (PieceUpper === 'P' && Math.abs(Coords.ToRow - Coords.FromRow) === Two) {
            this.EnPassantRow = (Coords.FromRow + Coords.ToRow) / Two;
            this.EnPassantCol = Coords.FromCol;
        } else {
            this.EnPassantRow = NegativeOne;
            this.EnPassantCol = NegativeOne;
        }

        // Updates castling rights and half-move clock.
        this.UpdateCastlingFlagsFromBoard();
        if (PieceUpper === 'P' || TargetPiece !== '' || WasEnPassant) {
            this.HalfMoveClock = Zero;
        } else {
            this.HalfMoveClock += One;
        }

        // Records the move in UCI and SAN histories and updates LastMove.
        this.History.push(MoveUci);
        this.SanHistory.push(SanText);
        this.LastMove = MoveUci;
    }

    // Evaluates FIDE terminal conditions: checkmate, stalemate, repetition, dead position, and 50-move rule.
    EvaluateTerminalState() {
        // Records the new position repetition count and computes legal moves for the active player.
        const Repetitions = this.RecordPositionCount();
        const LegalMoves = this.GenerateLegalMoves(this.WhiteTurn);
        const InCheck = this.IsKingInCheck(this.Board, this.WhiteTurn);

        // Appends + (check) or # (checkmate) to the latest SAN move entry if applicable.
        if (InCheck && this.SanHistory.length > Zero) {
            const LastIdx = this.SanHistory.length - One;
            const BaseSan = this.SanHistory[LastIdx].replace(/[+#]$/g, '');
            this.SanHistory[LastIdx] = BaseSan + (LegalMoves.length === Zero ? '#' : '+');
        }

        // Checks for checkmate (FIDE Article 5.1.1) and stalemate (FIDE Article 5.2.1) first.
        if (LegalMoves.length === Zero) {
            this.GameOver = true;
            if (this.IsKingInCheck(this.Board, this.WhiteTurn)) {
                this.IsCheckmate = true;
                const LoserColor = this.WhiteTurn ? 'w' : 'b';
                if (this.IsMultiplayer || this.IsSandbox) {
                    this.Result = LoserColor === 'w' ? 'Black wins by checkmate!' : 'White wins by checkmate!';
                } else {
                    const BotName = GetBotName(this.BotElo);
                    this.Result = LoserColor === this.PlayerColor ? `${BotName} wins by checkmate!` : 'You win by checkmate!';
                }
            } else {
                this.Result = 'Draw by stalemate!';
            }
            return;
        }

        // Checks for dead position / insufficient material under FIDE Article 5.2.2.
        if (this.HasInsufficientMaterial()) {
            this.GameOver = true;
            this.Result = 'Draw by insufficient material!';
            return;
        }

        // Checks for threefold repetition under FIDE Article 9.2.
        if (Repetitions >= Three) {
            this.GameOver = true;
            this.Result = 'Draw by threefold repetition!';
            return;
        }

        // Checks for the fifty-move rule under FIDE Article 9.3.
        if (this.HalfMoveClock >= FiftyMoveLimit) {
            this.GameOver = true;
            this.Result = 'Draw by fifty-move rule!';
        }
    }

    // Determines whether neither side can checkmate by any series of legal moves (FIDE Article 5.2.2).
    HasInsufficientMaterial() {
        // Collects all minor pieces and returns false if any pawn, rook, or queen exists.
        const BishopSquareColors = [];
        let KnightCount = Zero;
        for (let Row = Zero; Row < Eight; Row += One) {
            for (let Col = Zero; Col < Eight; Col += One) {
                const Piece = this.Board[Row][Col].toUpperCase();
                if (Piece === 'P' || Piece === 'R' || Piece === 'Q') {
                    return false;
                }
                if (Piece === 'N') {
                    KnightCount += One;
                } else if (Piece === 'B') {
                    BishopSquareColors.push((Row + Col) % Two);
                }
            }
        }

        // Declares a dead position for K vs K, K+minor vs K, or only bishops on the same square color.
        const TotalMinors = KnightCount + BishopSquareColors.length;
        if (TotalMinors <= One) {
            return true;
        }
        if (KnightCount === Zero && BishopSquareColors.length >= Two) {
            const FirstColor = BishopSquareColors[Zero];
            return BishopSquareColors.every((Color) => Color === FirstColor);
        }
        return false;
    }

    // Generates all legal UCI moves for the specified side.
    GenerateLegalMoves(ForWhite) {
        // Generates pseudo-legal moves and filters out moves leaving the king in check.
        const PseudoMoves = this.GeneratePseudoMoves(this.Board, ForWhite, true);
        const LegalMoves = [];
        for (let Index = Zero; Index < PseudoMoves.length; Index += One) {
            const Candidate = PseudoMoves[Index];
            const NextBoard = this.SimulateMoveOnBoard(this.Board, Candidate);
            if (!this.IsKingInCheck(NextBoard, ForWhite)) {
                LegalMoves.push(Candidate);
            }
        }

        // Returns the verified list of legal moves.
        return LegalMoves;
    }

    // Generates pseudo-legal UCI moves for a given board and side.
    GeneratePseudoMoves(BoardState, ForWhite, IncludeCastling) {
        // Iterates through every square to collect moves from friendly pieces.
        const Moves = [];
        for (let Row = Zero; Row < Eight; Row += One) {
            for (let Col = Zero; Col < Eight; Col += One) {
                const Piece = BoardState[Row][Col];
                if (Piece === '' || this.IsWhitePiece(Piece) !== ForWhite) {
                    continue;
                }
                this.AppendPieceMoves(BoardState, Row, Col, Piece, ForWhite, IncludeCastling, Moves);
            }
        }

        // Returns the collected pseudo-legal moves.
        return Moves;
    }

    // Dispatches move generation based on the piece type at (Row, Col).
    AppendPieceMoves(BoardState, Row, Col, Piece, ForWhite, IncludeCastling, Moves) {
        // Normalizes the piece letter to uppercase for type matching.
        const Type = Piece.toUpperCase();
        if (Type === 'P') {
            this.AppendPawnMoves(BoardState, Row, Col, ForWhite, Moves);
            return;
        }
        if (Type === 'N') {
            this.AppendKnightMoves(BoardState, Row, Col, ForWhite, Moves);
            return;
        }
        if (Type === 'B') {
            this.AppendSliderMoves(BoardState, Row, Col, ForWhite, this.GetBishopDirections(), Moves);
            return;
        }
        if (Type === 'R') {
            this.AppendSliderMoves(BoardState, Row, Col, ForWhite, this.GetRookDirections(), Moves);
            return;
        }
        if (Type === 'Q') {
            this.AppendSliderMoves(BoardState, Row, Col, ForWhite, this.GetQueenDirections(), Moves);
            return;
        }
        if (Type === 'K') {
            this.AppendKingMoves(BoardState, Row, Col, ForWhite, IncludeCastling, Moves);
        }
    }

    // Appends pawn advances, captures, promotions, and en passant moves.
    AppendPawnMoves(BoardState, Row, Col, ForWhite, Moves) {
        // Sets movement direction, starting rank, and promotion rank for the pawn.
        const Step = ForWhite ? NegativeOne : One;
        const StartRow = ForWhite ? Six : One;
        const PromoRow = ForWhite ? Zero : Seven;
        const NextRow = Row + Step;

        // Checks single-square and double-square forward advances.
        if (this.IsInsideBoard(NextRow, Col) && BoardState[NextRow][Col] === '') {
            this.PushPawnMove(Row, Col, NextRow, Col, NextRow === PromoRow, ForWhite, Moves);
            const DoubleRow = Row + Step * Two;
            if (Row === StartRow && BoardState[DoubleRow][Col] === '') {
                this.PushPawnMove(Row, Col, DoubleRow, Col, false, ForWhite, Moves);
            }
        }

        // Checks diagonal captures and en passant captures.
        const CaptureOffsets = [NegativeOne, One];
        for (let Index = Zero; Index < CaptureOffsets.length; Index += One) {
            const TargetCol = Col + CaptureOffsets[Index];
            if (!this.IsInsideBoard(NextRow, TargetCol)) {
                continue;
            }
            const Occupant = BoardState[NextRow][TargetCol];
            if (Occupant !== '' && this.IsWhitePiece(Occupant) !== ForWhite) {
                this.PushPawnMove(Row, Col, NextRow, TargetCol, NextRow === PromoRow, ForWhite, Moves);
            } else if (NextRow === this.EnPassantRow && TargetCol === this.EnPassantCol && BoardState === this.Board) {
                this.PushPawnMove(Row, Col, NextRow, TargetCol, false, ForWhite, Moves);
            }
        }
    }

    // Formats and pushes a pawn move, expanding promotion suffixes when needed.
    PushPawnMove(FromRow, FromCol, ToRow, ToCol, IsPromotion, ForWhite, Moves) {
        // Builds the base four-character UCI coordinate string.
        const BaseMove = this.CoordsToSquare(FromRow, FromCol) + this.CoordsToSquare(ToRow, ToCol);
        if (!IsPromotion) {
            Moves.push(BaseMove);
            return;
        }

        // Appends queen, rook, bishop, and knight promotion options.
        const PromoList = ForWhite ? PromotionPiecesWhite : PromotionPiecesBlack;
        for (let Index = Zero; Index < PromoList.length; Index += One) {
            Moves.push(BaseMove + PromoList[Index].toLowerCase());
        }
    }

    // Appends knight jump moves from (Row, Col).
    AppendKnightMoves(BoardState, Row, Col, ForWhite, Moves) {
        // Defines the eight L-shaped knight offsets.
        const Offsets = [
            [NegativeOne * Two, NegativeOne],
            [NegativeOne * Two, One],
            [NegativeOne, NegativeOne * Two],
            [NegativeOne, Two],
            [One, NegativeOne * Two],
            [One, Two],
            [Two, NegativeOne],
            [Two, One]
        ];

        // Checks each target square for board bounds and occupant color.
        const FromSquare = this.CoordsToSquare(Row, Col);
        for (let Index = Zero; Index < Offsets.length; Index += One) {
            const TargetRow = Row + Offsets[Index][Zero];
            const TargetCol = Col + Offsets[Index][One];
            if (!this.IsInsideBoard(TargetRow, TargetCol)) {
                continue;
            }
            const Occupant = BoardState[TargetRow][TargetCol];
            if (Occupant === '' || this.IsWhitePiece(Occupant) !== ForWhite) {
                Moves.push(FromSquare + this.CoordsToSquare(TargetRow, TargetCol));
            }
        }
    }

    // Appends sliding moves along the given ray directions.
    AppendSliderMoves(BoardState, Row, Col, ForWhite, Directions, Moves) {
        // Steps outward along each ray until blocked by the edge or a piece.
        const FromSquare = this.CoordsToSquare(Row, Col);
        for (let DirIndex = Zero; DirIndex < Directions.length; DirIndex += One) {
            const DeltaRow = Directions[DirIndex][Zero];
            const DeltaCol = Directions[DirIndex][One];
            let TargetRow = Row + DeltaRow;
            let TargetCol = Col + DeltaCol;
            while (this.IsInsideBoard(TargetRow, TargetCol)) {
                const Occupant = BoardState[TargetRow][TargetCol];
                if (Occupant === '') {
                    Moves.push(FromSquare + this.CoordsToSquare(TargetRow, TargetCol));
                } else {
                    if (this.IsWhitePiece(Occupant) !== ForWhite) {
                        Moves.push(FromSquare + this.CoordsToSquare(TargetRow, TargetCol));
                    }
                    break;
                }
                TargetRow += DeltaRow;
                TargetCol += DeltaCol;
            }
        }
    }

    // Appends single-step king moves and legal castling moves.
    AppendKingMoves(BoardState, Row, Col, ForWhite, IncludeCastling, Moves) {
        // Checks all eight adjacent squares around the king.
        const Directions = this.GetQueenDirections();
        const FromSquare = this.CoordsToSquare(Row, Col);
        for (let Index = Zero; Index < Directions.length; Index += One) {
            const TargetRow = Row + Directions[Index][Zero];
            const TargetCol = Col + Directions[Index][One];
            if (!this.IsInsideBoard(TargetRow, TargetCol)) {
                continue;
            }
            const Occupant = BoardState[TargetRow][TargetCol];
            if (Occupant === '' || this.IsWhitePiece(Occupant) !== ForWhite) {
                Moves.push(FromSquare + this.CoordsToSquare(TargetRow, TargetCol));
            }
        }

        // Skips castling checks during attack detection or on simulated boards.
        if (!IncludeCastling || BoardState !== this.Board) {
            return;
        }
        this.AppendCastlingMoves(BoardState, Row, Col, ForWhite, Moves);
    }

    // Checks kingside and queenside castling conditions and appends valid moves.
    AppendCastlingMoves(BoardState, Row, Col, ForWhite, Moves) {
        // Ensures the king is on its home square and not currently in check.
        const HomeRow = ForWhite ? Seven : Zero;
        if (Row !== HomeRow || Col !== Four || this.IsKingInCheck(BoardState, ForWhite)) {
            return;
        }

        // Checks kingside castling path and transit square safety.
        const CanKingSide = ForWhite ? this.WhiteKingSide : this.BlackKingSide;
        const KingRook = ForWhite ? 'R' : 'r';
        if (
            CanKingSide &&
            BoardState[HomeRow][Seven] === KingRook &&
            BoardState[HomeRow][Five] === '' &&
            BoardState[HomeRow][Six] === '' &&
            !this.IsSquareAttacked(BoardState, HomeRow, Five, !ForWhite) &&
            !this.IsSquareAttacked(BoardState, HomeRow, Six, !ForWhite)
        ) {
            Moves.push(this.CoordsToSquare(HomeRow, Four) + this.CoordsToSquare(HomeRow, Six));
        }

        // Checks queenside castling path and transit square safety.
        const CanQueenSide = ForWhite ? this.WhiteQueenSide : this.BlackQueenSide;
        if (
            CanQueenSide &&
            BoardState[HomeRow][Zero] === KingRook &&
            BoardState[HomeRow][One] === '' &&
            BoardState[HomeRow][Two] === '' &&
            BoardState[HomeRow][Three] === '' &&
            !this.IsSquareAttacked(BoardState, HomeRow, Three, !ForWhite) &&
            !this.IsSquareAttacked(BoardState, HomeRow, Two, !ForWhite)
        ) {
            Moves.push(this.CoordsToSquare(HomeRow, Four) + this.CoordsToSquare(HomeRow, Two));
        }
    }

    // Locates the algebraic square name of the king for the specified side.
    FindKingSquare(BoardState, ForWhite) {
        // Scans the board matrix for the matching king character.
        const KingChar = ForWhite ? 'K' : 'k';
        for (let Row = Zero; Row < Eight; Row += One) {
            for (let Col = Zero; Col < Eight; Col += One) {
                if (BoardState[Row][Col] === KingChar) {
                    return this.CoordsToSquare(Row, Col);
                }
            }
        }
        return null;
    }

    // Determines whether the king of the specified color is currently in check.
    IsKingInCheck(BoardState, ForWhite) {
        // Finds the coordinates of the king on the given board.
        const KingChar = ForWhite ? 'K' : 'k';
        let KingRow = NegativeOne;
        let KingCol = NegativeOne;
        for (let Row = Zero; Row < Eight; Row += One) {
            for (let Col = Zero; Col < Eight; Col += One) {
                if (BoardState[Row][Col] === KingChar) {
                    KingRow = Row;
                    KingCol = Col;
                    break;
                }
            }
        }

        // Returns false if no king is present, or checks if the opponent attacks it.
        if (KingRow === NegativeOne) {
            return false;
        }
        return this.IsSquareAttacked(BoardState, KingRow, KingCol, !ForWhite);
    }

    // Checks whether any piece of ByWhite's color attacks (TargetRow, TargetCol).
    IsSquareAttacked(BoardState, TargetRow, TargetCol, ByWhite) {
        // Checks for pawn attacks from the attacking side.
        const PawnSourceRow = ByWhite ? TargetRow + One : TargetRow - One;
        const AttackerPawn = ByWhite ? 'P' : 'p';
        if (this.IsInsideBoard(PawnSourceRow, TargetCol - One) && BoardState[PawnSourceRow][TargetCol - One] === AttackerPawn) {
            return true;
        }
        if (this.IsInsideBoard(PawnSourceRow, TargetCol + One) && BoardState[PawnSourceRow][TargetCol + One] === AttackerPawn) {
            return true;
        }

        // Generates non-castling moves for the attacking side to test target square reach.
        const TargetSquare = this.CoordsToSquare(TargetRow, TargetCol);
        for (let Row = Zero; Row < Eight; Row += One) {
            for (let Col = Zero; Col < Eight; Col += One) {
                const Piece = BoardState[Row][Col];
                if (Piece === '' || this.IsWhitePiece(Piece) !== ByWhite || Piece.toUpperCase() === 'P') {
                    continue;
                }
                const CandidateMoves = [];
                this.AppendPieceMoves(BoardState, Row, Col, Piece, ByWhite, false, CandidateMoves);
                for (let Index = Zero; Index < CandidateMoves.length; Index += One) {
                    if (CandidateMoves[Index].slice(Two, Four) === TargetSquare) {
                        return true;
                    }
                }
            }
        }

        // Returns false when no opposing piece attacks the square.
        return false;
    }

    // Returns a new 8x8 board array with the specified UCI move applied.
    SimulateMoveOnBoard(BoardState, MoveUci) {
        // Clones the board and extracts move coordinates.
        const NextBoard = this.CloneBoard(BoardState);
        const Coords = this.ParseUci(MoveUci);
        const MovingPiece = NextBoard[Coords.FromRow][Coords.FromCol];
        const PieceUpper = MovingPiece.toUpperCase();
        const IsWhite = MovingPiece === PieceUpper;

        // Removes the captured pawn when simulating an en passant capture.
        if (PieceUpper === 'P' && Coords.FromCol !== Coords.ToCol && NextBoard[Coords.ToRow][Coords.ToCol] === '') {
            const CapturedRow = IsWhite ? Coords.ToRow + One : Coords.ToRow - One;
            NextBoard[CapturedRow][Coords.ToCol] = '';
        }

        // Moves the rook when simulating a castling move.
        if (PieceUpper === 'K' && Math.abs(Coords.ToCol - Coords.FromCol) === Two) {
            if (Coords.ToCol === Six) {
                NextBoard[Coords.FromRow][Five] = NextBoard[Coords.FromRow][Seven];
                NextBoard[Coords.FromRow][Seven] = '';
            } else if (Coords.ToCol === Two) {
                NextBoard[Coords.FromRow][Three] = NextBoard[Coords.FromRow][Zero];
                NextBoard[Coords.FromRow][Zero] = '';
            }
        }

        // Places the moved or promoted piece on the destination square.
        let PlacedPiece = MovingPiece;
        if (Coords.Promotion !== '') {
            PlacedPiece = IsWhite ? Coords.Promotion.toUpperCase() : Coords.Promotion.toLowerCase();
        }
        NextBoard[Coords.ToRow][Coords.ToCol] = PlacedPiece;
        NextBoard[Coords.FromRow][Coords.FromCol] = '';

        // Returns the resulting simulated board.
        return NextBoard;
    }

    // Creates a deep copy of an 8x8 board matrix.
    CloneBoard(BoardState) {
        // Copies each row slice into a new outer array.
        const Copy = [];
        for (let Row = Zero; Row < Eight; Row += One) {
            Copy.push(BoardState[Row].slice());
        }
        return Copy;
    }

    // Generates the standard FEN string representing the current position.
    GenerateFen() {
        // Encodes each board rank into FEN piece placement notation.
        const RankStrings = [];
        for (let Row = Zero; Row < Eight; Row += One) {
            let EmptyCount = Zero;
            let RankText = '';
            for (let Col = Zero; Col < Eight; Col += One) {
                const Piece = this.Board[Row][Col];
                if (Piece === '') {
                    EmptyCount += One;
                } else {
                    if (EmptyCount > Zero) {
                        RankText += String(EmptyCount);
                        EmptyCount = Zero;
                    }
                    RankText += Piece;
                }
            }
            if (EmptyCount > Zero) {
                RankText += String(EmptyCount);
            }
            RankStrings.push(RankText);
        }

        // Formats active color, castling rights, en passant square, and move counters.
        const Placement = RankStrings.join('/');
        const ActiveColor = this.WhiteTurn ? 'w' : 'b';
        let Castling = '';
        if (this.WhiteKingSide) {
            Castling += 'K';
        }
        if (this.WhiteQueenSide) {
            Castling += 'Q';
        }
        if (this.BlackKingSide) {
            Castling += 'k';
        }
        if (this.BlackQueenSide) {
            Castling += 'q';
        }
        if (Castling === '') {
            Castling = '-';
        }
        const EnPassant = this.EnPassantRow === NegativeOne ? '-' : this.CoordsToSquare(this.EnPassantRow, this.EnPassantCol);

        // Combines all six FEN fields into a single string.
        return `${Placement} ${ActiveColor} ${Castling} ${EnPassant} ${this.HalfMoveClock} ${this.FullMoveNumber}`;
    }

    // Parses a UCI move string into board row/column indices and promotion character.
    ParseUci(MoveUci) {
        // Converts file letters and rank digits into 0-based matrix indices.
        const FromCol = FileLetters.indexOf(MoveUci[Zero]);
        const FromRow = Eight - Number(MoveUci[One]);
        const ToCol = FileLetters.indexOf(MoveUci[Two]);
        const ToRow = Eight - Number(MoveUci[Three]);
        const Promotion = MoveUci.length > Four ? MoveUci[Four] : '';
        return {
            FromRow: FromRow,
            FromCol: FromCol,
            ToRow: ToRow,
            ToCol: ToCol,
            Promotion: Promotion
        };
    }

    // Converts 0-based board coordinates into a two-character algebraic square name.
    CoordsToSquare(Row, Col) {
        // Concatenates the file letter and rank number.
        return FileLetters[Col] + String(Eight - Row);
    }

    // Checks whether (Row, Col) lies within the 8x8 board boundaries.
    IsInsideBoard(Row, Col) {
        // Verifies that both row and column are between 0 and 7 inclusive.
        return Row >= Zero && Row < Eight && Col >= Zero && Col < Eight;
    }

    // Checks whether a non-empty piece character belongs to White.
    IsWhitePiece(Piece) {
        // Compares the character to its uppercase form.
        return Piece !== '' && Piece === Piece.toUpperCase();
    }

    // Returns the four diagonal direction vectors for bishops.
    GetBishopDirections() {
        // Lists northeast, northwest, southeast, and southwest steps.
        return [
            [NegativeOne, NegativeOne],
            [NegativeOne, One],
            [One, NegativeOne],
            [One, One]
        ];
    }

    // Returns the four orthogonal direction vectors for rooks.
    GetRookDirections() {
        // Lists north, south, west, and east steps.
        return [
            [NegativeOne, Zero],
            [One, Zero],
            [Zero, NegativeOne],
            [Zero, One]
        ];
    }

    // Returns all eight direction vectors for queens and kings.
    GetQueenDirections() {
        // Combines bishop and rook direction vectors.
        return [
            [NegativeOne, NegativeOne],
            [NegativeOne, Zero],
            [NegativeOne, One],
            [Zero, NegativeOne],
            [Zero, One],
            [One, NegativeOne],
            [One, Zero],
            [One, One]
        ];
    }
}
