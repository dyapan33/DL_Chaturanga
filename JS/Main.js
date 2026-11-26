// Defines the selectable promotion choices for White and Black pawns.
const PromotionChoicesWhite = [
    { Code: 'q', ImagePath: 'Assets/ChessQueenWhite.svg', Name: 'Queen' },
    { Code: 'r', ImagePath: 'Assets/ChessRookWhite.svg', Name: 'Rook' },
    { Code: 'b', ImagePath: 'Assets/ChessBishopWhite.svg', Name: 'Bishop' },
    { Code: 'n', ImagePath: 'Assets/ChessKnightWhite.svg', Name: 'Knight' }
];
const PromotionChoicesBlack = [
    { Code: 'q', ImagePath: 'Assets/ChessQueenBlack.svg', Name: 'Queen' },
    { Code: 'r', ImagePath: 'Assets/ChessRookBlack.svg', Name: 'Rook' },
    { Code: 'b', ImagePath: 'Assets/ChessBishopBlack.svg', Name: 'Bishop' },
    { Code: 'n', ImagePath: 'Assets/ChessKnightBlack.svg', Name: 'Knight' }
];
const SandboxPiecesWhite = [
    { Code: 'K', ImagePath: 'Assets/ChessKingWhite.svg', Name: 'White King' },
    { Code: 'Q', ImagePath: 'Assets/ChessQueenWhite.svg', Name: 'White Queen' },
    { Code: 'R', ImagePath: 'Assets/ChessRookWhite.svg', Name: 'White Rook' },
    { Code: 'B', ImagePath: 'Assets/ChessBishopWhite.svg', Name: 'White Bishop' },
    { Code: 'N', ImagePath: 'Assets/ChessKnightWhite.svg', Name: 'White Knight' },
    { Code: 'P', ImagePath: 'Assets/ChessPawnWhite.svg', Name: 'White Pawn' }
];
const SandboxPiecesBlack = [
    { Code: 'k', ImagePath: 'Assets/ChessKingBlack.svg', Name: 'Black King' },
    { Code: 'q', ImagePath: 'Assets/ChessQueenBlack.svg', Name: 'Black Queen' },
    { Code: 'r', ImagePath: 'Assets/ChessRookBlack.svg', Name: 'Black Rook' },
    { Code: 'b', ImagePath: 'Assets/ChessBishopBlack.svg', Name: 'Black Bishop' },
    { Code: 'n', ImagePath: 'Assets/ChessKnightBlack.svg', Name: 'Black Knight' },
    { Code: 'p', ImagePath: 'Assets/ChessPawnBlack.svg', Name: 'Black Pawn' }
];
const MaxUndoRequests = Three;
const MaxDrawRequests = Three;
const RequestCooldownSeconds = Ten;
const LowClockWarningSeconds = 15;
const CooldownTickMs = 1000;
const PremoveExecDelayMs = 50;
const MobileBreakpointPx = 750;
const SidebarFilterModes = ['all', 'Win', 'Loss', 'Draw'];
const ValidUciPattern = new RegExp('^[a-h][1-8][a-h][1-8][qrbn]?$');

// Coordinates user input, drag-and-drop, multiplayer, chess rules, clocks, and bot responses.
class Controller {
    Initialize() {
        // Instantiates the game engine, bot AI, multiplayer manager, and UI views.
        this.State = null;
        this.Selected = null;
        this.Busy = false;
        this.GameStarted = false;
        this.BotTimerId = null;
        this.ClockTimerId = null;
        this.TimeControlSeconds = Zero;
        this.IncrementSeconds = Zero;
        this.WhiteClockSeconds = Zero;
        this.BlackClockSeconds = Zero;
        this.UndoRequestsUsed = Zero;
        this.DrawRequestsUsed = Zero;
        this.OpponentUndoRequestsUsed = Zero;
        this.OpponentDrawRequestsUsed = Zero;
        this.UndoCooldownSeconds = Zero;
        this.DrawCooldownSeconds = Zero;
        this.UndoCooldownTimerId = null;
        this.DrawCooldownTimerId = null;
        this.SandboxTool = 'move';
        this.SandboxPiece = '';
        this.OpponentName = '';
        this.PublicPlayerName = '';
        this.PublicGuestTimerId = null;
        this.ActiveGameId = '';
        this.ActiveGameCreatedAt = Zero;
        this.ReviewingGame = null;
        this.CelebratedVictory = false;
        this.PlayedEndFeedback = false;
        this.LastSoundMoveKey = '';
        this.LastCheckMoveKey = '';
        this.QueuedPremove = null;
        this.PremoveOrigin = null;
        this.PremoveTimerId = null;
        this.InPuzzleMode = false;
        this.ActivePuzzle = null;
        this.PuzzleStepIndex = Zero;
        this.PuzzleSolved = false;
        this.PuzzleHadMistake = false;
        this.PuzzleReplyTimerId = null;
        this.GameFilterIndex = Zero;
        this.ViewedFrameIndex = Zero;
        this.Game = new ChessGame();
        this.Game.Initialize();
        this.Bot = new ChessBot();
        this.Bot.Initialize();
        this.Physics = new PhysicsEngine();
        this.Physics.Initialize();
        this.Feedback = new FeedbackManager();
        this.Feedback.Initialize();
        this.Puzzles = new PuzzleManager();
        this.Puzzles.Initialize();
        this.Store = new GameStorageManager();
        this.Store.Initialize();
        this.Network = new MultiplayerManager();
        this.Network.Initialize((Payload) => this.HandleNetworkEvent(Payload));
        this.Lobby = new PublicLobbyManager();
        this.Lobby.Initialize((Payload) => this.HandlePublicLobbyEvent(Payload));
        this.Board = new BoardView();
        this.Board.Initialize(
            'BoardPanel',
            (SquareName) => this.HandleSquareClick(SquareName),
            (FromSquare, ToSquare) => this.HandlePieceDrop(FromSquare, ToSquare)
        );
        this.Board.SetPhysics(this.Physics);
        this.Moves = new MoveListView();
        this.Moves.Initialize(
            'MoveList',
            (FrameIndex) => this.SelectHistoryFrame(FrameIndex),
            () => this.CopyPgnToClipboard(),
            () => this.CopyFenToClipboard()
        );
        this.Status = new StatusView();
        this.Status.Initialize('StatusPanel');
        this.Selector = new BotSelectorView();
        this.Selector.Initialize(
            'BotSelector',
            (Elo, OddsPieces, OddsTimes, PlayerColor, TimeSeconds, IncrementSeconds) => {
                this.StartBotGame(Elo, OddsPieces, OddsTimes, PlayerColor, TimeSeconds, IncrementSeconds);
            },
            (HostColor, HostName, TimeSeconds, IncrementSeconds) => {
                this.CreateMultiplayerGame(HostColor, HostName, TimeSeconds, IncrementSeconds);
            },
            (CodeOrLink, GuestName) => this.JoinMultiplayerGame(CodeOrLink, GuestName),
            (PlayerColor) => this.StartSandboxGame(PlayerColor),
            (PreferredColor, PlayerName, TimeSeconds, IncrementSeconds) => {
                this.JoinPublicLobbyQueue(PreferredColor, PlayerName, TimeSeconds, IncrementSeconds);
            },
            () => this.LeavePublicLobbyQueue()
        );

        // Caches references to the collapsible DOM containers and control buttons.
        this.WorkspaceLayout = document.getElementById('WorkspaceLayout');
        this.BoardColumnBox = document.getElementById('BoardColumn');
        this.AppSidebar = document.getElementById('AppSidebar');
        this.SidebarBackdrop = document.getElementById('SidebarBackdrop');
        this.MobileMenuButton = document.getElementById('MobileMenuButton');
        this.SidebarCloseButton = document.getElementById('SidebarCloseButton');
        this.SidebarAudioButton = document.getElementById('SidebarAudioButton');
        this.SidebarFilterButton = document.getElementById('SidebarFilterButton');
        this.SidebarHomeButton = document.getElementById('SidebarHomeButton');
        this.SidebarGamesLabel = document.getElementById('SidebarGamesLabel');
        this.SidebarDailyPuzzleButton = document.getElementById('SidebarDailyPuzzleButton');
        this.SidebarRandomPuzzleButton = document.getElementById('SidebarRandomPuzzleButton');
        this.SavedGamesListBox = document.getElementById('SavedGamesList');
        this.SidebarLogo = document.getElementById('SidebarLogo');
        this.BotSelectorBox = document.getElementById('BotSelector');
        this.PuzzleBox = document.getElementById('PuzzlePanel');
        this.SandboxBox = document.getElementById('SandboxPanel');
        this.MoveListBox = document.getElementById('MoveList');
        this.StatusBox = document.getElementById('StatusPanel');
        this.PromotionBox = document.getElementById('PromotionPanel');
        this.DrawOfferBox = document.getElementById('DrawOfferPanel');
        this.GameControlsBox = document.getElementById('GameControls');
        this.PostGameControlsBox = document.getElementById('PostGameControls');
        this.OpponentBannerBox = document.getElementById('OpponentBanner');
        this.RematchButton = document.getElementById('RematchButton');
        this.UndoButton = document.getElementById('UndoButton');
        this.UndoButtonText = document.getElementById('UndoButtonText');
        this.DrawButton = document.getElementById('DrawButton');
        this.DrawButtonText = document.getElementById('DrawButtonText');
        this.ResignButton = document.getElementById('ResignButton');

        // Binds click listeners for sidebar, New Game, Rematch, Undo, Draw, Resign, and arrow keys.
        const ReturnToSetup = () => {
            this.CloseMobileSidebar();
            this.ClearRoomQueryFromUrl();
            this.ShowPreGameSetup();
        };
        document.getElementById('NewGameButton').addEventListener('click', ReturnToSetup);
        if (this.SidebarLogo) {
            this.SidebarLogo.addEventListener('click', ReturnToSetup);
        }
        if (this.SidebarHomeButton) {
            this.SidebarHomeButton.addEventListener('click', ReturnToSetup);
        }
        if (this.MobileMenuButton) {
            this.MobileMenuButton.addEventListener('click', () => this.OpenSidebar());
        }
        if (this.SidebarCloseButton) {
            this.SidebarCloseButton.addEventListener('click', () => this.CloseSidebar());
        }
        if (this.SidebarAudioButton) {
            this.SidebarAudioButton.addEventListener('click', () => this.ToggleFeedbackAudio());
        }
        if (this.SidebarFilterButton) {
            this.SidebarFilterButton.addEventListener('click', () => this.CycleSavedGamesFilter());
        }
        if (this.SidebarBackdrop) {
            this.SidebarBackdrop.addEventListener('click', () => this.CloseMobileSidebar());
        }
        if (this.SidebarDailyPuzzleButton) {
            this.SidebarDailyPuzzleButton.addEventListener('click', () => {
                this.CloseMobileSidebar();
                this.StartPuzzleSession(true);
            });
        }
        if (this.SidebarRandomPuzzleButton) {
            this.SidebarRandomPuzzleButton.addEventListener('click', () => {
                this.CloseMobileSidebar();
                this.StartPuzzleSession(false);
            });
        }
        if (this.RematchButton) {
            this.RematchButton.addEventListener('click', () => this.HandleRematchClick());
        }
        this.UndoButton.addEventListener('click', () => this.Undo());
        this.DrawButton.addEventListener('click', () => this.HandleAskForDraw());
        this.ResignButton.addEventListener('click', () => this.HandleResign());
        if (typeof document !== 'undefined' && document.addEventListener) {
            document.addEventListener('keydown', (Event) => this.HandleReviewKeydown(Event));
            document.addEventListener('click', (Event) => this.HandleGlobalUiClick(Event));
        }
        this.UpdateRequestButtons();
        this.RenderSavedGamesSidebar();
        this.RefreshIcons();
    }

    // Renders any uninitialized Lucide icon tags present in the document.
    RefreshIcons() {
        // Invokes Lucide's createIcons helper when loaded from the CDN.
        if (window.lucide && window.lucide.createIcons) {
            window.lucide.createIcons();
        }
    }

    // Enters the initial pre-game screen and checks for a ?Room= invite link in the URL.
    Start() {
        // Reads any ?Room= invite code, scrubs it from the address bar, and prompts for name.
        const UrlRoomCode = this.Network.GetRoomFromUrl();
        this.ClearRoomQueryFromUrl();
        this.ShowPreGameSetup();
        if (UrlRoomCode !== '') {
            this.Selector.PrefillJoinCode(UrlRoomCode);
        }
    }

