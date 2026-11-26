// Defines Elo-tiered local tactical puzzles, storage keys, and reply timings.
const PuzzleStatsStorageKey = 'ValexChessPuzzleStats_v1';
const PuzzleReplyDelayMs = 450;
const MsPerDay = 86400000;
const DefaultPuzzleEloTier = '1300';
const PuzzleEloTiers = [
    { Key: '800', Label: 'Beginner (600 - 1000 Elo)' },
    { Key: '1300', Label: 'Intermediate (1100 - 1500 Elo)' },
    { Key: '1800', Label: 'Advanced (1600 - 2000 Elo)' },
    { Key: '2300', Label: 'Master (2100 - 2500 Elo)' }
];
const PuzzleBank = [
    {
        Tier: '800',
        Title: 'Back Rank Mate',
        Rating: 750,
        Theme: 'Mate in 1',
        Fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
        Pgn: '1. Re8#'
    },
    {
        Tier: '800',
        Title: 'Queen & King Corner Mate',
        Rating: 750,
        Theme: 'Mate in 1',
        Fen: '7k/5Q2/6K1/8/8/8/8/8 w - - 0 1',
        Pgn: '1. Qg7#'
    },
    {
        Tier: '800',
        Title: 'Black Back Rank Strike',
        Rating: 850,
        Theme: 'Mate in 1',
        Fen: '4r1k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1',
        Pgn: '1... Re1#'
    },
    {
        Tier: '800',
        Title: 'Black Queen Battery Mate',
        Rating: 950,
        Theme: 'Mate in 1',
        Fen: '6k1/5ppp/8/8/2b5/8/5PPP/3q2K1 b - - 0 1',
        Pgn: '1... Qf1#'
    },
    {
        Tier: '1300',
        Title: 'Opera Mate Pattern',
        Rating: 1350,
        Theme: 'Queen Sacrifice',
        Fen: '4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 0 1',
        Pgn: '1. Qb8+ Nxb8 2. Rd8#'
    },
    {
        Tier: '1300',
        Title: 'Greek Gift Sacrifice',
        Rating: 1350,
        Theme: 'King Attack',
        Fen: 'r1bq1rk1/ppp2ppp/2n5/3p4/3P4/2PB1N2/PP3PPP/R2Q1RK1 w - - 0 1',
        Pgn: '1. Bxh7+ Kxh7 2. Ng5+'
    },
    {
        Tier: '1300',
        Title: 'Arabian Corner Finish',
        Rating: 1250,
        Theme: 'Mate in 1',
        Fen: '7k/R7/5N2/8/8/8/6PP/6K1 w - - 0 1',
        Pgn: '1. Rh7#'
    },
    {
        Tier: '1300',
        Title: 'Knight Fork Win',
        Rating: 1150,
        Theme: 'Royal Fork',
        Fen: '6k1/5ppp/8/8/3n4/8/2Q2PPP/4K3 b - - 0 1',
        Pgn: '1... Nxc2+'
    },
    {
        Tier: '1800',
        Title: 'Philidor Smothered Mate',
        Rating: 1850,
        Theme: 'Smothered Mate',
        Fen: 'r4rk1/ppp2Npp/8/8/8/1Q6/PPP2PPP/R5K1 w - - 0 1',
        Pgn: '1. Nh6+ Kh8 2. Qg8+ Rxg8 3. Nf7#'
    },
    {
        Tier: '1800',
        Title: 'Anastasia Mate Sacrifice',
        Rating: 1750,
        Theme: 'Mate in 3',
        Fen: '5rk1/1p3ppp/p7/5N2/8/7Q/PPP2PPP/2K1R3 w - - 0 1',
        Pgn: '1. Ne7+ Kh8 2. Qxh7+ Kxh7 3. Rh1#'
    },
    {
        Tier: '1800',
        Title: 'Boden Crossfire Mate',
        Rating: 1850,
        Theme: 'Queen Sacrifice',
        Fen: '2kr3r/pp1n1ppp/2p1p3/q7/1b1P4/2NB1Q2/PPP2PPP/2KR3R w - - 0 1',
        Pgn: '1. Qxc6+ bxc6 2. Ba6#'
    },
    {
        Tier: '1800',
        Title: 'Back Rank Deflection',
        Rating: 1650,
        Theme: 'Deflection',
        Fen: '3r2k1/5ppp/8/8/8/8/1Q3PPP/3R2K1 w - - 0 1',
        Pgn: '1. Rxd8#'
    },
    {
        Tier: '2300',
        Title: 'Damiano Queen Sacrifice',
        Rating: 2250,
        Theme: 'Mate in 3',
        Fen: '5rk1/5p1p/5Pp1/8/8/7Q/6PP/4R1K1 w - - 0 1',
        Pgn: '1. Qh6 Kh8 2. Qg7#'
    },
    {
        Tier: '2300',
        Title: 'Double Rook Clearance',
        Rating: 2350,
        Theme: 'Mate in 3',
        Fen: 'r3r1k1/5ppp/8/8/8/6Q1/4RPPP/4R1K1 w - - 0 1',
        Pgn: '1. Rxe8+ Rxe8 2. Rxe8#'
    },
    {
        Tier: '2300',
        Title: 'Back Rank Queen Sacrifice',
        Rating: 2250,
        Theme: 'Mate in 2',
        Fen: 'r3r1k1/pp3ppp/8/8/8/4Q3/PPP2PPP/4R1K1 w - - 0 1',
        Pgn: '1. Qxe8+ Rxe8 2. Rxe8#'
    },
    {
        Tier: '2300',
        Title: 'Black Smothered Strike',
        Rating: 2450,
        Theme: 'Mate in 3',
        Fen: '6k1/5ppp/8/8/4n3/5q2/5PPP/R4RK1 b - - 0 1',
        Pgn: '1... Qxg2+ 2. Kxg2'
    }
];

