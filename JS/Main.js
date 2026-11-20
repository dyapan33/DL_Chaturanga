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
const CooldownTickMs = 1000;
const ValidUciPattern = new RegExp('^[a-h][1-8][a-h][1-8][qrbn]?$');

// Coordinates user input, drag-and-drop, multiplayer, chess rules, and bot responses.
class Controller {
    Initialize() {
        // Instantiates the game engine, bot AI, multiplayer manager, and UI views.
        this.State = null;
        this.Selected = null;
        this.Busy = false;
        this.GameStarted = false;
        this.BotTimerId = null;
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
        this.ViewedFrameIndex = Zero;
        this.Game = new ChessGame();
        this.Game.Initialize();
        this.Bot = new ChessBot();
        this.Bot.Initialize();
        this.Network = new MultiplayerManager();
        this.Network.Initialize((Payload) => this.HandleNetworkEvent(Payload));
        this.Board = new BoardView();
        this.Board.Initialize(
            'BoardPanel',
            (SquareName) => this.HandleSquareClick(SquareName),
            (FromSquare, ToSquare) => this.HandlePieceDrop(FromSquare, ToSquare)
        );
        this.Moves = new MoveListView();
        this.Moves.Initialize('MoveList', (FrameIndex) => this.SelectHistoryFrame(FrameIndex));
        this.Status = new StatusView();
        this.Status.Initialize('StatusPanel');
        this.Selector = new BotSelectorView();
        this.Selector.Initialize(
            'BotSelector',
            (Elo, OddsPieces, OddsTimes, PlayerColor) => this.StartBotGame(Elo, OddsPieces, OddsTimes, PlayerColor),
            (HostColor, HostName) => this.CreateMultiplayerGame(HostColor, HostName),
            (CodeOrLink, GuestName) => this.JoinMultiplayerGame(CodeOrLink, GuestName),
            (PlayerColor) => this.StartSandboxGame(PlayerColor)
        );

        // Caches references to the collapsible DOM containers and control buttons.
        this.BotSelectorBox = document.getElementById('BotSelector');
        this.SandboxBox = document.getElementById('SandboxPanel');
        this.MoveListBox = document.getElementById('MoveList');
        this.StatusBox = document.getElementById('StatusPanel');
        this.PromotionBox = document.getElementById('PromotionPanel');
        this.DrawOfferBox = document.getElementById('DrawOfferPanel');
        this.GameControlsBox = document.getElementById('GameControls');
        this.PostGameControlsBox = document.getElementById('PostGameControls');
        this.OpponentBannerBox = document.getElementById('OpponentBanner');
        this.UndoButton = document.getElementById('UndoButton');
        this.UndoButtonText = document.getElementById('UndoButtonText');
        this.DrawButton = document.getElementById('DrawButton');
        this.DrawButtonText = document.getElementById('DrawButtonText');
        this.ResignButton = document.getElementById('ResignButton');

        // Binds click listeners for New Game, Undo, Draw Request, and Resign buttons.
        document.getElementById('NewGameButton').addEventListener('click', () => {
            this.ClearRoomQueryFromUrl();
            this.ShowPreGameSetup();
        });
        this.UndoButton.addEventListener('click', () => this.Undo());
        this.DrawButton.addEventListener('click', () => this.HandleAskForDraw());
        this.ResignButton.addEventListener('click', () => this.HandleResign());
        this.UpdateRequestButtons();
        this.RefreshIcons();
    }

    // Displays the current bot (name and Elo) or multiplayer opponent name below the buttons.
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

        // Builds the banner card showing the bot name + Elo or the multiplayer opponent's name.
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
        this.OpponentBannerBox.appendChild(Panel);
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
        // Cancels any pending bot timer, disconnects multiplayer, and resets flags.
        this.ClearBotTimer();
        this.ResetRequestLimits();
        this.Network.Disconnect();
        this.Status.SetRoomCode('');
        this.Status.SetMessage('');
        this.OpponentName = '';
        this.Selector.ResetMultiplayerState();
        this.Busy = false;
        this.GameStarted = false;
        this.Selected = null;
        this.HidePromotionPicker();
        this.HideDrawOfferPrompt();

        // Resets the board position and renders it without active turn targets.
        this.Board.SetFlipped(false);
        this.Game.Start(DefaultBotElo, '', One, 'w', false);
        this.State = this.Game.GetState();
        this.ViewedFrameIndex = Zero;
        this.Board.ApplyHistoricalFrame(this.State.Frames[Zero]);