    // Resets the UI to the pre-game state where only the board and bot selector are shown.
    ShowPreGameSetup() {
        // Cancels any pending bot or clock timers, disconnects multiplayer, and resets flags.
        this.ClearBotTimer();
        this.ClearPublicGuestTimer();
        this.ClearPremove();
        this.ClearPuzzleTimer();
        this.StopClockTimer();
        this.ResetRequestLimits();
        this.Lobby.LeaveQueue();
        this.Network.Disconnect();
        this.InPuzzleMode = false;
        this.ActivePuzzle = null;
        this.UpdateSidebarNavActive('');
        this.Board.SetHintSquare(null);
        this.Status.SetRoomCode('');
        this.Status.SetMessage('');
        this.OpponentName = '';
        this.TimeControlSeconds = Zero;
        this.IncrementSeconds = Zero;
        this.Selector.ResetMultiplayerState();
        this.Busy = false;
        this.GameStarted = false;
        this.ReviewingGame = null;
        this.ActiveGameId = '';
        this.Selected = null;
        this.CelebratedVictory = false;
        this.PlayedEndFeedback = false;
        this.LastSoundMoveKey = '';
        this.LastCheckMoveKey = '';
        this.Physics.Reset();
        this.UpdateEmotiveMood(null);
        this.HidePromotionPicker();
        this.HideDrawOfferPrompt();

        // Resets the board state and hides the board until a game starts or is reviewed.
        this.Board.SetFlipped(false);
        this.Game.Start(DefaultBotElo, '', One, 'w', false);
        this.State = this.Game.GetState();
        this.ViewedFrameIndex = Zero;
        this.Board.ApplyHistoricalFrame(this.State.Frames[Zero]);
        if (this.BoardColumnBox) {
            this.BoardColumnBox.classList.add('Hidden');
        }
        if (this.WorkspaceLayout) {
            this.WorkspaceLayout.classList.add('PreGameLayout');
        }

        // Shows the setup card and hides status, moves, sandbox, banner, and game buttons.
        this.BotSelectorBox.classList.remove('Hidden');
        if (this.PuzzleBox) {
            this.PuzzleBox.classList.add('Hidden');
            this.PuzzleBox.innerHTML = '';
        }
        if (this.SandboxBox) {
            this.SandboxBox.classList.add('Hidden');
        }
        if (this.OpponentBannerBox) {
            this.OpponentBannerBox.classList.add('Hidden');
            this.OpponentBannerBox.innerHTML = '';
        }
        if (this.RematchButton) {
            this.RematchButton.classList.add('Hidden');
        }
        this.StatusBox.classList.add('Hidden');
        this.MoveListBox.classList.add('Hidden');
        this.GameControlsBox.classList.add('Hidden');
        this.PostGameControlsBox.classList.add('Hidden');
        this.UpdateSidebarNavActive('home');
        this.RenderSavedGamesSidebar();
        this.RefreshIcons();
    }

    // Starts a game against the AI bot with the selected side color, settings, and clock.
    StartBotGame(Elo, OddsPieces, OddsTimes, PlayerColor, TimeSeconds, IncrementSeconds) {
        // Disconnects any multiplayer session and configures the board orientation and clock.
        this.ClearPublicGuestTimer();
        this.Lobby.LeaveQueue();
        this.Network.Disconnect();
        const ChosenColor = PlayerColor || 'w';
        const BotName = GetBotName(Elo);
        this.ConfigureMatchClock(TimeSeconds, IncrementSeconds);
        this.ActivateMatchSession(Elo, OddsPieces, OddsTimes, ChosenColor, false, false);
        this.Status.SetRoomCode('');
        this.Status.SetMessage(`Playing as ${ChosenColor === 'w' ? 'White' : 'Black'} vs ${BotName} (${Elo} Elo).`);
        this.ApplyState(this.Game.GetState());

        // Schedules the bot's opening move if the human chose to play as Black.
        if (ChosenColor === 'b' && !this.State.GameOver) {
            this.ScheduleBotTurn();
        }
    }

    // Starts Sandbox mode where the user controls both sides and can add or remove pieces.
    StartSandboxGame(PlayerColor) {
        // Disconnects multiplayer, initializes Sandbox state, and shows the piece editor.
        this.ClearPublicGuestTimer();
        this.Lobby.LeaveQueue();
        this.Network.Disconnect();
        const ChosenColor = PlayerColor || 'w';
        this.SandboxTool = 'move';
        this.SandboxPiece = '';
        this.ConfigureMatchClock(Zero, Zero);
        this.ActivateMatchSession(DefaultBotElo, '', One, ChosenColor, false, true);
        this.Status.SetRoomCode('');
        this.Status.SetMessage('Control both sides, or select a tool to add or remove pieces.');
        this.ApplyState(this.Game.GetState());
    }

    // Creates a multiplayer room and displays its code and shareable link.
    CreateMultiplayerGame(HostColor, HostName, TimeSeconds, IncrementSeconds) {
        // Validates that the host entered a name before creating the room.
        const CleanName = String(HostName || '').trim();
        if (CleanName === '') {
            this.Selector.SetStatusNotice('Please enter your name before creating a game.');
            return;
        }
        this.ClearPublicGuestTimer();
        this.Lobby.LeaveQueue();
        const RoomInfo = this.Network.CreateRoom(HostColor || 'w', CleanName, TimeSeconds, IncrementSeconds);
        this.Selector.SetCreatedRoom(RoomInfo);
    }

    // Joins a multiplayer room by code or shareable URL link.
    JoinMultiplayerGame(CodeOrLink, GuestName) {
        // Validates that the guest entered a name before joining the room.
        const CleanName = String(GuestName || '').trim();
        if (CleanName === '') {
            this.Selector.SetStatusNotice('Please enter your name before joining a game.');
            return;
        }
        this.ClearPublicGuestTimer();
        this.Lobby.LeaveQueue();
        const Joined = this.Network.JoinRoom(CodeOrLink, CleanName);
        if (!Joined) {
            this.Selector.SetStatusNotice('Invalid room code or link.');
            return;
        }
        this.Selector.SetStatusNotice(`Joining room ${Joined.RoomCode}...`);
    }

    // Enters the PeerJS public matchmaking queue to pair with a random opponent.
    JoinPublicLobbyQueue(PreferredColor, PlayerName, TimeSeconds, IncrementSeconds) {
        // Validates the display name, resets prior connections, and joins the public queue.
        const CleanName = String(PlayerName || '').trim();
        if (CleanName === '') {
            this.Selector.SetPublicStatus('Please enter your name before searching.');
            return;
        }
        this.ClearPublicGuestTimer();
        this.Network.Disconnect();
        this.PublicPlayerName = CleanName;
        this.Selector.SetPublicSearching(true, 'Connecting to public lobby...');
        this.Lobby.JoinQueue(CleanName, PreferredColor || 'w', TimeSeconds, IncrementSeconds);
    }

    // Cancels an active public matchmaking search and restores the setup controls.
    LeavePublicLobbyQueue() {
        // Clears timers, leaves the PeerJS lobby, and resets the selector UI.
        this.ClearPublicGuestTimer();
        this.Lobby.LeaveQueue();
        this.Selector.SetPublicSearching(false, '');
    }

    // Clears any pending guest room-join delay timer from a public lobby match.
    ClearPublicGuestTimer() {
        // Cancels PublicGuestTimerId if currently scheduled.
        if (this.PublicGuestTimerId !== null) {
            clearTimeout(this.PublicGuestTimerId);
            this.PublicGuestTimerId = null;
        }
    }

    // Handles status, error, and match-found events emitted by PublicLobbyManager.
    HandlePublicLobbyEvent(Payload) {
        // Updates the searching status text or reports lobby errors.
        if (!Payload || typeof Payload.Type !== 'string') {
            return;
        }
        if (Payload.Type === 'LobbyStatus') {
            this.Selector.SetPublicStatus(Payload.Message);
            return;
        }
        if (Payload.Type === 'LobbyError') {
            this.Selector.SetPublicSearching(false, Payload.Message);
            return;
        }

        // Transitions both matched players into an encrypted multiplayer room.
        if (Payload.Type === 'MatchFound' && typeof Payload.RoomCode === 'string') {
            const OpponentLabel = String(Payload.OpponentName || '').trim() || 'Opponent';
            this.Selector.SetPublicSearching(true, `Matched with ${OpponentLabel}! Starting game...`);
            if (Payload.Role === 'host') {
                this.Network.CreateRoom(
                    Payload.Color || 'w',
                    this.PublicPlayerName || 'Player',
                    Payload.TimeSeconds,
                    Payload.IncrementSeconds,
                    Payload.RoomCode
                );
                return;
            }
            this.ClearPublicGuestTimer();
            this.PublicGuestTimerId = setTimeout(() => {
                this.PublicGuestTimerId = null;
                this.Network.JoinRoom(Payload.RoomCode, this.PublicPlayerName || 'Player');
            }, GuestJoinDelayMs);
        }
    }

    // Transitions the UI from the setup screen into an active match session.
    ActivateMatchSession(Elo, OddsPieces, OddsTimes, PlayerColor, IsMultiplayer, IsSandbox) {
        // Resets timers, flips the board if playing Black, and reveals match panels.
        this.ClearBotTimer();
        this.ClearPremove();
        this.ClearPuzzleTimer();
        this.ResetRequestLimits();
        this.Selector.ResetMultiplayerState();
        this.InPuzzleMode = false;
        this.ActivePuzzle = null;
        this.UpdateSidebarNavActive('');
        this.Board.SetHintSquare(null);
        if (this.PuzzleBox) {
            this.PuzzleBox.classList.add('Hidden');
            this.PuzzleBox.innerHTML = '';
        }
        this.Busy = false;
        this.GameStarted = true;
        this.ReviewingGame = null;
        this.ActiveGameId = this.Store.CreateGameId();
        this.ActiveGameCreatedAt = Date.now();
        this.CelebratedVictory = false;
        this.PlayedEndFeedback = false;
        this.LastSoundMoveKey = '';
        this.LastCheckMoveKey = '';
        this.Physics.Reset();
        this.HidePromotionPicker();
        this.HideDrawOfferPrompt();
        if (this.BoardColumnBox) {
            this.BoardColumnBox.classList.remove('Hidden');
        }
        if (this.WorkspaceLayout) {
            this.WorkspaceLayout.classList.remove('PreGameLayout');
        }
        this.Board.SetFlipped(PlayerColor === 'b');
        this.BotSelectorBox.classList.add('Hidden');
        if (this.SandboxBox) {
            if (IsSandbox) {
                this.SandboxBox.classList.remove('Hidden');
            } else {
                this.SandboxBox.classList.add('Hidden');
            }
        }
        this.StatusBox.classList.remove('Hidden');
        this.MoveListBox.classList.remove('Hidden');
        this.GameControlsBox.classList.remove('Hidden');
        this.PostGameControlsBox.classList.add('Hidden');
        this.Game.Start(Elo, OddsPieces, OddsTimes, PlayerColor, IsMultiplayer, IsSandbox);
        this.StartClockTimer();
    }

    // Configures the initial White and Black chess clock durations and increment.
    ConfigureMatchClock(TimeSeconds, IncrementSeconds) {
        // Stops any previous clock and sets the new base time and increment.
        this.StopClockTimer();
        this.TimeControlSeconds = Number(TimeSeconds) || Zero;
        this.IncrementSeconds = Number(IncrementSeconds) || Zero;
        this.WhiteClockSeconds = this.TimeControlSeconds;
        this.BlackClockSeconds = this.TimeControlSeconds;
    }

    // Starts the 1-second interval timer when a timed chess clock is enabled.
    StartClockTimer() {
        // Exits if unlimited time control is selected or setInterval is unavailable.
        this.StopClockTimer();
        if (this.TimeControlSeconds <= Zero || typeof setInterval !== 'function') {
            return;
        }
        this.ClockTimerId = setInterval(() => this.TickMatchClock(), CooldownTickMs);
    }

    // Stops the active chess clock interval timer.
    StopClockTimer() {
        // Clears the clock interval identifier if active.
        if (this.ClockTimerId !== null) {
            if (typeof clearInterval === 'function') {
                clearInterval(this.ClockTimerId);
            }
            this.ClockTimerId = null;
        }
    }

    // Decrements the active side's clock by one second and enforces FIDE Article 6.9 timeout.
    TickMatchClock() {
        // Stops ticking if the game has ended or no time control is active.
        if (!this.GameStarted || !this.State || this.State.GameOver || this.TimeControlSeconds <= Zero) {
            this.StopClockTimer();
            return;
        }

        // Decrements the active side's remaining time and checks for flag fall.
        if (this.State.Turn === 'w') {
            this.WhiteClockSeconds = Math.max(Zero, this.WhiteClockSeconds - One);
            if (this.WhiteClockSeconds <= Zero) {
                this.HandleClockTimeout('w');
                return;
            }
        } else {
            this.BlackClockSeconds = Math.max(Zero, this.BlackClockSeconds - One);
            if (this.BlackClockSeconds <= Zero) {
                this.HandleClockTimeout('b');
                return;
            }
        }
        this.RenderOpponentBanner(this.State);
        this.UpdateEmotiveMood(this.State);
        this.RefreshIcons();
    }

    // Adds the configured increment seconds to the side that just completed a move.
    ApplyClockIncrement(MovedColor) {
        // Adds IncrementSeconds when a timed clock is active and the game is still running.
        if (this.TimeControlSeconds <= Zero || this.IncrementSeconds <= Zero || !this.State || this.State.GameOver) {
            return;
        }
        if (MovedColor === 'w') {
            this.WhiteClockSeconds += this.IncrementSeconds;
        } else {
            this.BlackClockSeconds += this.IncrementSeconds;
        }
    }

    // Ends the match when FlaggedColor's clock reaches zero under FIDE Article 6.9.
    HandleClockTimeout(FlaggedColor) {
        // Stops timers, applies FIDE Article 6.9 timeout evaluation, and notifies peer.
        this.StopClockTimer();
        this.ClearBotTimer();
        this.Busy = false;
        this.HidePromotionPicker();
        this.HideDrawOfferPrompt();
        this.Game.Timeout(FlaggedColor);
        if (this.State && this.State.IsMultiplayer) {
            this.Network.SendPayload({ Type: 'Timeout', Color: FlaggedColor });
        }
        this.ApplyState(this.Game.GetState());
    }

