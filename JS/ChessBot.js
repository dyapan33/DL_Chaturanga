// Defines material and positional evaluation constants for the chess bot.
const PawnValue = 100;
const KnightValue = 320;
const BishopValue = 330;
const RookValue = 500;
const QueenValue = 900;
const KingValue = 20000;
const MateScore = 90000;
const InfinityScore = 999999;
const CenterBonus = 15;
const InnerCenterBonus = 25;
const PawnAdvanceBonus = 10;
const DevelopmentBonus = 15;
const CaptureOrderMultiplier = 10;
const PromotionOrderBonus = 800;
const LowEloThreshold = 500;
const MidLowEloThreshold = 1100;
const MidHighEloThreshold = 1900;
const MaxNoiseScale = 350;
const EloSpan = 2600;
const MinBotDelayMs = 450;
const MaxBotDelayMs = 1150;
const StockfishCdnUrl = 'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js';
const StockfishTimeoutMs = 5500;
const MaxStockfishSkill = 20;
const StockfishBaseDepth = 3;
const StockfishDepthScale = 230;
const StockfishMaxDepth = 15;
const StockfishBaseTimeMs = 250;
const StockfishMaxTimeMs = 1550;

// Maps piece types to their centipawn material scores.
const PieceMaterialMap = {
    P: PawnValue,
    N: KnightValue,
    B: BishopValue,
    R: RookValue,
    Q: QueenValue,
    K: KingValue
};

// Selects moves for the bot side using Stockfish Web Worker scaled by Elo (1 to 2700).
class ChessBot {
    Initialize() {
        // Initializes default Elo state and boots the Stockfish Web Worker.
        this.EloRating = DefaultBotElo;
        this.EngineWorker = null;
        this.EngineReady = false;
        this.PendingCallback = null;
        this.PendingTimeoutId = null;
        this.InitStockfishWorker();
    }

    // Spawns a single-threaded Stockfish Web Worker via a same-origin Blob wrapper.
    InitStockfishWorker() {
        // Skips worker creation in non-browser environments without Worker or Blob.
        if (typeof Worker !== 'function' || typeof Blob !== 'function' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
            return;
        }
        try {
            const Bootstrap = `importScripts('${StockfishCdnUrl}');`;
            const WorkerBlob = new Blob([Bootstrap], { type: 'application/javascript' });
            const WorkerUrl = URL.createObjectURL(WorkerBlob);
            const WorkerObj = new Worker(WorkerUrl);
            this.EngineWorker = WorkerObj;
            WorkerObj.onmessage = (Event) => {
                const Line = typeof Event === 'string' ? Event : (Event && typeof Event.data === 'string' ? Event.data : '');
                this.HandleStockfishLine(Line);
            };
            WorkerObj.onerror = () => {
                this.EngineReady = false;
                this.EngineWorker = null;
            };
            WorkerObj.postMessage('uci');
        } catch (Error) {
            this.EngineWorker = null;
            this.EngineReady = false;
        }
    }

    // Processes UCI output lines emitted by the Stockfish Web Worker.
    HandleStockfishLine(Line) {
        // Marks the engine ready on uciok and resolves pending searches on bestmove.
        if (!Line) {
            return;
        }
        if (Line.includes('uciok')) {
            this.EngineReady = true;
            return;
        }
        if (Line.startsWith('bestmove ')) {
            const Parts = Line.trim().split(/\s+/);
            const BestMove = Parts.length > One ? Parts[One] : '';
            const Callback = this.PendingCallback;
            this.ClearPendingSearch();
            if (Callback) {
                Callback(BestMove);
            }
        }
    }

    // Clears any active Stockfish search callback and fallback timeout.
    ClearPendingSearch() {
        // Resets PendingCallback and cancels PendingTimeoutId if scheduled.
        this.PendingCallback = null;
        if (this.PendingTimeoutId !== null) {
            clearTimeout(this.PendingTimeoutId);
            this.PendingTimeoutId = null;
        }
    }

    // Computes a Stockfish Skill Level (0 to 20) proportional to the bot's Elo rating.
    ComputeStockfishSkill(EloRating) {
        // Maps Elo from BotFirstElo..BotLastElo linearly onto 0..MaxStockfishSkill.
        const Ratio = Math.max(Zero, Math.min(One, (EloRating - BotFirstElo) / EloSpan));
        return Math.round(Ratio * MaxStockfishSkill);
    }