        // Shows the bot selector and hides status, moves, sandbox, banner, and game buttons.
        this.BotSelectorBox.classList.remove('Hidden');
        if (this.SandboxBox) {
            this.SandboxBox.classList.add('Hidden');
        }
        if (this.OpponentBannerBox) {
            this.OpponentBannerBox.classList.add('Hidden');
            this.OpponentBannerBox.innerHTML = '';
        }
        this.StatusBox.classList.add('Hidden');
        this.MoveListBox.classList.add('Hidden');
        this.GameControlsBox.classList.add('Hidden');
        this.PostGameControlsBox.classList.add('Hidden');
        this.RefreshIcons();
    }

    // Displays the current bot (name and Elo) or multiplayer opponent name below the buttons.
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

        // Builds the banner card showing the bot name + Elo or the multiplayer opponent's name.
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
        this.OpponentBannerBox.appendChild(Panel);
    }

    // Starts a game against the AI bot with the selected side color and settings.
    StartBotGame(Elo, OddsPieces, OddsTimes, PlayerColor) {
        // Disconnects any multiplayer session and configures the board orientation.
        this.Network.Disconnect();
        const ChosenColor = PlayerColor || 'w';
        const BotName = GetBotName(Elo);
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
        this.Network.Disconnect();
        const ChosenColor = PlayerColor || 'w';
        this.SandboxTool = 'move';
        this.SandboxPiece = '';
        this.ActivateMatchSession(DefaultBotElo, '', One, ChosenColor, false, true);
        this.Status.SetRoomCode('');
        this.Status.SetMessage('Control both sides, or select a tool to add or remove pieces.');
        this.ApplyState(this.Game.GetState());
    }

    // Creates a multiplayer room and displays its code and shareable link.
    CreateMultiplayerGame(HostColor, HostName) {
        // Validates that the host entered a name before creating the room.
        const CleanName = String(HostName || '').trim();
        if (CleanName === '') {
            this.Selector.SetStatusNotice('Please enter your name before creating a game.');
            return;
        }
        const RoomInfo = this.Network.CreateRoom(HostColor || 'w', CleanName);
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
        const Joined = this.Network.JoinRoom(CodeOrLink, CleanName);
        if (!Joined) {
            this.Selector.SetStatusNotice('Invalid room code or link.');
            return;
        }
        this.Selector.SetStatusNotice(`Joining room ${Joined.RoomCode}...`);
    }

    // Transitions the UI from the setup screen into an active match session.
    ActivateMatchSession(Elo, OddsPieces, OddsTimes, PlayerColor, IsMultiplayer, IsSandbox) {
        // Resets timers, flips the board if playing Black, and reveals match panels.
        this.ClearBotTimer();
        this.ResetRequestLimits();
        this.Selector.ResetMultiplayerState();
        this.Busy = false;
        this.GameStarted = true;
        this.HidePromotionPicker();
        this.HideDrawOfferPrompt();
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
        this.SandboxBox.appendChild(Panel);
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
            this.ApplyState(this.Game.GetState());
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
        // Ignores move attempts while busy, before game start, or when not player's turn.
        if (this.Busy || !this.GameStarted || !this.IsLocalPlayerTurn()) {
            return;
        }

        // Executes the player move on the local ChessGame engine.
        const Applied = this.Game.PlayerMove(MoveUci);
        if (!Applied) {
            this.Status.SetMessage('Illegal move.');
            this.Status.Render(this.State);
            return;
        }

        // Updates the UI and either sends the move to the peer or schedules the bot turn.
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

    // Schedules the bot to compute and play its move after a random 1-10s delay.
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
        const BotIsWhite = this.State.PlayerColor === 'b';
        const BotMoveUci = this.Bot.ChooseMove(this.Game, this.State.BotElo, BotIsWhite);
        if (BotMoveUci) {
            this.Game.ApplyBotMove(BotMoveUci);
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
        if (!this.State || !this.State.Frames || FrameIndex < Zero || FrameIndex >= this.State.Frames.length) {
            return;
        }

        // Updates the viewed frame index and refreshes the move list navigation UI.
        this.HidePromotionPicker();
        this.ViewedFrameIndex = FrameIndex;
        const LatestIndex = this.State.Frames.length - One;
        this.Moves.Render(this.State.History, this.ViewedFrameIndex, LatestIndex);

        // Renders the live interactive board if at the latest frame, or a read-only frame otherwise.
        if (this.ViewedFrameIndex === LatestIndex) {
            this.Board.ApplyState(this.State, this.IsLocalPlayerTurn());
        } else {
            this.Board.ApplyHistoricalFrame(this.State.Frames[this.ViewedFrameIndex]);
        }
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
            this.Status.SetRoomCode('');
            this.ClearRoomQueryFromUrl();
        }
        const AllowBoardMoves = this.IsLocalPlayerTurn() && (!NewState.IsSandbox || this.SandboxTool === 'move');
        this.Board.ApplyState(NewState, AllowBoardMoves);
        this.Moves.Render(NewState.History, this.ViewedFrameIndex, LatestIndex);
        this.Status.Render(NewState);
        this.RenderOpponentBanner(NewState);
        if (NewState.IsSandbox) {
            this.RenderSandboxPanel();
        }

        // Configures action buttons for Sandbox mode, finished games, or active matches.
        if (NewState.IsSandbox) {
            this.PostGameControlsBox.classList.remove('Hidden');
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
            this.UndoButton.classList.add('Hidden');
            this.DrawButton.classList.add('Hidden');
            this.ResignButton.classList.add('Hidden');
        } else {
            this.PostGameControlsBox.classList.add('Hidden');
            this.UndoButton.classList.remove('Hidden');
            this.DrawButton.classList.remove('Hidden');
            this.ResignButton.classList.remove('Hidden');
            this.UpdateRequestButtons();
        }
        this.RefreshIcons();
    }

    // Displays the current bot (name and Elo) or multiplayer opponent name below the buttons.
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

        // Builds the banner card showing the bot name + Elo or the multiplayer opponent's name.
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
        this.OpponentBannerBox.appendChild(Panel);
    }

    // Handles dropping a dragged piece from FromSquare onto ToSquare.
    HandlePieceDrop(FromSquare, ToSquare) {
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
        }
    }

    // Handles clicks on any of the 64 chess board squares.
    HandleSquareClick(SquareName) {
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