    // Formats a duration in seconds as MM:SS for the chess clock badges.
    FormatClockTime(TotalSeconds) {
        // Computes zero-padded minutes and seconds.
        const Clamped = Math.max(Zero, Math.floor(Number(TotalSeconds) || Zero));
        const Minutes = Math.floor(Clamped / SixtySeconds);
        const Seconds = Clamped % SixtySeconds;
        const MinText = Minutes < Ten ? `0${Minutes}` : String(Minutes);
        const SecText = Seconds < Ten ? `0${Seconds}` : String(Seconds);
        return `${MinText}:${SecText}`;
    }

    // Renders the Sandbox editor panel for controlling both sides and adding/removing pieces.
    RenderSandboxPanel() {
        // Exits if the Sandbox container is missing or the current session is not Sandbox mode.
        if (!this.SandboxBox || !this.State || !this.State.IsSandbox) {
            return;
        }
        this.SandboxBox.innerHTML = '';
        const Panel = document.createElement('div');
        Panel.className = 'Panel';
        const Title = document.createElement('h3');
        const Icon = document.createElement('i');
        Icon.setAttribute('data-lucide', 'sliders');
        const TitleText = document.createElement('span');
        TitleText.textContent = 'Sandbox Editor';
        Title.appendChild(Icon);
        Title.appendChild(TitleText);
        Panel.appendChild(Title);

        // Builds the Move Pieces and Remove Piece tool buttons.
        const ToolRow = document.createElement('div');
        ToolRow.className = 'HistoryControls';
        const MoveBtn = document.createElement('button');
        MoveBtn.type = 'button';
        MoveBtn.className = this.SandboxTool === 'move' ? 'HistoryButton ActiveSandboxTool' : 'HistoryButton';
        MoveBtn.textContent = 'Move Pieces';
        MoveBtn.addEventListener('click', () => {
            this.SandboxTool = 'move';
            this.SandboxPiece = '';
            this.Status.SetMessage('Move mode: control both White and Black.');
            this.ApplyState(this.Game.GetState());
        });
        const RemoveBtn = document.createElement('button');
        RemoveBtn.type = 'button';
        RemoveBtn.className = this.SandboxTool === 'remove' ? 'HistoryButton ActiveSandboxTool' : 'HistoryButton';
        RemoveBtn.textContent = 'Remove Piece';
        RemoveBtn.addEventListener('click', () => {
            this.SandboxTool = 'remove';
            this.SandboxPiece = '';
            this.Status.SetMessage('Click any square on the board to remove its piece.');
            this.ApplyState(this.Game.GetState());
        });
        ToolRow.appendChild(MoveBtn);
        ToolRow.appendChild(RemoveBtn);
        Panel.appendChild(ToolRow);

        // Appends the Add White Piece and Add Black Piece palettes.
        Panel.appendChild(this.BuildSandboxPaletteRow('Add White Piece:', SandboxPiecesWhite));
        Panel.appendChild(this.BuildSandboxPaletteRow('Add Black Piece:', SandboxPiecesBlack));

        // Appends turn-switching and board-clearing utility buttons.
        const UtilRow = document.createElement('div');
        UtilRow.className = 'HistoryControls';
        const TurnBtn = document.createElement('button');
        TurnBtn.type = 'button';
        TurnBtn.className = 'HistoryButton';
        TurnBtn.textContent = this.State.Turn === 'w' ? 'Turn: White (Switch)' : 'Turn: Black (Switch)';
        TurnBtn.addEventListener('click', () => {
            this.Game.SetActiveTurn(this.State.Turn !== 'w');
            this.ApplyState(this.Game.GetState());
        });
        const ClearBtn = document.createElement('button');
        ClearBtn.type = 'button';
        ClearBtn.className = 'HistoryButton';
        ClearBtn.textContent = 'Kings Only';
        ClearBtn.addEventListener('click', () => {
            this.Game.ClearBoardToKings();
            this.ApplyState(this.Game.GetState());
        });
        UtilRow.appendChild(TurnBtn);
        UtilRow.appendChild(ClearBtn);
        Panel.appendChild(UtilRow);

        // Appends a FEN input and Load FEN button for importing custom positions.
        const FenRow = document.createElement('div');
        FenRow.className = 'InlineInputRow';
        const FenInput = document.createElement('input');
        FenInput.type = 'text';
        FenInput.className = 'TextInput';
        FenInput.placeholder = 'Paste FEN to load...';
        const LoadFenBtn = document.createElement('button');
        LoadFenBtn.type = 'button';
        LoadFenBtn.className = 'HistoryButton';
        LoadFenBtn.textContent = 'Load FEN';
        LoadFenBtn.addEventListener('click', () => {
            this.LoadFenPosition(FenInput.value);
        });
        FenRow.appendChild(FenInput);
        FenRow.appendChild(LoadFenBtn);
        Panel.appendChild(FenRow);
        this.SandboxBox.appendChild(Panel);
    }

    // Loads a custom FEN position into the game engine and updates the UI.
    LoadFenPosition(FenString) {
        // Validates and applies the FEN string via ChessGame.LoadFen.
        const Loaded = this.Game.LoadFen(FenString);
        if (!Loaded) {
            this.Status.SetMessage('Invalid FEN string.');
            this.Status.Render(this.State);
            return;
        }
        this.Status.SetMessage('FEN position loaded.');
        this.ApplyState(this.Game.GetState());
    }

    // Copies the current game's PGN notation to the clipboard.
    CopyPgnToClipboard() {
        // Generates the PGN string from the active game or saved review record.
        const SourceState = this.ReviewingGame || this.State;
        if (!SourceState) {
            return;
        }
        let PgnText = '';
        if (this.ReviewingGame) {
            const Moves = this.ReviewingGame.SanHistory || this.ReviewingGame.History || [];
            const Pairs = [];
            for (let Index = Zero; Index < Moves.length; Index += Two) {
                const MoveNum = Math.floor(Index / Two) + One;
                const WhiteMove = Moves[Index];
                const BlackMove = Index + One < Moves.length ? ` ${Moves[Index + One]}` : '';
                Pairs.push(`${MoveNum}. ${WhiteMove}${BlackMove}`);
            }
            PgnText = Pairs.join(' ') || 'No moves played yet.';
        } else {
            PgnText = this.Game.GeneratePgn() || 'No moves played yet.';
        }
        this.Selector.CopyTextToClipboard(PgnText, 'PGN copied!');
        this.Status.SetMessage('PGN copied to clipboard!');
        this.Status.Render(SourceState);
    }

    // Copies the current board position's FEN string to the clipboard.
    CopyFenToClipboard() {
        // Reads the currently viewed frame's FEN string and copies it to the clipboard.
        const SourceState = this.ReviewingGame || this.State;
        if (!SourceState) {
            return;
        }
        const ActiveFrame = SourceState.Frames && SourceState.Frames[this.ViewedFrameIndex];
        const FenText = ActiveFrame ? ActiveFrame.Fen : SourceState.Fen;
        this.Selector.CopyTextToClipboard(FenText, 'FEN copied!');
        this.Status.SetMessage('FEN copied to clipboard!');
        this.Status.Render(SourceState);
    }

    // Builds a row of 6 piece buttons for placing White or Black pieces on the board.
    BuildSandboxPaletteRow(LabelText, PiecesArray) {
        // Creates the label and 6-button piece grid.
        const Wrapper = document.createElement('div');
        Wrapper.className = 'SelectorRow';
        const Label = document.createElement('label');
        Label.textContent = LabelText;
        const Grid = document.createElement('div');
        Grid.className = 'SandboxPieceGrid';
        for (let Index = Zero; Index < PiecesArray.length; Index += One) {
            const Item = PiecesArray[Index];
            const Btn = document.createElement('button');
            Btn.type = 'button';
            const IsSelected = this.SandboxTool === 'add' && this.SandboxPiece === Item.Code;
            Btn.className = IsSelected ? 'SandboxPieceButton ActiveSandboxTool' : 'SandboxPieceButton';
            const Img = document.createElement('img');
            Img.src = Item.ImagePath;
            Img.alt = Item.Name;
            Btn.appendChild(Img);
            Btn.addEventListener('click', () => {
                if (this.SandboxTool === 'add' && this.SandboxPiece === Item.Code) {
                    this.SandboxTool = 'move';
                    this.SandboxPiece = '';
                    this.Status.SetMessage('Move mode: control both White and Black.');
                } else {
                    this.SandboxTool = 'add';
                    this.SandboxPiece = Item.Code;
                    this.Status.SetMessage(`Click any square on the board to add ${Item.Name}.`);
                }
                this.ApplyState(this.Game.GetState());
            });
            Grid.appendChild(Btn);
        }
        Wrapper.appendChild(Label);
        Wrapper.appendChild(Grid);
        return Wrapper;
    }

    // Removes any stale ?Room= parameter from the browser address bar without reloading.
    ClearRoomQueryFromUrl() {
        // Uses window.history.replaceState when available to strip the query string.
        if (window.history && window.history.replaceState && window.location && window.location.href) {
            const CleanUrl = window.location.href.split('?')[Zero].split('#')[Zero];
            window.history.replaceState({}, '', CleanUrl);
        }
    }

    // Handles incoming multiplayer events from the remote opponent.
    HandleNetworkEvent(Payload) {
        // Starts the match when an opponent joins the host or when the guest connects.
        if (Payload.Type === 'OpponentJoined' || Payload.Type === 'JoinedRoom') {
            const AssignedColor = Payload.Color || 'w';
            this.OpponentName = String(Payload.OpponentName || '').trim() || 'Opponent';
            this.ConfigureMatchClock(Payload.TimeSeconds, Payload.IncrementSeconds);
            this.ActivateMatchSession(DefaultBotElo, '', One, AssignedColor, true, false);
            this.Status.SetRoomCode(this.Network.RoomCode);
            this.Status.SetMessage(`Multiplayer vs ${this.OpponentName} (${AssignedColor === 'w' ? 'White' : 'Black'}).`);
            this.ApplyState(this.Game.GetState());
            return;
        }

        // Dispatches active match synchronization events.
        if (!this.GameStarted || !this.State || !this.State.IsMultiplayer) {
            return;
        }
        this.ProcessMatchNetworkPayload(Payload);
    }

    // Processes moves, draw offers, resignations, and undo requests during a multiplayer game.
    ProcessMatchNetworkPayload(Payload) {
        // Validates turn ownership and UCI format before applying an opponent's move.
        const OpponentColor = this.State.PlayerColor === 'w' ? 'b' : 'w';
        if (Payload.Type === 'Move' && typeof Payload.MoveUci === 'string') {
            if (this.State.Turn !== OpponentColor || !ValidUciPattern.test(Payload.MoveUci)) {
                return;
            }
            this.HideDrawOfferPrompt();
            this.Game.PlayerMove(Payload.MoveUci);
            this.ApplyClockIncrement(OpponentColor);
            this.ApplyState(this.Game.GetState());
            return;
        }

        // Handles clock timeout notifications and post-game rematch requests/acceptances.
        if (Payload.Type === 'Timeout') {
            const FlaggedColor = Payload.Color === 'b' ? 'b' : 'w';
            this.StopClockTimer();
            this.HideDrawOfferPrompt();
            this.Game.Timeout(FlaggedColor);
            this.ApplyState(this.Game.GetState());
            return;
        }
        if (Payload.Type === 'RematchRequest') {
            this.ShowRematchPrompt();
            return;
        }
        if (Payload.Type === 'RematchAccept') {
            this.HideDrawOfferPrompt();
            this.ExecuteMultiplayerRematch();
            return;
        }
        if (Payload.Type === 'RematchDecline') {
            this.Status.SetMessage('Opponent declined the rematch request.');
            this.Status.Render(this.State);
            return;
        }

        // Enforces the 3-offer limit on incoming draw offers and handles draw responses.
        if (Payload.Type === 'DrawOffer') {
            if (this.OpponentDrawRequestsUsed >= MaxDrawRequests || this.State.GameOver) {
                return;
            }
            this.OpponentDrawRequestsUsed += One;
            this.ShowDrawOfferPrompt();
            return;
        }
        if (Payload.Type === 'DrawAccept') {
            this.HideDrawOfferPrompt();
            this.Game.AcceptDraw();
            this.ApplyState(this.Game.GetState());
            return;
        }
        if (Payload.Type === 'DrawDecline') {
            this.Status.SetMessage('Opponent declined the draw offer.');
            this.Status.Render(this.State);
            return;
        }

        // Binds incoming resignation strictly to OpponentColor so a peer cannot resign for you.
        if (Payload.Type === 'Resign') {
            this.HideDrawOfferPrompt();
            this.Game.Resign(OpponentColor);
            this.ApplyState(this.Game.GetState());
            return;
        }

        // Enforces the 3-request limit and opponent color binding on incoming undo messages.
        if (Payload.Type === 'UndoRequest') {
            if (this.OpponentUndoRequestsUsed >= MaxUndoRequests || !this.Game.CanUndo()) {
                return;
            }
            this.OpponentUndoRequestsUsed += One;
            this.ShowUndoRequestPrompt(OpponentColor);
        } else if (Payload.Type === 'UndoAccept') {
            this.HideDrawOfferPrompt();
            if (typeof Payload.TargetPly === 'number' && Payload.TargetPly >= Zero && Payload.TargetPly <= this.Game.History.length) {
                this.Game.UndoToPly(Payload.TargetPly);
            } else {
                this.Game.Undo();
            }
            this.Status.SetMessage('Opponent accepted the undo request.');
            this.ApplyState(this.Game.GetState());
        } else if (Payload.Type === 'UndoDecline') {
            this.Status.SetMessage('Opponent declined the undo request.');
            this.Status.Render(this.State);
        }
    }