    // Computes Stockfish search depth and movetime scaled by Elo rating.
    ComputeStockfishLimits(EloRating) {
        // Scales depth from 3 to 15 and movetime from 250ms to 1550ms.
        const RawDepth = StockfishBaseDepth + Math.floor(EloRating / StockfishDepthScale);
        const Depth = Math.max(One, Math.min(StockfishMaxDepth, RawDepth));
        const Ratio = Math.max(Zero, Math.min(One, (EloRating - BotFirstElo) / EloSpan));
        const MoveTimeMs = Math.round(StockfishBaseTimeMs + Ratio * (StockfishMaxTimeMs - StockfishBaseTimeMs));
        return { Depth: Depth, MoveTimeMs: MoveTimeMs };
    }

    // Chooses a move asynchronously using Stockfish, falling back to local search if offline.
    ChooseMoveAsync(GameInstance, EloRating, BotIsWhite, OnResult) {
        // Handles single-move, Ella (1 Elo), and offline fallback cases immediately.
        const ForWhite = Boolean(BotIsWhite);
        const LegalMoves = GameInstance.GenerateLegalMoves(ForWhite);
        if (LegalMoves.length === Zero) {
            OnResult(null);
            return;
        }
        if (LegalMoves.length === One) {
            OnResult(LegalMoves[Zero]);
            return;
        }
        if (EloRating <= EllaBotElo) {
            const RandomIndex = Math.floor(Math.random() * LegalMoves.length);
            OnResult(LegalMoves[RandomIndex]);
            return;
        }
        if (!this.EngineWorker || !this.EngineReady) {
            OnResult(this.ChooseMove(GameInstance, EloRating, BotIsWhite));
            return;
        }

        // Sends Elo-scaled Stockfish UCI commands with a timeout fallback.
        this.ClearPendingSearch();
        const Fen = GameInstance.GenerateFen();
        const Skill = this.ComputeStockfishSkill(EloRating);
        const Limits = this.ComputeStockfishLimits(EloRating);
        this.PendingCallback = (EngineMove) => {
            if (EngineMove && LegalMoves.includes(EngineMove)) {
                OnResult(EngineMove);
                return;
            }
            OnResult(this.ChooseMove(GameInstance, EloRating, BotIsWhite));
        };
        this.PendingTimeoutId = setTimeout(() => {
            const Callback = this.PendingCallback;
            this.ClearPendingSearch();
            if (Callback) {
                Callback('');
            }
        }, StockfishTimeoutMs);
        try {
            this.EngineWorker.postMessage('stop');
            this.EngineWorker.postMessage(`setoption name Skill Level value ${Skill}`);
            this.EngineWorker.postMessage(`position fen ${Fen}`);
            this.EngineWorker.postMessage(`go depth ${Limits.Depth} movetime ${Limits.MoveTimeMs}`);
        } catch (Error) {
            this.ClearPendingSearch();
            OnResult(this.ChooseMove(GameInstance, EloRating, BotIsWhite));
        }
    }

    // Returns a short natural thinking delay before triggering the bot move.
    GetThinkingDelay() {
        // Computes a uniform random duration in milliseconds within [MinBotDelayMs, MaxBotDelayMs].
        const Span = MaxBotDelayMs - MinBotDelayMs;
        return Math.floor(MinBotDelayMs + Math.random() * Span);
    }

    // Chooses a legal UCI move for the bot's color given the active ChessGame instance.
    ChooseMove(GameInstance, EloRating, BotIsWhite) {
        // Retrieves all legal moves for the bot side and exits if none are available.
        const ForWhite = Boolean(BotIsWhite);
        const LegalMoves = GameInstance.GenerateLegalMoves(ForWhite);
        if (LegalMoves.length === Zero) {
            return null;
        }
        if (LegalMoves.length === One) {
            return LegalMoves[Zero];
        }
        if (EloRating <= EllaBotElo) {
            const RandomIndex = Math.floor(Math.random() * LegalMoves.length);
            return LegalMoves[RandomIndex];
        }

        // Determines search depth and evaluation noise from the requested Elo rating.
        const SearchDepth = this.DetermineDepth(EloRating);
        const NoiseAmount = this.DetermineNoise(EloRating);
        const OrderedMoves = this.OrderMoves(GameInstance, GameInstance.Board, LegalMoves);

        // Evaluates each root candidate move using alpha-beta minimax search.
        let BestMove = OrderedMoves[Zero];
        let BestScore = ForWhite ? -InfinityScore : InfinityScore;
        const Alpha = -InfinityScore;
        const Beta = InfinityScore;
        for (let Index = Zero; Index < OrderedMoves.length; Index += One) {
            const Candidate = OrderedMoves[Index];
            const NextBoard = GameInstance.SimulateMoveOnBoard(GameInstance.Board, Candidate);
            const RawScore = this.AlphaBeta(
                GameInstance,
                NextBoard,
                SearchDepth - One,
                Alpha,
                Beta,
                !ForWhite
            );
            const Jitter = (Math.random() - (One / Two)) * NoiseAmount;
            const FinalScore = RawScore + Jitter;
            if (ForWhite ? (FinalScore > BestScore) : (FinalScore < BestScore)) {
                BestScore = FinalScore;
                BestMove = Candidate;
            }
        }

        // Returns the move that achieved the best score for the bot's side.
        return BestMove;
    }