// Manages Elo-tiered local tactical puzzles, daily rotation, and streak statistics.
class PuzzleManager {
    Initialize() {
        // Loads persisted puzzle streak, solved count, and selected Elo tier.
        this.LastRandomKey = '';
        this.Stats = this.LoadStats();
    }

    // Reads saved puzzle stats and preferred Elo tier from localStorage.
    LoadStats() {
        // Safely parses stored JSON stats or returns defaults.
        if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
            return { Streak: Zero, BestStreak: Zero, Solved: Zero, EloTier: DefaultPuzzleEloTier };
        }
        try {
            const Raw = localStorage.getItem(PuzzleStatsStorageKey);
            if (!Raw) {
                return { Streak: Zero, BestStreak: Zero, Solved: Zero, EloTier: DefaultPuzzleEloTier };
            }
            const Parsed = JSON.parse(Raw);
            return {
                Streak: Number(Parsed.Streak) || Zero,
                BestStreak: Number(Parsed.BestStreak) || Zero,
                Solved: Number(Parsed.Solved) || Zero,
                EloTier: typeof Parsed.EloTier === 'string' ? Parsed.EloTier : DefaultPuzzleEloTier
            };
        } catch (Error) {
            return { Streak: Zero, BestStreak: Zero, Solved: Zero, EloTier: DefaultPuzzleEloTier };
        }
    }

    // Persists updated puzzle statistics and Elo tier to localStorage.
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

    // Updates and persists the selected puzzle Elo tier key.
    SetEloTier(TierKey) {
        // Validates TierKey against PuzzleEloTiers before saving.
        const Valid = PuzzleEloTiers.some((Item) => Item.Key === TierKey);
        this.Stats.EloTier = Valid ? TierKey : DefaultPuzzleEloTier;
        this.SaveStats();
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

    // Selects and parses either today's Daily Puzzle or a Random Puzzle for EloTier.
    FetchPuzzle(IsDaily, EloTier) {
        // Filters PuzzleBank to the active Elo tier and picks Daily or Random.
        const TargetTier = EloTier || this.Stats.EloTier || DefaultPuzzleEloTier;
        const Pool = PuzzleBank.filter((Item) => Item.Tier === TargetTier);
        const ActivePool = Pool.length > Zero ? Pool : PuzzleBank;
        if (IsDaily) {
            const DayIndex = Math.floor(Date.now() / MsPerDay) % ActivePool.length;
            return this.ParsePuzzlePayload(ActivePool[DayIndex], true);
        }
        let Pick = Math.floor(Math.random() * ActivePool.length);
        const PickKey = `${TargetTier}_${Pick}`;
        if (ActivePool.length > One && PickKey === this.LastRandomKey) {
            Pick = (Pick + One) % ActivePool.length;
        }
        this.LastRandomKey = `${TargetTier}_${Pick}`;
        return this.ParsePuzzlePayload(ActivePool[Pick], false);
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
            Tier: String(RawData.Tier || DefaultPuzzleEloTier),
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