    // Displays an inline prompt when the multiplayer opponent offers a draw.
    ShowDrawOfferPrompt() {
        // Renders the accept/decline prompt for a draw offer.
        this.ShowPeerPrompt(
            'Opponent offers a draw',
            'Accept Draw',
            () => {
                this.HideDrawOfferPrompt();
                this.Game.AcceptDraw();
                this.Network.SendPayload({ Type: 'DrawAccept' });
                this.ApplyState(this.Game.GetState());
            },
            () => {
                this.HideDrawOfferPrompt();
                this.Network.SendPayload({ Type: 'DrawDecline' });
            }
        );
    }

    // Displays an inline prompt when the multiplayer opponent requests to undo a move.
    ShowUndoRequestPrompt(RequesterColor) {
        // Renders the accept/decline prompt for an undo request.
        this.ShowPeerPrompt(
            'Opponent requests to undo the last move',
            'Accept Undo',
            () => {
                this.HideDrawOfferPrompt();
                if (RequesterColor) {
                    this.Game.UndoForColor(RequesterColor);
                } else {
                    this.Game.Undo();
                }
                this.Network.SendPayload({
                    Type: 'UndoAccept',
                    TargetPly: this.Game.History.length
                });
                this.Status.SetMessage('Undo accepted.');
                this.ApplyState(this.Game.GetState());
            },
            () => {
                this.HideDrawOfferPrompt();
                this.Network.SendPayload({ Type: 'UndoDecline' });
            }
        );
    }

    // Sends a rematch request to the multiplayer opponent after a game finishes.
    HandleRematchClick() {
        // Validates that the match is a finished multiplayer game before sending RematchRequest.
        if (!this.GameStarted || !this.State || !this.State.IsMultiplayer || !this.State.GameOver) {
            return;
        }
        this.Network.SendPayload({ Type: 'RematchRequest' });
        this.Status.SetMessage('Rematch request sent to opponent.');
        this.Status.Render(this.State);
    }

    // Displays the centered blur modal when the opponent requests a rematch.
    ShowRematchPrompt() {
        // Renders the accept/decline modal for a multiplayer rematch.
        this.ShowPeerPrompt(
            'Opponent wants a rematch',
            'Accept Rematch',
            () => {
                this.HideDrawOfferPrompt();
                this.Network.SendPayload({ Type: 'RematchAccept' });
                this.ExecuteMultiplayerRematch();
            },
            () => {
                this.HideDrawOfferPrompt();
                this.Network.SendPayload({ Type: 'RematchDecline' });
            }
        );
    }

    // Swaps sides and starts a fresh multiplayer game in the same room.
    ExecuteMultiplayerRematch() {
        // Flips the local player's color, resets clocks and limits, and restarts the board.
        const NextColor = (this.State && this.State.PlayerColor === 'w') ? 'b' : 'w';
        this.ConfigureMatchClock(this.TimeControlSeconds, this.IncrementSeconds);
        this.ActivateMatchSession(DefaultBotElo, '', One, NextColor, true, false);
        this.Status.SetRoomCode(this.Network.RoomCode);
        this.Status.SetMessage(`Rematch started vs ${this.OpponentName} (${NextColor === 'w' ? 'White' : 'Black'}).`);
        this.ApplyState(this.Game.GetState());
    }

    // Builds and mounts a two-button peer confirmation prompt inside DrawOfferBox.
    ShowPeerPrompt(TitleText, AcceptLabel, OnAccept, OnDecline) {
        // Creates the panel header and Accept / Decline buttons.
        this.DrawOfferBox.innerHTML = '';
        this.DrawOfferBox.classList.remove('Hidden');
        const Panel = document.createElement('div');
        Panel.className = 'Panel';
        const Title = document.createElement('h3');
        Title.textContent = TitleText;
        const BtnRow = document.createElement('div');
        BtnRow.className = 'Controls';
        const AcceptBtn = document.createElement('button');
        AcceptBtn.type = 'button';
        AcceptBtn.className = 'PrimaryButton';
        AcceptBtn.textContent = AcceptLabel;
        AcceptBtn.addEventListener('click', OnAccept);
        const DeclineBtn = document.createElement('button');
        DeclineBtn.type = 'button';
        DeclineBtn.className = 'SecondaryButton';
        DeclineBtn.textContent = 'Decline';
        DeclineBtn.addEventListener('click', OnDecline);
        BtnRow.appendChild(AcceptBtn);
        BtnRow.appendChild(DeclineBtn);
        Panel.appendChild(Title);
        Panel.appendChild(BtnRow);
        this.DrawOfferBox.appendChild(Panel);
    }

    // Hides and clears the incoming multiplayer prompt panel.
    HideDrawOfferPrompt() {
        // Adds the Hidden class to the prompt container.
        if (this.DrawOfferBox) {
            this.DrawOfferBox.classList.add('Hidden');
            this.DrawOfferBox.innerHTML = '';
        }
    }

    // Cancels any scheduled bot timer to prevent stale callbacks or leaks.
    ClearBotTimer() {
        // Clears the active timeout identifier if one is scheduled.
        if (this.BotTimerId !== null) {
            clearTimeout(this.BotTimerId);
            this.BotTimerId = null;
        }
    }

    // Cancels any active cooldown timers for the Undo and Draw Request buttons.
    ClearCooldownTimers() {
        // Clears the undo and draw cooldown timeout identifiers if active.
        if (this.UndoCooldownTimerId !== null) {
            clearTimeout(this.UndoCooldownTimerId);
            this.UndoCooldownTimerId = null;
        }
        if (this.DrawCooldownTimerId !== null) {
            clearTimeout(this.DrawCooldownTimerId);
            this.DrawCooldownTimerId = null;
        }
    }

    // Resets the per-game undo and draw request counters and cooldowns.
    ResetRequestLimits() {
        // Clears cooldown timers and resets used counts to zero.
        this.ClearCooldownTimers();
        this.UndoRequestsUsed = Zero;
        this.DrawRequestsUsed = Zero;
        this.OpponentUndoRequestsUsed = Zero;
        this.OpponentDrawRequestsUsed = Zero;
        this.UndoCooldownSeconds = Zero;
        this.DrawCooldownSeconds = Zero;
        this.UpdateRequestButtons();
    }

    // Starts the 10-second cooldown timer on the Undo button.
    StartUndoCooldown() {
        // Initializes the 10-second countdown and schedules the first tick.
        if (this.UndoCooldownTimerId !== null) {
            clearTimeout(this.UndoCooldownTimerId);
        }
        this.UndoCooldownSeconds = RequestCooldownSeconds;
        this.UpdateRequestButtons();
        this.UndoCooldownTimerId = setTimeout(() => this.TickUndoCooldown(), CooldownTickMs);
    }

    // Advances the Undo button cooldown timer by one second.
    TickUndoCooldown() {
        // Decrements the remaining seconds and reschedules if still cooling down.
        this.UndoCooldownTimerId = null;
        if (this.UndoCooldownSeconds > Zero) {
            this.UndoCooldownSeconds -= One;
        }
        this.UpdateRequestButtons();
        if (this.UndoCooldownSeconds > Zero) {
            this.UndoCooldownTimerId = setTimeout(() => this.TickUndoCooldown(), CooldownTickMs);
        }
    }

    // Starts the 10-second cooldown timer on the Draw Request button.
    StartDrawCooldown() {
        // Initializes the 10-second countdown and schedules the first tick.
        if (this.DrawCooldownTimerId !== null) {
            clearTimeout(this.DrawCooldownTimerId);
        }
        this.DrawCooldownSeconds = RequestCooldownSeconds;
        this.UpdateRequestButtons();
        this.DrawCooldownTimerId = setTimeout(() => this.TickDrawCooldown(), CooldownTickMs);
    }

    // Advances the Draw Request button cooldown timer by one second.
    TickDrawCooldown() {
        // Decrements the remaining seconds and reschedules if still cooling down.
        this.DrawCooldownTimerId = null;
        if (this.DrawCooldownSeconds > Zero) {
            this.DrawCooldownSeconds -= One;
        }
        this.UpdateRequestButtons();
        if (this.DrawCooldownSeconds > Zero) {
            this.DrawCooldownTimerId = setTimeout(() => this.TickDrawCooldown(), CooldownTickMs);
        }
    }

    // Updates the text labels and disabled states of the Undo and Draw Request buttons.
    UpdateRequestButtons() {
        // Computes remaining undo attempts and updates the Undo button label and state.
        const UndoRemaining = MaxUndoRequests - this.UndoRequestsUsed;
        if (this.UndoButton) {
            let UndoLabel = `Undo (${UndoRemaining}/${MaxUndoRequests})`;
            if (UndoRemaining <= Zero) {
                UndoLabel = `Undo (${Zero}/${MaxUndoRequests})`;
                this.UndoButton.disabled = true;
            } else if (this.UndoCooldownSeconds > Zero) {
                UndoLabel = `Undo (${this.UndoCooldownSeconds}s)`;
                this.UndoButton.disabled = true;
            } else {
                this.UndoButton.disabled = false;
            }
            if (this.UndoButtonText) {
                this.UndoButtonText.textContent = UndoLabel;
            }
        }

        // Computes remaining draw attempts and updates the Draw Request button label and state.
        const DrawRemaining = MaxDrawRequests - this.DrawRequestsUsed;
        if (this.DrawButton) {
            let DrawLabel = `Draw Request (${DrawRemaining}/${MaxDrawRequests})`;
            if (DrawRemaining <= Zero) {
                DrawLabel = `Draw Request (${Zero}/${MaxDrawRequests})`;
                this.DrawButton.disabled = true;
            } else if (this.DrawCooldownSeconds > Zero) {
                DrawLabel = `Draw Request (${this.DrawCooldownSeconds}s)`;
                this.DrawButton.disabled = true;
            } else {
                this.DrawButton.disabled = false;
            }
            if (this.DrawButtonText) {
                this.DrawButtonText.textContent = DrawLabel;
            }
        }
    }

    // Displays the promotion piece selector for a pawn reaching the promotion rank.
    ShowPromotionPicker(BaseMove) {
        // Builds the promotion panel with Queen, Rook, Bishop, and Knight SVG buttons.
        this.PromotionBox.innerHTML = '';
        this.PromotionBox.classList.remove('Hidden');
        const Panel = document.createElement('div');
        Panel.className = 'Panel';
        const Title = document.createElement('h3');
        Title.textContent = 'Choose promotion piece';
        Panel.appendChild(Title);
        const ChoicesRow = document.createElement('div');
        ChoicesRow.className = 'PromotionChoices';

        // Selects White or Black promotion piece assets matching the active turn side.
        const ChoicesList = (this.State && this.State.Turn === 'b') ? PromotionChoicesBlack : PromotionChoicesWhite;
        for (let Index = Zero; Index < ChoicesList.length; Index += One) {
            const Choice = ChoicesList[Index];
            const Button = document.createElement('button');
            Button.type = 'button';
            Button.className = 'PromotionButton';
            const PieceImg = document.createElement('img');
            PieceImg.src = Choice.ImagePath;
            PieceImg.alt = Choice.Name;
            const Label = document.createElement('span');
            Label.textContent = Choice.Name;
            Button.appendChild(PieceImg);
            Button.appendChild(Label);
            Button.addEventListener('click', () => {
                this.HidePromotionPicker();
                this.SendMove(BaseMove + Choice.Code);
            });
            ChoicesRow.appendChild(Button);
        }

        // Appends the choice buttons to the promotion panel.
        Panel.appendChild(ChoicesRow);
        this.PromotionBox.appendChild(Panel);
    }

    // Hides and clears the pawn promotion selector panel.
    HidePromotionPicker() {
        // Adds the Hidden class and empties the promotion container.
        if (this.PromotionBox) {
            this.PromotionBox.classList.add('Hidden');
            this.PromotionBox.innerHTML = '';
        }
    }

    // Applies a player move and broadcasts it or schedules the bot's reply.
    SendMove(MoveUci) {
        // Routes moves to the local puzzle verifier when in Puzzle mode.
        if (this.InPuzzleMode) {
            this.HandlePuzzlePlayerMove(MoveUci);
            return;
        }

        // Ignores move attempts while busy, before game start, or when not player's turn.
        if (this.Busy || !this.GameStarted || !this.IsLocalPlayerTurn()) {
            return;
        }

        // Executes the player move on the local ChessGame engine.
        const MovedColor = this.State.Turn;
        const Applied = this.Game.PlayerMove(MoveUci);
        if (!Applied) {
            this.Status.SetMessage('Illegal move.');
            this.Status.Render(this.State);
            return;
        }

        // Updates the clock increment, UI, and either sends the move to peer or schedules bot.
        this.ApplyClockIncrement(MovedColor);
        this.HideDrawOfferPrompt();
        this.ApplyState(this.Game.GetState());
        if (this.State.IsSandbox) {
            return;
        }
        if (this.State.IsMultiplayer) {
            this.Network.SendPayload({ Type: 'Move', MoveUci: MoveUci });
            return;
        }
        if (!this.State.GameOver && this.State.Turn !== this.State.PlayerColor) {
            this.ScheduleBotTurn();
        }
    }