    // Computes the search depth in plies based on the bot's Elo rating.
    DetermineDepth(EloRating) {
        // Assigns deeper search plies as the Elo rating increases.
        if (EloRating <= LowEloThreshold) {
            return One;
        }
        if (EloRating <= MidLowEloThreshold) {
            return Two;
        }
        if (EloRating <= MidHighEloThreshold) {
            return Three;
        }
        return Three;
    }

    // Computes the random centipawn noise range to simulate lower Elo blunders.
    DetermineNoise(EloRating) {
        // Scales noise linearly from MaxNoiseScale at 100 Elo down to 0 at 2700 Elo.
        const Clamped = Math.max(BotFirstElo, Math.min(BotLastElo, EloRating));
        const Ratio = (BotLastElo - Clamped) / EloSpan;
        return Ratio * MaxNoiseScale;
    }

    // Executes minimax search with alpha-beta pruning from the given board state.
    AlphaBeta(GameInstance, BoardState, Depth, Alpha, Beta, MaximizingWhite) {
        // Evaluates the board statically once the depth limit is reached.
        if (Depth <= Zero) {
            return this.EvaluateBoard(BoardState);
        }

        // Generates legal moves for the active side on the simulated board.
        const CandidateMoves = this.GenerateLegalForSearch(GameInstance, BoardState, MaximizingWhite);
        if (CandidateMoves.length === Zero) {
            if (GameInstance.IsKingInCheck(BoardState, MaximizingWhite)) {
                return MaximizingWhite ? -MateScore - Depth : MateScore + Depth;
            }
            return Zero;
        }

        // Orders candidate moves to improve alpha-beta cutoff efficiency.
        const Ordered = this.OrderMoves(GameInstance, BoardState, CandidateMoves);
        if (MaximizingWhite) {
            return this.SearchMaxNode(GameInstance, BoardState, Ordered, Depth, Alpha, Beta);
        }
        return this.SearchMinNode(GameInstance, BoardState, Ordered, Depth, Alpha, Beta);
    }

    // Evaluates a maximizing (White) node within alpha-beta search.
    SearchMaxNode(GameInstance, BoardState, OrderedMoves, Depth, Alpha, Beta) {
        // Iterates through moves to maximize the evaluation score for White.
        let BestValue = -InfinityScore;
        let CurrentAlpha = Alpha;
        for (let Index = Zero; Index < OrderedMoves.length; Index += One) {
            const NextBoard = GameInstance.SimulateMoveOnBoard(BoardState, OrderedMoves[Index]);
            const Score = this.AlphaBeta(GameInstance, NextBoard, Depth - One, CurrentAlpha, Beta, false);
            if (Score > BestValue) {
                BestValue = Score;
            }
            if (BestValue > CurrentAlpha) {
                CurrentAlpha = BestValue;
            }
            if (Beta <= CurrentAlpha) {
                break;
            }
        }

        // Returns the highest score found for White.
        return BestValue;
    }

    // Evaluates a minimizing (Black) node within alpha-beta search.
    SearchMinNode(GameInstance, BoardState, OrderedMoves, Depth, Alpha, Beta) {
        // Iterates through moves to minimize the evaluation score for Black.
        let BestValue = InfinityScore;
        let CurrentBeta = Beta;
        for (let Index = Zero; Index < OrderedMoves.length; Index += One) {
            const NextBoard = GameInstance.SimulateMoveOnBoard(BoardState, OrderedMoves[Index]);
            const Score = this.AlphaBeta(GameInstance, NextBoard, Depth - One, Alpha, CurrentBeta, true);
            if (Score < BestValue) {
                BestValue = Score;
            }
            if (BestValue < CurrentBeta) {
                CurrentBeta = BestValue;
            }
            if (CurrentBeta <= Alpha) {
                break;
            }
        }

        // Returns the lowest score found for Black.
        return BestValue;
    }

