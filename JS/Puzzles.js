// Defines local tactical puzzle constants, storage keys, and curated puzzle bank.
const PuzzleStatsStorageKey = 'ValexChessPuzzleStats_v1';
const PuzzleReplyDelayMs = 450;
const MsPerDay = 86400000;
const PuzzleBank = [
    {
        Title: 'Back Rank Mate',
        Rating: 750,
        Theme: 'Mate in 1',
        Fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
        Pgn: '1. Re8#'
    },
    {
        Title: 'Scholar Finish',
        Rating: 650,
        Theme: 'Mate in 1',
        Fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1',
        Pgn: '1. Qxf7#'
    },
    {
        Title: 'Queen & King Corner Mate',
        Rating: 750,
        Theme: 'Mate in 1',
        Fen: '7k/5Q2/6K1/8/8/8/8/8 w - - 0 1',
        Pgn: '1. Qg7#'
    },
    {
        Title: 'Smothered Knight Mate',
        Rating: 1150,
        Theme: 'Smothered Mate',
        Fen: '6rk/5Npp/8/8/8/8/5PPP/6K1 w - - 0 1',
        Pgn: '1. Nh6'
    },
    {
        Title: 'Greek Gift Sacrifice',
        Rating: 1350,
        Theme: 'Attack',
        Fen: 'r1bq1rk1/ppp2ppp/2n5/3p4/3P4/2PB1N2/PP3PPP/R2Q1RK1 w - - 0 1',
        Pgn: '1. Bxh7+ Kxh7 2. Ng5+'
    },
    {
        Title: 'Royal Knight Fork',
        Rating: 950,
        Theme: 'Fork',
        Fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1',
        Pgn: '1. Nxe5'
    },
    {
        Title: 'Queen Sacrifice Back Rank',
        Rating: 1450,
        Theme: 'Mate in 2',
        Fen: '3r2k1/5ppp/8/8/8/8/1Q3PPP/3R2K1 w - - 0 1',
        Pgn: '1. Rxd8#'
    },
    {
        Title: 'Arabian Mate',
        Rating: 1250,
        Theme: 'Mate in 1',
        Fen: '7k/R7/5N2/8/8/8/6PP/6K1 w - - 0 1',
        Pgn: '1. Rh7#'
    },
    {
        Title: 'Double Rook Roller',
        Rating: 850,
        Theme: 'Mate in 2',
        Fen: '6k1/R7/8/1R6/8/8/6PP/6K1 w - - 0 1',
        Pgn: '1. Rb8#'
    },
    {
        Title: 'Opera Mate Pattern',
        Rating: 1350,
        Theme: 'Mate in 2',
        Fen: '4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 0 1',
        Pgn: '1. Qb8+ Nxb8 2. Rd8#'
    },
    {
        Title: 'Black Back Rank Strike',
        Rating: 950,
        Theme: 'Mate in 1',
        Fen: '4r1k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1',
        Pgn: '1... Re1#'
    },
    {
        Title: 'Black Queen Battery Mate',
        Rating: 1050,
        Theme: 'Mate in 1',
        Fen: '6k1/5ppp/8/8/2b5/8/5PPP/3q2K1 b - - 0 1',
        Pgn: '1... Qf1#'
    },
    {
        Title: 'Diagonal Pin Win',
        Rating: 1150,
        Theme: 'Pin',
        Fen: 'r2qk2r/ppp2ppp/2n5/3np3/2B5/5Q2/PPPP1PPP/RNB1K2R w KQkq - 0 1',
        Pgn: '1. Bxd5'
    },
    {
        Title: 'Rook Lift Checkmate',
        Rating: 1550,
        Theme: 'Mate in 2',
        Fen: '5rk1/5ppp/8/8/8/7Q/5PPP/4R1K1 w - - 0 1',
        Pgn: '1. Re8 Rxe8'
    },
    {
        Title: 'Black Knight Fork',
        Rating: 1050,
        Theme: 'Fork',
        Fen: '6k1/5ppp/8/8/3n4/8/2Q2PPP/4K3 b - - 0 1',
        Pgn: '1... Nxc2+'
    }
];

// Manages self-contained tactical puzzles, daily rotation, and local streak statistics.
class PuzzleManager {
    Initialize() {
        // Loads persisted puzzle streak and solved count from localStorage.
        this.LastRandomIndex = NegativeOne;
        this.Stats = this.LoadStats();
    }