    // Schedules the bot to compute and play its move after a random 1-5s delay.
    ScheduleBotTurn() {
        // Marks the controller busy and schedules the bot execution callback.
        this.ClearBotTimer();
        this.Busy = true;
        const DelayMs = this.Bot.GetThinkingDelay();
        this.BotTimerId = setTimeout(() => {
            this.BotTimerId = null;
            this.ExecuteBotTurn();
        }, DelayMs);
    }

    // Computes and applies a single bot move, chaining extra moves if odds apply.
    ExecuteBotTurn() {
        // Chooses a move for the bot's color and applies it to the game state.
        if (!this.State || this.State.GameOver) {
            this.Busy = false;
            return;
        }
        const BotIsWhite = this.State.PlayerColor === 'b';
        const BotMoveUci = this.Bot.ChooseMove(this.Game, this.State.BotElo, BotIsWhite);
        if (BotMoveUci) {
            this.Game.ApplyBotMove(BotMoveUci);
            this.ApplyClockIncrement(BotIsWhite ? 'w' : 'b');
        }
        this.ApplyState(this.Game.GetState());

        // Schedules another bot move if multi-move odds grant an extra turn.
        if (!this.State.GameOver && this.State.Turn !== this.State.PlayerColor) {
            this.ScheduleBotTurn();
            return;
        }

        // Releases the busy lock once control returns to the player.
        this.Busy = false;
    }

    // Handles the player's request to offer a draw to the bot or multiplayer opponent.
    HandleAskForDraw() {
        // Ignores draw offers if the game is not active or the bot is thinking.
        if (!this.GameStarted || this.Busy || !this.State || this.State.GameOver) {
            return;
        }

        // Enforces the maximum of 3 draw requests per game and the 10-second cooldown.
        if (this.DrawRequestsUsed >= MaxDrawRequests) {
            this.Status.SetMessage('You can only ask for a draw 3 times per game.');
            this.Status.Render(this.State);
            return;
        }
        if (this.DrawCooldownSeconds > Zero) {
            this.Status.SetMessage(`Draw request is on cooldown (${this.DrawCooldownSeconds}s remaining).`);
            this.Status.Render(this.State);
            return;
        }
        this.DrawRequestsUsed += One;
        this.StartDrawCooldown();

        // Sends a DrawOffer packet in multiplayer mode.
        this.HidePromotionPicker();
        if (this.State.IsMultiplayer) {
            this.Network.SendPayload({ Type: 'DrawOffer' });
            this.Status.SetMessage('Draw offer sent to opponent.');
            this.Status.Render(this.State);
            return;
        }

        // Evaluates the position and checks whether the bot accepts the draw offer.
        const CurrentScore = this.Bot.EvaluateBoard(this.Game.Board);
        const Accepted = this.Game.OfferDraw(CurrentScore);
        if (Accepted) {
            this.Status.SetMessage('Draw agreed.');
            this.ApplyState(this.Game.GetState());
        } else {
            const BotName = GetBotName(this.State.BotElo);
            this.Status.SetMessage(`${BotName} declined the draw offer.`);
            this.Status.Render(this.State);
        }
    }

    // Handles the player's decision to resign the current game.
    HandleResign() {
        // Ignores resignation if the game is not active.
        if (!this.GameStarted || !this.State || this.State.GameOver) {
            return;
        }

        // Stops any active bot timer, records resignation, and notifies opponent if multiplayer.
        this.ClearBotTimer();
        this.Busy = false;
        this.HidePromotionPicker();
        this.HideDrawOfferPrompt();
        const ResigningColor = this.State.PlayerColor;
        this.Game.Resign(ResigningColor);
        if (this.State.IsMultiplayer) {
            this.Network.SendPayload({ Type: 'Resign', Color: ResigningColor });
        }
        this.ApplyState(this.Game.GetState());
    }

    // Reverts the last move in bot mode or sends an undo request to the opponent in multiplayer.
    Undo() {
        // Validates that the game has started and at least one move can be undone.
        if (!this.GameStarted || !this.State) {
            return;
        }
        if (!this.Game.CanUndo()) {
            this.Status.SetMessage('No moves to undo.');
            this.Status.Render(this.State);
            return;
        }
        if (this.State.IsSandbox) {
            this.HidePromotionPicker();
            this.Game.Undo();
            this.Status.SetMessage('Sandbox action undone.');
            this.ApplyState(this.Game.GetState());
            return;
        }
        if (this.State.GameOver) {
            return;
        }

        // Enforces the maximum of 3 undo requests per game and the 10-second cooldown.
        if (this.UndoRequestsUsed >= MaxUndoRequests) {
            this.Status.SetMessage('You can only ask for an undo 3 times per game.');
            this.Status.Render(this.State);
            return;
        }
        if (this.UndoCooldownSeconds > Zero) {
            this.Status.SetMessage(`Undo is on cooldown (${this.UndoCooldownSeconds}s remaining).`);
            this.Status.Render(this.State);
            return;
        }
        this.UndoRequestsUsed += One;
        this.StartUndoCooldown();

        // Sends an undo request to the opponent for approval when in multiplayer mode.
        this.HidePromotionPicker();
        if (this.State.IsMultiplayer) {
            this.Network.SendPayload({
                Type: 'UndoRequest',
                RequesterColor: this.State.PlayerColor
            });
            this.Status.SetMessage('Undo request sent to opponent.');
            this.Status.Render(this.State);
            return;
        }

        // Stops any active bot timer and reverts back to the player's turn in bot mode.
        this.ClearBotTimer();
        this.Busy = false;
        this.HideDrawOfferPrompt();
        this.Game.UndoForColor(this.State.PlayerColor);
        this.Status.SetMessage('Move undone.');
        this.ApplyState(this.Game.GetState());
        if (!this.State.GameOver && this.State.Turn !== this.State.PlayerColor) {
            this.ScheduleBotTurn();
        }
    }

    // Displays a historical move frame on the board without reverting the game.
    SelectHistoryFrame(FrameIndex) {
        // Validates the requested frame index against the recorded frames array.
        const SourceState = this.ReviewingGame || this.State;
        if (!SourceState || !SourceState.Frames || FrameIndex < Zero || FrameIndex >= SourceState.Frames.length) {
            return;
        }

        // Updates the viewed frame index and refreshes the move list navigation UI.
        this.HidePromotionPicker();
        this.ViewedFrameIndex = FrameIndex;
        const LatestIndex = SourceState.Frames.length - One;
        const DisplayMoves = SourceState.SanHistory || SourceState.History || [];
        this.Moves.Render(DisplayMoves, this.ViewedFrameIndex, LatestIndex);

        // Renders a read-only frame during review or historical inspection, or live board at end.
        if (!this.ReviewingGame && this.ViewedFrameIndex === LatestIndex) {
            this.Board.ApplyState(this.State, this.IsLocalPlayerTurn());
        } else {
            this.Board.ApplyHistoricalFrame(SourceState.Frames[this.ViewedFrameIndex]);
        }
    }

    // Plays a tactile UI click sound whenever any interactive UI control is clicked.
    HandleGlobalUiClick(Event) {
        // Skips board squares (which use move/capture sounds) and disabled buttons.
        if (!this.Feedback || !Event || !Event.target || typeof Event.target.closest !== 'function') {
            return;
        }
        if (Event.target.closest('.Grid')) {
            return;
        }
        const ClickedControl = Event.target.closest('button, select, input, .SavedGameCard, .SidebarLogo, .MoveToken');
        if (!ClickedControl || ClickedControl.disabled) {
            return;
        }
        this.Feedback.PlayUiTap();
    }

    // Steps backward or forward through moves using Left and Right keyboard arrows.
    HandleReviewKeydown(Event) {
        // Ignores keystrokes when focused inside a text input or when no game is displayed.
        if (!Event || (Event.key !== 'ArrowLeft' && Event.key !== 'ArrowRight')) {
            return;
        }
        const ActiveTag = document.activeElement ? document.activeElement.tagName : '';
        if (ActiveTag === 'INPUT' || ActiveTag === 'TEXTAREA' || ActiveTag === 'SELECT') {
            return;
        }
        const SourceState = this.ReviewingGame || (this.GameStarted ? this.State : null);
        if (!SourceState || !SourceState.Frames || SourceState.Frames.length <= One) {
            return;
        }
        if (Event.key === 'ArrowLeft' && this.ViewedFrameIndex > Zero) {
            Event.preventDefault();
            this.Feedback.PlayUiTap();
            this.SelectHistoryFrame(this.ViewedFrameIndex - One);
        } else if (Event.key === 'ArrowRight' && this.ViewedFrameIndex < SourceState.Frames.length - One) {
            Event.preventDefault();
            this.Feedback.PlayUiTap();
            this.SelectHistoryFrame(this.ViewedFrameIndex + One);
        }
    }

    // Saves the currently active game to localStorage once at least one move has been played.
    PersistActiveGame(State) {
        // Skips saving during review mode or before the opening move is played.
        if (!this.GameStarted || this.ReviewingGame || !State || !State.History || State.History.length === Zero) {
            return;
        }
        if (!this.ActiveGameId) {
            this.ActiveGameId = this.Store.CreateGameId();
            this.ActiveGameCreatedAt = Date.now();
        }
        let OpponentLabel = 'Sandbox';
        let ModeName = 'sandbox';
        if (State.IsMultiplayer) {
            OpponentLabel = this.OpponentName || 'Opponent';
            ModeName = 'multiplayer';
        } else if (!State.IsSandbox) {
            OpponentLabel = `${GetBotName(State.BotElo)} (${State.BotElo})`;
            ModeName = 'bot';
        }
        const Record = {
            Id: this.ActiveGameId,
            CreatedAt: this.ActiveGameCreatedAt || Date.now(),
            UpdatedAt: Date.now(),
            Mode: ModeName,
            OpponentLabel: OpponentLabel,
            PlayerColor: State.PlayerColor || 'w',
            BotElo: State.BotElo || DefaultBotElo,
            IsMultiplayer: Boolean(State.IsMultiplayer),
            IsSandbox: Boolean(State.IsSandbox),
            GameOver: Boolean(State.GameOver),
            Result: State.Result || '',
            Turn: State.Turn || 'w',
            InCheck: Boolean(State.InCheck),
            LastSpecialText: State.LastSpecialText || '',
            Fen: State.Fen || '',
            SanHistory: (State.SanHistory || []).slice(),
            History: (State.History || []).slice(),
            Frames: (State.Frames || []).map((Frame) => ({
                Fen: Frame.Fen,
                LastMove: Frame.LastMove || null,
                CheckedKingSquare: Frame.CheckedKingSquare || null,
                CheckmatedKingSquare: Frame.CheckmatedKingSquare || null
            }))
        };
        this.Store.SaveGame(Record);
        this.RenderSavedGamesSidebar();
    }

    // Highlights the active sidebar navigation button (home, daily, random, or none).
    UpdateSidebarNavActive(ActiveKey) {
        // Applies ActiveSidebarNav to the matching sidebar button and clears the others.
        const Entries = [
            { Key: 'home', Button: this.SidebarHomeButton },
            { Key: 'daily', Button: this.SidebarDailyPuzzleButton },
            { Key: 'random', Button: this.SidebarRandomPuzzleButton }
        ];
        for (let Index = Zero; Index < Entries.length; Index += One) {
            const Entry = Entries[Index];
            if (!Entry.Button) {
                continue;
            }
            if (Entry.Key === ActiveKey) {
                Entry.Button.classList.add('ActiveSidebarNav');
            } else {
                Entry.Button.classList.remove('ActiveSidebarNav');
            }
        }
    }

    // Opens the sidebar on desktop or slides out the mobile drawer.
    OpenSidebar() {
        // Expands the desktop sidebar or toggles the mobile drawer open.
        if (!this.AppSidebar) {
            return;
        }
        if (typeof window !== 'undefined' && window.innerWidth <= MobileBreakpointPx) {
            this.ToggleMobileSidebar();
            return;
        }
        this.AppSidebar.classList.remove('SidebarCollapsed');
        if (this.MobileMenuButton) {
            this.MobileMenuButton.classList.remove('ShowDesktopToggle');
        }
    }

    // Closes the sidebar on desktop or slides shut the mobile drawer.
    CloseSidebar() {
        // Collapses the desktop sidebar and reveals the reopen button, or closes mobile drawer.
        if (!this.AppSidebar) {
            return;
        }
        if (typeof window !== 'undefined' && window.innerWidth <= MobileBreakpointPx) {
            this.CloseMobileSidebar();
            return;
        }
        this.AppSidebar.classList.add('SidebarCollapsed');
        if (this.MobileMenuButton) {
            this.MobileMenuButton.classList.add('ShowDesktopToggle');
        }
    }

    // Toggles sound effects and mobile haptics on or off from the sidebar toolbar.
    ToggleFeedbackAudio() {
        // Flips Feedback.Enabled and updates the volume icon and active highlight.
        if (!this.Feedback || !this.SidebarAudioButton) {
            return;
        }
        this.Feedback.Enabled = !this.Feedback.Enabled;
        const IconName = this.Feedback.Enabled ? 'volume-2' : 'volume-x';
        this.SidebarAudioButton.innerHTML = `<i data-lucide="${IconName}"></i>`;
        this.SidebarAudioButton.title = this.Feedback.Enabled ? 'Mute sound' : 'Unmute sound';
        if (this.Feedback.Enabled) {
            this.SidebarAudioButton.classList.remove('ActiveSidebarIcon');
        } else {
            this.SidebarAudioButton.classList.add('ActiveSidebarIcon');
        }
        this.RefreshIcons();
    }