    // Generates legal moves on an arbitrary board matrix during search.
    GenerateLegalForSearch(GameInstance, BoardState, ForWhite) {
        // Filters pseudo-legal moves so the moving side's king is not left in check.
        const PseudoMoves = GameInstance.GeneratePseudoMoves(BoardState, ForWhite, false);
        const LegalMoves = [];
        for (let Index = Zero; Index < PseudoMoves.length; Index += One) {
            const MoveUci = PseudoMoves[Index];
            const NextBoard = GameInstance.SimulateMoveOnBoard(BoardState, MoveUci);
            if (!GameInstance.IsKingInCheck(NextBoard, ForWhite)) {
                LegalMoves.push(MoveUci);
            }
        }

        // Returns the filtered legal move array.
        return LegalMoves;
    }

    // Sorts moves so captures and promotions are searched first.
    OrderMoves(GameInstance, BoardState, Moves) {
        // Scores each move using Most Valuable Victim - Least Valuable Attacker heuristics.
        const ScoredMoves = [];
        for (let Index = Zero; Index < Moves.length; Index += One) {
            const MoveUci = Moves[Index];
            const Priority = this.ScoreMovePriority(GameInstance, BoardState, MoveUci);
            ScoredMoves.push({ Move: MoveUci, Priority: Priority });
        }

        // Sorts moves in descending order of priority and extracts the UCI strings.
        ScoredMoves.sort((First, Second) => Second.Priority - First.Priority);
        const Result = [];
        for (let Index = Zero; Index < ScoredMoves.length; Index += One) {
            Result.push(ScoredMoves[Index].Move);
        }
        return Result;
    }

    // Computes a move-ordering heuristic score for a single UCI move.
    ScoreMovePriority(GameInstance, BoardState, MoveUci) {
        // Extracts source and destination pieces from the board.
        const Coords = GameInstance.ParseUci(MoveUci);
        const Attacker = BoardState[Coords.FromRow][Coords.FromCol].toUpperCase();
        const Victim = BoardState[Coords.ToRow][Coords.ToCol].toUpperCase();
        let Score = Zero;

        // Rewards captures of valuable pieces by cheaper pieces and pawn promotions.
        if (Victim !== '') {
            const VictimScore = PieceMaterialMap[Victim] || Zero;
            const AttackerScore = PieceMaterialMap[Attacker] || PawnValue;
            Score += VictimScore * CaptureOrderMultiplier - AttackerScore;
        }
        if (Coords.Promotion !== '') {
            Score += PromotionOrderBonus;
        }

        // Returns the computed ordering priority.
        return Score;
    }

    // Computes a static centipawn evaluation of the board (positive favors White).
    EvaluateBoard(BoardState) {
        // Sums material and positional bonuses across all 64 squares.
        let TotalScore = Zero;
        for (let Row = Zero; Row < Eight; Row += One) {
            for (let Col = Zero; Col < Eight; Col += One) {
                const Piece = BoardState[Row][Col];
                if (Piece === '') {
                    continue;
                }
                const SquareScore = this.EvaluateSquarePiece(Piece, Row, Col);
                if (Piece === Piece.toUpperCase()) {
                    TotalScore += SquareScore;
                } else {
                    TotalScore -= SquareScore;
                }
            }
        }

        // Returns the net evaluation score.
        return TotalScore;
    }

    // Computes the material plus positional value of a single piece at (Row, Col).
    EvaluateSquarePiece(Piece, Row, Col) {
        // Looks up the base material score for the piece type.
        const Upper = Piece.toUpperCase();
        const IsWhite = Piece === Upper;
        let Value = PieceMaterialMap[Upper] || Zero;

        // Adds positional bonuses for center control, pawn advancement, and piece activity.
        if (Row >= Two && Row <= Five && Col >= Two && Col <= Five) {
            Value += CenterBonus;
            if (Row >= Three && Row <= Four && Col >= Three && Col <= Four) {
                Value += InnerCenterBonus;
            }
        }
        if (Upper === 'P') {
            const Advancement = IsWhite ? (Six - Row) : (Row - One);
            Value += Advancement * PawnAdvanceBonus;
        } else if (Upper === 'N' || Upper === 'B') {
            const HomeRow = IsWhite ? Seven : Zero;
            if (Row !== HomeRow) {
                Value += DevelopmentBonus;
            }
        }

        // Returns the combined piece value.
        return Value;
    }
}