    // Reads saved puzzle streak and solved count from localStorage.
    LoadStats() {
        // Safely parses stored JSON stats or returns zeroed defaults.
        if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
            return { Streak: Zero, BestStreak: Zero, Solved: Zero };
        }
        try {
            const Raw = localStorage.getItem(PuzzleStatsStorageKey);
            if (!Raw) {
                return { Streak: Zero, BestStreak: Zero, Solved: Zero };
            }
            const Parsed = JSON.parse(Raw);
            return {
                Streak: Number(Parsed.Streak) || Zero,
                BestStreak: Number(Parsed.BestStreak) || Zero,
                Solved: Number(Parsed.Solved) || Zero
            };
        } catch (Error) {
            return { Streak: Zero, BestStreak: Zero, Solved: Zero };
        }
    }

    // Persists updated puzzle statistics to localStorage.
    SaveStats() {
        // Writes the JSON stats object when localStorage is available.
        if (typeof localStorage === 'undefined' || typeof localStorage.setItem !== 'function') {
            return;
        }
        try {
            localStorage.setItem(PuzzleStatsStorageKey, JSON.stringify(this.Stats));
        } catch (Error) {
            // Ignores storage quota errors.
        }
    }

    // Increments solved count and streak when a puzzle is completed cleanly.
    RecordSolved(UsedHintOrMistake) {
        // Increments Solved always and updates Streak when solved without mistakes.
        this.Stats.Solved += One;
        if (!UsedHintOrMistake) {
            this.Stats.Streak += One;
            if (this.Stats.Streak > this.Stats.BestStreak) {
                this.Stats.BestStreak = this.Stats.Streak;
            }
        }
        this.SaveStats();
    }

    // Resets the active puzzle streak after a wrong move.
    ResetStreak() {
        // Sets current Streak to zero while preserving BestStreak and Solved.
        this.Stats.Streak = Zero;
        this.SaveStats();
    }

    // Selects and parses either today's Daily Puzzle or a non-repeating Random Puzzle.
    FetchPuzzle(IsDaily) {
        // Picks deterministically by calendar day for Daily, or randomly for Random mode.
        if (IsDaily) {
            const DayIndex = Math.floor(Date.now() / MsPerDay) % PuzzleBank.length;
            return this.ParsePuzzlePayload(PuzzleBank[DayIndex], true);
        }
        let Pick = Math.floor(Math.random() * PuzzleBank.length);
        if (PuzzleBank.length > One && Pick === this.LastRandomIndex) {
            Pick = (Pick + One) % PuzzleBank.length;
        }
        this.LastRandomIndex = Pick;
        return this.ParsePuzzlePayload(PuzzleBank[Pick], false);
    }

    // Converts a local puzzle entry (FEN + PGN) into validated UCI solution moves.
    ParsePuzzlePayload(RawData, IsDaily) {
        // Validates presence of FEN and PGN strings in the puzzle entry.
        if (!RawData || typeof RawData.Fen !== 'string' || typeof RawData.Pgn !== 'string') {
            return null;
        }
        const SanTokens = this.ExtractSanTokensFromPgn(RawData.Pgn);
        if (SanTokens.length === Zero) {
            return null;
        }

        // Steps through each SAN move on a scratch ChessGame to derive exact UCI moves.
        const Scratch = new ChessGame();
        Scratch.Initialize();
        Scratch.Start(DefaultBotElo, '', One, 'w', false, true);
        if (!Scratch.LoadFen(RawData.Fen)) {
            return null;
        }
        const SideToMove = Scratch.WhiteTurn ? 'w' : 'b';
        const SolutionUci = [];
        for (let Index = Zero; Index < SanTokens.length; Index += One) {
            const MatchedUci = this.ResolveSanToUci(Scratch, SanTokens[Index]);
            if (!MatchedUci) {
                break;
            }
            SolutionUci.push(MatchedUci);
            Scratch.PlayerMove(MatchedUci);
        }
        if (SolutionUci.length === Zero) {
            return null;
        }
        return {
            Title: String(RawData.Title || 'Tactical Puzzle').trim(),
            Rating: Number(RawData.Rating) || DefaultBotElo,
            Theme: String(RawData.Theme || 'Tactics').trim(),
            Fen: RawData.Fen.trim(),
            SideToMove: SideToMove,
            SolutionUci: SolutionUci,
            IsDaily: Boolean(IsDaily)
        };
    }

    // Extracts clean ordered SAN move tokens from a PGN string.
    ExtractSanTokensFromPgn(PgnText) {
        // Strips tag headers, comments, variations, NAGs, move numbers, and result markers.
        let Body = String(PgnText || '');
        Body = Body.replace(/\[[^\]]*\]/g, ' ');
        Body = Body.replace(/\{[^}]*\}/g, ' ');
        let Prev = '';
        while (Prev !== Body) {
            Prev = Body;
            Body = Body.replace(/\([^()]*\)/g, ' ');
        }
        Body = Body.replace(/\$\d+/g, ' ');
        Body = Body.replace(/\d+\.(\.\.)?/g, ' ');
        const RawTokens = Body.trim().split(/\s+/);
        const ResultTokens = ['1-0', '0-1', '1/2-1/2', '*'];
        const CleanTokens = [];
        for (let Index = Zero; Index < RawTokens.length; Index += One) {
            const Token = RawTokens[Index].trim();
            if (Token === '' || ResultTokens.includes(Token)) {
                continue;
            }
            CleanTokens.push(Token.replace(/^0-0-0/, 'O-O-O').replace(/^0-0/, 'O-O'));
        }
        return CleanTokens;
    }

    // Matches a single SAN move string against legal moves in the current Scratch position.
    ResolveSanToUci(ScratchGame, SanToken) {
        // Compares normalized SAN strings against ChessGame.FormatMoveAsSan output.
        const Wanted = SanToken.replace(/[+#!?]+$/g, '');
        const LegalMoves = ScratchGame.GetState().LegalMoves;
        for (let Index = Zero; Index < LegalMoves.length; Index += One) {
            const CandidateUci = LegalMoves[Index];
            const CandidateSan = ScratchGame.FormatMoveAsSan(CandidateUci).replace(/[+#!?]+$/g, '');
            if (CandidateSan === Wanted) {
                return CandidateUci;
            }
        }
        return '';
    }
}