    // Cycles the saved games filter across All, Wins, Losses, and Draws.
    CycleSavedGamesFilter() {
        // Advances GameFilterIndex, updates the filter button state, and re-renders the list.
        this.GameFilterIndex = (this.GameFilterIndex + One) % SidebarFilterModes.length;
        const ActiveMode = SidebarFilterModes[this.GameFilterIndex];
        if (this.SidebarFilterButton) {
            const ModeNames = { all: 'All', Win: 'Wins', Loss: 'Losses', Draw: 'Draws' };
            this.SidebarFilterButton.title = `Filter games (${ModeNames[ActiveMode]})`;
            if (ActiveMode === 'all') {
                this.SidebarFilterButton.classList.remove('ActiveSidebarIcon');
            } else {
                this.SidebarFilterButton.classList.add('ActiveSidebarIcon');
            }
        }
        this.RenderSavedGamesSidebar();
    }

    // Toggles the mobile slide-over sidebar drawer open or closed.
    ToggleMobileSidebar() {
        // Opens the drawer if closed, or closes it if already open.
        if (!this.AppSidebar) {
            return;
        }
        const IsOpen = this.AppSidebar.classList.contains('SidebarOpen');
        if (IsOpen) {
            this.CloseMobileSidebar();
        } else {
            this.AppSidebar.classList.add('SidebarOpen');
            if (this.SidebarBackdrop) {
                this.SidebarBackdrop.classList.add('SidebarOpen');
            }
        }
    }

    // Closes the mobile slide-over sidebar drawer and hides its backdrop.
    CloseMobileSidebar() {
        // Removes SidebarOpen from both AppSidebar and SidebarBackdrop.
        if (this.AppSidebar) {
            this.AppSidebar.classList.remove('SidebarOpen');
        }
        if (this.SidebarBackdrop) {
            this.SidebarBackdrop.classList.remove('SidebarOpen');
        }
    }

    // Opens a saved game from localStorage for move-by-move inspection on the board.
    OpenSavedGame(GameId) {
        // Closes mobile drawer, loads the saved record, and exits any live game or lobby.
        this.CloseMobileSidebar();
        const Record = this.Store.GetGameById(GameId);
        if (!Record || !Record.Frames || Record.Frames.length === Zero) {
            return;
        }
        this.ClearBotTimer();
        this.ClearPublicGuestTimer();
        this.StopClockTimer();
        this.Lobby.LeaveQueue();
        this.Network.Disconnect();
        this.Physics.Reset();
        this.HidePromotionPicker();
        this.HideDrawOfferPrompt();
        this.Busy = false;
        this.GameStarted = false;
        this.ReviewingGame = Record;
        this.State = Record;
        this.Selected = null;

        // Reveals the board and review panels while hiding live game action buttons.
        if (this.BoardColumnBox) {
            this.BoardColumnBox.classList.remove('Hidden');
        }
        if (this.WorkspaceLayout) {
            this.WorkspaceLayout.classList.remove('PreGameLayout');
        }
        this.BotSelectorBox.classList.add('Hidden');
        if (this.SandboxBox) {
            this.SandboxBox.classList.add('Hidden');
        }
        if (this.OpponentBannerBox) {
            this.OpponentBannerBox.classList.add('Hidden');
            this.OpponentBannerBox.innerHTML = '';
        }
        this.GameControlsBox.classList.add('Hidden');
        this.PostGameControlsBox.classList.remove('Hidden');
        if (this.RematchButton) {
            this.RematchButton.classList.add('Hidden');
        }
        this.StatusBox.classList.remove('Hidden');
        this.MoveListBox.classList.remove('Hidden');

        // Renders the saved game's final position ready for move-by-move navigation.
        this.Board.SetFlipped(Record.PlayerColor === 'b');
        const LatestIndex = Record.Frames.length - One;
        this.ViewedFrameIndex = LatestIndex;
        this.Board.ApplyHistoricalFrame(Record.Frames[LatestIndex]);
        const DisplayMoves = Record.SanHistory && Record.SanHistory.length > Zero ? Record.SanHistory : Record.History;
        this.Moves.Render(DisplayMoves || [], this.ViewedFrameIndex, LatestIndex);
        this.Status.SetRoomCode('');
        this.Status.SetMessage(`Reviewing vs ${Record.OpponentLabel} — use arrows or move list.`);
        this.Status.Render(Record);
        this.UpdateEmotiveMood(null);
        this.UpdateSidebarNavActive('');
        this.RenderSavedGamesSidebar();
        this.RefreshIcons();
    }

    // Renders all saved games from localStorage into the left navigation sidebar.
    RenderSavedGamesSidebar() {
        // Exits if the sidebar list container is not mounted.
        if (!this.SavedGamesListBox) {
            return;
        }
        this.SavedGamesListBox.innerHTML = '';
        const ActiveFilter = SidebarFilterModes[this.GameFilterIndex] || 'all';
        if (this.SidebarGamesLabel) {
            const LabelMap = { all: 'Your Games', Win: 'Your Games · Wins', Loss: 'Your Games · Losses', Draw: 'Your Games · Draws' };
            this.SidebarGamesLabel.textContent = LabelMap[ActiveFilter] || 'Your Games';
        }
        const AllGames = this.Store.LoadGames();
        const Games = ActiveFilter === 'all'
            ? AllGames
            : AllGames.filter((Item) => this.ClassifySavedOutcome(Item).Label === ActiveFilter);
        if (Games.length === Zero) {
            const Empty = document.createElement('div');
            Empty.className = 'SavedGamesEmpty';
            Empty.textContent = ActiveFilter === 'all'
                ? 'No games played yet. Start a match to archive it here.'
                : `No ${ActiveFilter.toLowerCase()} games found.`;
            this.SavedGamesListBox.appendChild(Empty);
            return;
        }

        // Builds a clickable card for each saved game with outcome pill and delete control.
        const HighlightId = this.ReviewingGame ? this.ReviewingGame.Id : this.ActiveGameId;
        for (let Index = Zero; Index < Games.length; Index += One) {
            const Item = Games[Index];
            const Card = this.BuildSavedGameCard(Item, Item.Id === HighlightId);
            this.SavedGamesListBox.appendChild(Card);
        }
    }

    // Builds a single sidebar card representing a saved game in localStorage.
    BuildSavedGameCard(Record, IsActive) {
        // Creates the card container, title row, delete button, and outcome metadata.
        const Card = document.createElement('div');
        Card.className = IsActive ? 'SavedGameCard ActiveSavedGame' : 'SavedGameCard';
        const TopRow = document.createElement('div');
        TopRow.className = 'SavedGameTopRow';
        const Title = document.createElement('span');
        Title.className = 'SavedGameTitle';
        Title.textContent = Record.OpponentLabel || 'Saved Game';
        const DeleteBtn = document.createElement('button');
        DeleteBtn.type = 'button';
        DeleteBtn.className = 'SavedGameDeleteBtn';
        DeleteBtn.textContent = '×';
        DeleteBtn.title = 'Delete game';
        DeleteBtn.addEventListener('click', (Event) => {
            Event.stopPropagation();
            this.Store.DeleteGame(Record.Id);
            if (this.ReviewingGame && this.ReviewingGame.Id === Record.Id) {
                this.ShowPreGameSetup();
                return;
            }
            this.RenderSavedGamesSidebar();
        });
        TopRow.appendChild(Title);
        TopRow.appendChild(DeleteBtn);

        // Builds the bottom row with outcome badge, move count, and date.
        const MetaRow = document.createElement('div');
        MetaRow.className = 'SavedGameMetaRow';
        const Pill = document.createElement('span');
        const Outcome = this.ClassifySavedOutcome(Record);
        Pill.className = `SavedGamePill ${Outcome.ClassName}`;
        Pill.textContent = Outcome.Label;
        const MoveCount = Record.History ? Math.ceil(Record.History.length / Two) : Zero;
        const DateText = this.Store.FormatTimestamp(Record.UpdatedAt || Record.CreatedAt);
        const Info = document.createElement('span');
        Info.textContent = `${MoveCount}m · ${DateText}`;
        MetaRow.appendChild(Pill);
        MetaRow.appendChild(Info);
        Card.appendChild(TopRow);
        Card.appendChild(MetaRow);
        Card.addEventListener('click', () => {
            this.OpenSavedGame(Record.Id);
        });
        return Card;
    }

    // Classifies a saved game's outcome into Win, Loss, Draw, or In Progress.
    ClassifySavedOutcome(Record) {
        // Checks GameOver and Result text against both bot ("You win") and multiplayer results.
        if (!Record || !Record.GameOver) {
            return { Label: 'In Progress', ClassName: '' };
        }
        const ResultLower = String(Record.Result || '').toLowerCase();
        if (ResultLower.includes('draw') || ResultLower.includes('stalemate')) {
            return { Label: 'Draw', ClassName: 'PillDraw' };
        }
        const SideName = Record.PlayerColor === 'b' ? 'black' : 'white';
        if (ResultLower.includes('you win') || ResultLower.includes(`${SideName} wins`)) {
            return { Label: 'Win', ClassName: 'PillWin' };
        }
        return { Label: 'Loss', ClassName: 'PillLoss' };
    }

    // Checks whether it is currently the local human player's turn to move.
    IsLocalPlayerTurn() {
        // Verifies that the game is active and Turn matches PlayerColor (or Sandbox mode).
        if (!this.State || this.State.GameOver) {
            return false;
        }
        if (this.State.IsSandbox) {
            return true;
        }
        return this.State.Turn === this.State.PlayerColor;
    }

    // Synchronizes the controller state and refreshes the board, move list, and status.
    ApplyState(NewState) {
        // Stores the new state and sets the history viewer to the latest frame.
        this.State = NewState;
        this.Selected = null;
        const LatestIndex = NewState.Frames.length - One;
        this.ViewedFrameIndex = LatestIndex;

        // Updates the board, move list, status, sandbox, and opponent banner panels.
        if (NewState.GameOver) {
            this.StopClockTimer();
            this.Status.SetRoomCode('');
            this.ClearRoomQueryFromUrl();
        }
        const AllowBoardMoves = this.IsLocalPlayerTurn() && (!NewState.IsSandbox || this.SandboxTool === 'move');
        const PremoveColor = this.CanUsePremove(NewState) ? NewState.PlayerColor : null;
        this.Board.SetPremoveState(this.QueuedPremove, PremoveColor);
        const DisplayMoves = NewState.SanHistory || NewState.History;
        this.Board.ApplyState(NewState, AllowBoardMoves);
        this.Moves.Render(DisplayMoves, this.ViewedFrameIndex, LatestIndex);
        this.Status.Render(NewState);
        this.RenderOpponentBanner(NewState);
        this.UpdateEmotiveMood(NewState);
        if (!this.InPuzzleMode) {
            this.PersistActiveGame(NewState);
        }
        if (NewState.IsSandbox) {
            this.RenderSandboxPanel();
        }
        if (this.InPuzzleMode) {
            this.RenderPuzzlePanel();
        }
        if (this.QueuedPremove && this.IsLocalPlayerTurn() && !NewState.GameOver && !this.InPuzzleMode) {
            this.TryExecuteQueuedPremove(NewState);
        }

        // Configures action buttons for Sandbox mode, finished games, or active matches.
        if (NewState.IsSandbox) {
            this.PostGameControlsBox.classList.remove('Hidden');
            if (this.RematchButton) {
                this.RematchButton.classList.add('Hidden');
            }
            this.UndoButton.classList.remove('Hidden');
            this.UndoButton.disabled = !this.Game.CanUndo();
            if (this.UndoButtonText) {
                this.UndoButtonText.textContent = 'Undo';
            }
            this.DrawButton.classList.add('Hidden');
            this.ResignButton.classList.add('Hidden');
        } else if (NewState.GameOver) {
            this.ClearCooldownTimers();
            this.PostGameControlsBox.classList.remove('Hidden');
            if (this.RematchButton) {
                if (NewState.IsMultiplayer) {
                    this.RematchButton.classList.remove('Hidden');
                } else {
                    this.RematchButton.classList.add('Hidden');
                }
            }
            this.UndoButton.classList.add('Hidden');
            this.DrawButton.classList.add('Hidden');
            this.ResignButton.classList.add('Hidden');
        } else {
            this.PostGameControlsBox.classList.add('Hidden');
            if (this.RematchButton) {
                this.RematchButton.classList.add('Hidden');
            }
            this.UndoButton.classList.remove('Hidden');
            this.DrawButton.classList.remove('Hidden');
            this.ResignButton.classList.remove('Hidden');
            this.UpdateRequestButtons();
        }
        this.RefreshIcons();
    }

    // Displays the opponent/bot name, chess clocks, and captured pieces below the buttons.
    RenderOpponentBanner(State) {
        // Hides the banner before game start or during Sandbox mode.
        if (!this.OpponentBannerBox) {
            return;
        }
        if (!this.GameStarted || !State || State.IsSandbox) {
            this.OpponentBannerBox.classList.add('Hidden');
            this.OpponentBannerBox.innerHTML = '';
            return;
        }

        // Builds the primary opponent/bot identity card.
        this.OpponentBannerBox.classList.remove('Hidden');
        this.OpponentBannerBox.innerHTML = '';
        const Panel = document.createElement('div');
        Panel.className = 'Panel';
        const Card = document.createElement('div');
        Card.className = 'OpponentBannerCard';
        const Left = document.createElement('div');
        Left.className = 'OpponentBannerLeft';
        const Icon = document.createElement('i');
        Icon.setAttribute('data-lucide', State.IsMultiplayer ? 'user' : 'bot');
        const Prefix = document.createElement('span');
        Prefix.textContent = 'Playing against:';
        const NameSpan = document.createElement('span');
        NameSpan.className = 'OpponentBannerName';
        if (State.IsMultiplayer) {
            NameSpan.textContent = this.OpponentName || 'Opponent';
        } else {
            const BotName = GetBotName(State.BotElo);
            NameSpan.textContent = `${BotName} (${State.BotElo} Elo)`;
        }
        Left.appendChild(Icon);
        Left.appendChild(Prefix);
        Card.appendChild(Left);
        Card.appendChild(NameSpan);
        Panel.appendChild(Card);

        // Appends the live White and Black chess clocks when a time control is active.
        if (this.TimeControlSeconds > Zero) {
            Panel.appendChild(this.BuildClocksRow(State));
        }

        // Appends the captured pieces and material advantage breakdown.
        if (State.Material) {
            Panel.appendChild(this.BuildMaterialRow(State.Material));
        }
        this.OpponentBannerBox.appendChild(Panel);
    }

    // Builds the White and Black countdown clock badges for timed games.
    BuildClocksRow(State) {
        // Creates two clock badges highlighting the side whose clock is currently ticking.
        const Row = document.createElement('div');
        Row.className = 'ClockBarRow';
        const WhiteActive = !State.GameOver && State.Turn === 'w';
        const BlackActive = !State.GameOver && State.Turn === 'b';
        const WhiteBadge = this.BuildSingleClockBadge('White', this.WhiteClockSeconds, WhiteActive);
        const BlackBadge = this.BuildSingleClockBadge('Black', this.BlackClockSeconds, BlackActive);
        Row.appendChild(WhiteBadge);
        Row.appendChild(BlackBadge);
        return Row;
    }

    // Builds an individual side's clock badge with low-time warning styling.
    BuildSingleClockBadge(SideLabel, RemainingSeconds, IsActive) {
        // Formats the MM:SS time and applies active or low-time classes.
        const Badge = document.createElement('div');
        let ClassText = 'ClockBadge';
        if (IsActive) {
            ClassText += ' ActiveClockBadge';
        }
        if (RemainingSeconds <= LowClockWarningSeconds) {
            ClassText += ' LowTimeClockBadge';
        }
        Badge.className = ClassText;
        const LabelSpan = document.createElement('span');
        LabelSpan.textContent = SideLabel;
        const TimeSpan = document.createElement('span');
        TimeSpan.textContent = this.FormatClockTime(RemainingSeconds);
        Badge.appendChild(LabelSpan);
        Badge.appendChild(TimeSpan);
        return Badge;
    }

    // Builds the captured pieces and material lead (+N) display for White and Black.
    BuildMaterialRow(Material) {
        // Creates a row showing captured pieces and material advantage for each side.
        const Container = document.createElement('div');
        Container.className = 'MaterialBarRow';
        const WhiteAdv = Material.WhiteAdvantage > Zero ? Material.WhiteAdvantage : Zero;
        const BlackAdv = Material.WhiteAdvantage < Zero ? -Material.WhiteAdvantage : Zero;
        Container.appendChild(this.BuildSideMaterialLine('White captures:', Material.CapturedByWhite, WhiteAdv));
        Container.appendChild(this.BuildSideMaterialLine('Black captures:', Material.CapturedByBlack, BlackAdv));
        return Container;
    }

    // Builds a single side's captured piece icons and +N material advantage badge.
    BuildSideMaterialLine(LabelText, CapturedCodes, AdvantagePoints) {
        // Appends mini SVG icons for each captured piece or a dash when none are captured.
        const Line = document.createElement('div');
        Line.className = 'MaterialSideLine';
        const LeftGroup = document.createElement('div');
        LeftGroup.className = 'CapturedPiecesGroup';
        const Label = document.createElement('span');
        Label.textContent = LabelText;
        LeftGroup.appendChild(Label);
        if (!CapturedCodes || CapturedCodes.length === Zero) {
            const NoneSpan = document.createElement('span');
            NoneSpan.textContent = '—';
            LeftGroup.appendChild(NoneSpan);
        } else {
            for (let Index = Zero; Index < CapturedCodes.length; Index += One) {
                const Code = CapturedCodes[Index];
                const Asset = PieceAssetPaths[Code];
                if (Asset) {
                    const Img = document.createElement('img');
                    Img.className = 'CapturedMiniIcon';
                    Img.src = Asset;
                    Img.alt = Code;
                    LeftGroup.appendChild(Img);
                }
            }
        }
        Line.appendChild(LeftGroup);

        // Appends the +N material advantage badge when this side is ahead in material.
        if (AdvantagePoints > Zero) {
            const AdvBadge = document.createElement('span');
            AdvBadge.className = 'MaterialLeadBadge';
            AdvBadge.textContent = `+${AdvantagePoints}`;
            Line.appendChild(AdvBadge);
        }
        return Line;
    }

    // Updates ambient board and page mood states based on check, clock urgency, and outcome.
    UpdateEmotiveMood(State) {
        // Computes the active emotive mood class and plays matching audio/haptic cues.
        let NextMood = '';
        if (this.GameStarted && State) {
            const HistoryLen = State.History ? State.History.length : Zero;
            const SoundKey = State.LastMove ? `${HistoryLen}_${State.LastMove}` : '';
            const IsNewMove = SoundKey !== '' && SoundKey !== this.LastSoundMoveKey;
            if (IsNewMove) {
                this.LastSoundMoveKey = SoundKey;
                const LastSan = (State.SanHistory && State.SanHistory.length > Zero) ? State.SanHistory[State.SanHistory.length - One] : '';
                const WasCapture = typeof LastSan === 'string' && LastSan.includes('x');
                if (State.InCheck) {
                    this.Feedback.PlayCheck();
                } else if (WasCapture) {
                    this.Feedback.PlayCapture();
                } else {
                    this.Feedback.PlayMove();
                }
            }
            if (State.GameOver) {
                const ResultLower = String(State.Result || '').toLowerCase();
                const PlayerSide = State.PlayerColor === 'w' ? 'white' : 'black';
                if (!State.IsSandbox && (ResultLower.includes('you win') || ResultLower.includes(`${PlayerSide} wins`))) {
                    NextMood = 'MoodVictory';
                    if (!this.CelebratedVictory) {
                        this.CelebratedVictory = true;
                        this.Board.SpawnVictorySparks();
                    }
                    if (!this.PlayedEndFeedback) {
                        this.PlayedEndFeedback = true;
                        this.Feedback.PlayVictory();
                    }
                } else if (ResultLower.includes('draw') || ResultLower.includes('stalemate')) {
                    NextMood = 'MoodDraw';
                    if (!this.PlayedEndFeedback) {
                        this.PlayedEndFeedback = true;
                        this.Feedback.PlayDraw();
                    }
                } else if (!State.IsSandbox) {
                    NextMood = 'MoodDefeat';
                    if (!this.PlayedEndFeedback) {
                        this.PlayedEndFeedback = true;
                        this.Feedback.PlayDefeat();
                    }
                }
            } else if (State.InCheck) {
                NextMood = 'MoodCheck';
                const CheckKey = `${HistoryLen}_${State.LastMove || ''}`;
                if (CheckKey !== this.LastCheckMoveKey) {
                    this.LastCheckMoveKey = CheckKey;
                    this.Board.TriggerBoardShake();
                }
            } else if (this.TimeControlSeconds > Zero) {
                const ActiveClock = State.Turn === 'w' ? this.WhiteClockSeconds : this.BlackClockSeconds;
                if (ActiveClock <= LowClockWarningSeconds) {
                    NextMood = 'MoodUrgent';
                } else if (!State.IsSandbox && State.Turn === State.PlayerColor) {
                    NextMood = 'MoodYourTurn';
                }
            } else if (!State.IsSandbox && State.Turn === State.PlayerColor) {
                NextMood = 'MoodYourTurn';
            }
        }

        // Applies the computed mood to the board panel and ambient page backdrop.
        this.Board.SetMood(NextMood);
        if (typeof document !== 'undefined' && document.body && document.body.classList) {
            document.body.classList.remove('MoodCheck', 'MoodVictory', 'MoodUrgent', 'MoodDraw');
            if (NextMood === 'MoodCheck' || NextMood === 'MoodVictory' || NextMood === 'MoodUrgent' || NextMood === 'MoodDraw') {
                document.body.classList.add(NextMood);
            }
        }
    }

    // Checks whether premoving is currently permitted on the given game state.
    CanUsePremove(State) {
        // Allows premoves during active Bot or Multiplayer matches on the opponent's turn.
        if (!this.GameStarted || !State || State.GameOver || State.IsSandbox || this.InPuzzleMode) {
            return false;
        }
        return State.Turn !== State.PlayerColor;
    }

    // Queues a premove from FromSquare to ToSquare and highlights both squares on the board.
    QueuePremove(FromSquare, ToSquare) {
        // Stores the queued premove UCI, clears selection, and updates board visuals.
        this.QueuedPremove = FromSquare + ToSquare;
        this.PremoveOrigin = null;
        this.Selected = null;
        this.Board.ApplySelection(null);
        this.Board.SetPremoveState(this.QueuedPremove, this.State ? this.State.PlayerColor : null);
        this.Board.Render([], this.State ? this.State.LastMove : null);
        this.Feedback.PlayUiTap();
    }

    // Clears any queued premove and pending premove execution timer.
    ClearPremove() {
        // Cancels PremoveTimerId and removes premove square highlights.
        if (this.PremoveTimerId !== null) {
            clearTimeout(this.PremoveTimerId);
            this.PremoveTimerId = null;
        }
        this.QueuedPremove = null;
        this.PremoveOrigin = null;
        if (this.Board) {
            this.Board.SetPremoveState(null, null);
        }
    }

    // Executes the queued premove immediately if it is legal on the newly arrived turn.
    TryExecuteQueuedPremove(NewState) {
        // Validates the queued premove (or auto-queen promotion) against LegalMoves.
        const Candidate = this.QueuedPremove;
        this.ClearPremove();
        if (!Candidate || !NewState || !NewState.LegalMoves) {
            return;
        }
        let FinalMove = '';
        if (NewState.LegalMoves.includes(Candidate)) {
            FinalMove = Candidate;
        } else if (NewState.LegalMoves.includes(`${Candidate}q`)) {
            FinalMove = `${Candidate}q`;
        }
        if (FinalMove === '') {
            return;
        }
        this.PremoveTimerId = setTimeout(() => {
            this.PremoveTimerId = null;
            if (this.GameStarted && !this.Busy && this.IsLocalPlayerTurn()) {
                this.SendMove(FinalMove);
            }
        }, PremoveExecDelayMs);
    }

    // Cancels any pending puzzle opponent reply timer.
    ClearPuzzleTimer() {
        // Clears PuzzleReplyTimerId if currently scheduled.
        if (this.PuzzleReplyTimerId !== null) {
            clearTimeout(this.PuzzleReplyTimerId);
            this.PuzzleReplyTimerId = null;
        }
    }

    // Starts a local Daily or Random tactical puzzle session on the board.
    StartPuzzleSession(IsDaily) {
        // Resets active sessions, reveals the board, and loads a local tactical puzzle.
        this.ClearBotTimer();
        this.ClearPublicGuestTimer();
        this.ClearPremove();
        this.ClearPuzzleTimer();
        this.StopClockTimer();
        this.Lobby.LeaveQueue();
        this.Network.Disconnect();
        this.Physics.Reset();
        this.HidePromotionPicker();
        this.HideDrawOfferPrompt();
        this.InPuzzleMode = true;
        this.GameStarted = true;
        this.ReviewingGame = null;
        this.Busy = false;
        this.PuzzleSolved = false;
        this.PuzzleHadMistake = false;
        this.PuzzleStepIndex = Zero;
        this.ActivePuzzle = null;
        this.Board.SetHintSquare(null);
        if (this.BoardColumnBox) {
            this.BoardColumnBox.classList.remove('Hidden');
        }
        if (this.WorkspaceLayout) {
            this.WorkspaceLayout.classList.remove('PreGameLayout');
        }
        this.BotSelectorBox.classList.add('Hidden');
        if (this.SandboxBox) {
            this.SandboxBox.classList.add('Hidden');
        }
        if (this.OpponentBannerBox) {
            this.OpponentBannerBox.classList.add('Hidden');
        }
        this.GameControlsBox.classList.add('Hidden');
        this.MoveListBox.classList.add('Hidden');
        this.PostGameControlsBox.classList.remove('Hidden');
        if (this.RematchButton) {
            this.RematchButton.classList.add('Hidden');
        }
        this.StatusBox.classList.remove('Hidden');
        if (this.PuzzleBox) {
            this.PuzzleBox.classList.remove('Hidden');
        }
        this.Status.SetRoomCode('');
        this.UpdateSidebarNavActive(IsDaily ? 'daily' : 'random');
        const Puzzle = this.Puzzles.FetchPuzzle(IsDaily);
        if (!Puzzle) {
            return;
        }
        this.LoadActivePuzzle(Puzzle);
    }

    // Loads a parsed local puzzle onto the board ready for the player's first move.
    LoadActivePuzzle(Puzzle) {
        // Configures ChessGame with the puzzle FEN and sets board orientation to SideToMove.
        this.ClearPuzzleTimer();
        this.ActivePuzzle = Puzzle;
        this.PuzzleStepIndex = Zero;
        this.PuzzleSolved = false;
        this.PuzzleHadMistake = false;
        this.Busy = false;
        this.Board.SetHintSquare(null);
        this.Game.Start(DefaultBotElo, '', One, Puzzle.SideToMove, false, false);
        this.Game.LoadFen(Puzzle.Fen);
        this.Board.SetFlipped(Puzzle.SideToMove === 'b');
        const SideLabel = Puzzle.SideToMove === 'w' ? 'White' : 'Black';
        this.Status.SetMessage(`Find the best move for ${SideLabel}!`);
        this.ApplyState(this.Game.GetState());
        this.GameControlsBox.classList.add('Hidden');
        this.MoveListBox.classList.add('Hidden');
        this.PostGameControlsBox.classList.remove('Hidden');
        if (this.RematchButton) {
            this.RematchButton.classList.add('Hidden');
        }
        this.RefreshIcons();
    }

    // Validates a player's move against the active local puzzle solution line.
    HandlePuzzlePlayerMove(MoveUci) {
        // Ignores moves while loading, waiting for opponent reply, or already solved.
        if (this.Busy || !this.ActivePuzzle || this.PuzzleSolved) {
            return;
        }
        const ExpectedUci = this.ActivePuzzle.SolutionUci[this.PuzzleStepIndex];
        const IsCorrect = MoveUci === ExpectedUci;
        if (!IsCorrect) {
            this.PuzzleHadMistake = true;
            this.Puzzles.ResetStreak();
            this.Board.TriggerBoardShake();
            this.Feedback.PlayIllegal();
            this.Status.SetMessage('Not quite — try another move or click Hint!');
            this.Status.Render(this.State);
            this.RenderPuzzlePanel();
            return;
        }

        // Applies the correct tactical move and checks if the puzzle is complete.
        this.Board.SetHintSquare(null);
        this.Game.PlayerMove(MoveUci);
        this.PuzzleStepIndex += One;
        this.ApplyState(this.Game.GetState());
        this.GameControlsBox.classList.add('Hidden');
        this.MoveListBox.classList.add('Hidden');
        this.PostGameControlsBox.classList.remove('Hidden');
        if (this.PuzzleStepIndex >= this.ActivePuzzle.SolutionUci.length || this.State.GameOver) {
            this.PuzzleSolved = true;
            this.Puzzles.RecordSolved(this.PuzzleHadMistake);
            this.Status.SetMessage('Puzzle solved! Brilliant tactic!');
            this.Status.Render(this.State);
            this.Board.SetMood('MoodVictory');
            this.Board.SpawnVictorySparks();
            this.Feedback.PlayVictory();
            this.RenderPuzzlePanel();
            return;
        }

        // Schedules the puzzle opponent's forced reply after a short beat.
        this.Busy = true;
        this.Status.SetMessage('Correct! Keep going...');
        this.Status.Render(this.State);
        this.PuzzleReplyTimerId = setTimeout(() => {
            this.PuzzleReplyTimerId = null;
            if (!this.InPuzzleMode || !this.ActivePuzzle) {
                return;
            }
            const ReplyUci = this.ActivePuzzle.SolutionUci[this.PuzzleStepIndex];
            if (ReplyUci) {
                this.Game.ApplyBotMove(ReplyUci);
                this.PuzzleStepIndex += One;
            }
            this.Busy = false;
            this.Status.SetMessage('Your turn — find the follow-up!');
            this.ApplyState(this.Game.GetState());
            this.GameControlsBox.classList.add('Hidden');
            this.MoveListBox.classList.add('Hidden');
            this.PostGameControlsBox.classList.remove('Hidden');
        }, PuzzleReplyDelayMs);
    }

    // Highlights the source square of the expected move as a tactical hint.
    ShowPuzzleHint() {
        // Marks the puzzle as assisted and highlights the piece to move.
        if (!this.InPuzzleMode || !this.ActivePuzzle || this.PuzzleSolved) {
            return;
        }
        const ExpectedUci = this.ActivePuzzle.SolutionUci[this.PuzzleStepIndex];
        if (!ExpectedUci) {
            return;
        }
        this.PuzzleHadMistake = true;
        const HintSq = ExpectedUci.slice(Zero, Two);
        this.Board.SetHintSquare(HintSq);
        this.Board.Render(this.State.LegalMoves, this.State.LastMove);
        this.Status.SetMessage(`Hint: look closely at the piece on ${HintSq.toUpperCase()}.`);
        this.Status.Render(this.State);
    }

    // Renders the tactical puzzle panel with streak stats and Hint/Retry/Next controls.
    RenderPuzzlePanel() {
        // Builds the puzzle header, streak badges, Hint/Retry/Next controls, and link.
        if (!this.PuzzleBox || !this.InPuzzleMode) {
            return;
        }
        this.PuzzleBox.innerHTML = '';
        const Panel = document.createElement('div');
        Panel.className = 'Panel';
        const Title = document.createElement('h3');
        const Icon = document.createElement('i');
        Icon.setAttribute('data-lucide', 'puzzle');
        const TitleText = document.createElement('span');
        TitleText.textContent = this.ActivePuzzle
            ? `${this.ActivePuzzle.Title} (${this.ActivePuzzle.Rating})`
            : 'Tactical Puzzle';
        Title.appendChild(Icon);
        Title.appendChild(TitleText);
        Panel.appendChild(Title);

        // Displays live streak and total solved badges.
        const StatsRow = document.createElement('div');
        StatsRow.className = 'PuzzleStatsRow';
        const StreakBadge = document.createElement('span');
        StreakBadge.className = 'Badge';
        StreakBadge.textContent = `Streak: ${this.Puzzles.Stats.Streak}`;
        const SolvedBadge = document.createElement('span');
        SolvedBadge.className = 'Badge';
        SolvedBadge.textContent = `Solved: ${this.Puzzles.Stats.Solved}`;
        StatsRow.appendChild(StreakBadge);
        StatsRow.appendChild(SolvedBadge);
        Panel.appendChild(StatsRow);

        // Displays Hint and Retry buttons for the active puzzle.
        const ActionRow = document.createElement('div');
        ActionRow.className = 'HistoryControls';
        const HintBtn = document.createElement('button');
        HintBtn.type = 'button';
        HintBtn.className = 'HistoryButton';
        HintBtn.textContent = 'Hint';
        HintBtn.disabled = !this.ActivePuzzle || this.PuzzleSolved;
        HintBtn.addEventListener('click', () => this.ShowPuzzleHint());
        const RetryBtn = document.createElement('button');
        RetryBtn.type = 'button';
        RetryBtn.className = 'HistoryButton';
        RetryBtn.textContent = 'Retry';
        RetryBtn.disabled = !this.ActivePuzzle;
        RetryBtn.addEventListener('click', () => {
            if (this.ActivePuzzle) {
                this.LoadActivePuzzle(this.ActivePuzzle);
            }
        });
        ActionRow.appendChild(HintBtn);
        ActionRow.appendChild(RetryBtn);
        Panel.appendChild(ActionRow);

        // Displays Next Random and Daily Puzzle switcher buttons.
        const NextRow = document.createElement('div');
        NextRow.className = 'Controls';
        const NextBtn = document.createElement('button');
        NextBtn.type = 'button';
        NextBtn.className = 'PrimaryButton';
        NextBtn.textContent = 'Next Puzzle';
        NextBtn.addEventListener('click', () => this.StartPuzzleSession(false));
        const DailyBtn = document.createElement('button');
        DailyBtn.type = 'button';
        DailyBtn.className = 'SecondaryButton';
        DailyBtn.textContent = 'Daily';
        DailyBtn.addEventListener('click', () => this.StartPuzzleSession(true));
        NextRow.appendChild(NextBtn);
        NextRow.appendChild(DailyBtn);
        Panel.appendChild(NextRow);
        this.PuzzleBox.appendChild(Panel);
        this.RefreshIcons();
    }

    // Handles dropping a dragged piece from FromSquare onto ToSquare.
    HandlePieceDrop(FromSquare, ToSquare) {
        // Queues a premove if dropped during the opponent's turn in Bot or Multiplayer mode.
        if (this.CanUsePremove(this.State) && this.ViewedFrameIndex === this.State.Frames.length - One && FromSquare !== ToSquare) {
            const PieceChar = this.Board.PieceAt(FromSquare);
            if (this.Board.IsPieceOfColor(PieceChar, this.State.PlayerColor)) {
                this.QueuePremove(FromSquare, ToSquare);
            }
            return;
        }

        // Ignores drops when not the local player's turn, busy, or viewing historical moves.
        if (!this.GameStarted || !this.IsLocalPlayerTurn() || this.Busy) {
            return;
        }
        if (this.ViewedFrameIndex < this.State.Frames.length - One || FromSquare === ToSquare) {
            return;
        }

        // Attempts to execute the move or open the promotion picker if valid.
        this.Selected = FromSquare;
        const DirectMove = FromSquare + ToSquare;
        const PromotionMoves = this.State.LegalMoves.filter(
            (Item) => Item.startsWith(DirectMove) && Item.length > Four
        );
        if (PromotionMoves.length > Zero) {
            this.ShowPromotionPicker(DirectMove);
            return;
        }
        if (this.State.LegalMoves.includes(DirectMove)) {
            this.HidePromotionPicker();
            this.SendMove(DirectMove);
            return;
        }
        this.Board.TriggerBoardShake();
        this.Feedback.PlayIllegal();
    }

    // Handles clicks on any of the 64 chess board squares.
    HandleSquareClick(SquareName) {
        // Handles click-to-premove selection when waiting for the opponent's turn.
        if (this.CanUsePremove(this.State) && this.ViewedFrameIndex === this.State.Frames.length - One) {
            const ClickedPiece = this.Board.PieceAt(SquareName);
            const IsFriendly = this.Board.IsPieceOfColor(ClickedPiece, this.State.PlayerColor);
            if (this.PremoveOrigin === null) {
                if (IsFriendly) {
                    this.PremoveOrigin = SquareName;
                    this.Board.UpdateSelectionInPlace(SquareName);
                } else if (this.QueuedPremove) {
                    this.ClearPremove();
                    this.Board.Render([], this.State.LastMove);
                }
                return;
            }
            if (SquareName === this.PremoveOrigin) {
                this.ClearPremove();
                this.Board.ApplySelection(null);
                this.Board.Render([], this.State.LastMove);
                return;
            }
            if (IsFriendly) {
                this.PremoveOrigin = SquareName;
                this.Board.UpdateSelectionInPlace(SquareName);
                return;
            }
            this.QueuePremove(this.PremoveOrigin, SquareName);
            return;
        }

        // Applies Sandbox piece addition or removal when an editor tool is selected.
        if (this.GameStarted && this.State && this.State.IsSandbox && this.SandboxTool !== 'move') {
            if (this.ViewedFrameIndex < this.State.Frames.length - One) {
                return;
            }
            const PieceToPlace = this.SandboxTool === 'remove' ? '' : this.SandboxPiece;
            this.Game.SetSquarePiece(SquareName, PieceToPlace);
            this.ApplyState(this.Game.GetState());
            return;
        }

        // Ignores clicks before game start, when not player's turn, or when viewing old moves.
        if (!this.GameStarted || !this.IsLocalPlayerTurn() || this.Busy) {
            return;
        }
        if (this.ViewedFrameIndex < this.State.Frames.length - One) {
            return;
        }

        // Attempts to select a friendly piece if no square is currently selected.
        if (this.Selected === null) {
            this.TrySelect(SquareName);
            return;
        }

        // Checks whether clicking SquareName triggers pawn promotion or a standard move.
        const DirectMove = this.Selected + SquareName;
        const PromotionMoves = this.State.LegalMoves.filter(
            (Item) => Item.startsWith(DirectMove) && Item.length > Four
        );
        if (PromotionMoves.length > Zero) {
            this.ShowPromotionPicker(DirectMove);
            return;
        }
        if (this.State.LegalMoves.includes(DirectMove)) {
            this.HidePromotionPicker();
            this.SendMove(DirectMove);
            return;
        }

        // Switches selection to the newly clicked square if it was not a legal destination.
        this.HidePromotionPicker();
        this.TrySelect(SquareName);
    }

    // Selects SquareName if it has at least one legal move, or clears selection otherwise.
    TrySelect(SquareName) {
        // Checks whether any legal move originates from SquareName.
        const HasPieceHere = this.State.LegalMoves.some(
            (Item) => Item.slice(Zero, Two) === SquareName
        );
        if (!HasPieceHere) {
            this.Selected = null;
            this.Board.ApplySelection(null);
            this.Board.Render(this.State.LegalMoves, this.State.LastMove);
            return;
        }

        // Highlights SquareName and renders its legal destination indicators.
        this.Selected = SquareName;
        this.Board.ApplySelection(SquareName);
        this.Board.Render(this.State.LegalMoves, this.State.LastMove);
    }
}

// Boots the application once the HTML document has finished loading.
window.addEventListener('DOMContentLoaded', () => {
    // Creates and starts the main game controller instance.
    const App = new Controller();
    App.Initialize();
    App.Start();
});
