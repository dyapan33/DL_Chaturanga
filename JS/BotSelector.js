// Defines material odds presets and multi-move handicap choices.
const OddsOptions = [
    { Value: '', Label: 'Even (no odds)' },
    { Value: 'pawnb1', Label: 'Knight b8 (~500 Elo feel)' },
    { Value: 'knightsb1g1', Label: 'Two knights (~900)' },
    { Value: 'rooksa1h1', Label: 'Two rooks (~1200)' },
    { Value: 'queen', Label: 'Queen (~1500)' },
    { Value: 'rook', Label: 'One rook (~1800)' },
    { Value: 'minor', Label: 'One knight (~2100)' },
    { Value: 'pawn', Label: 'One pawn (~2400)' }
];
const TimesChoices = [One, Three, Nine];
const TimesLabels = [
    '1 move per player turn',
    '3 moves per player turn',
    '9 moves per player turn'
];
const TimeControlOptions = [
    { Key: '0_0', Seconds: Zero, Increment: Zero, Label: 'Unlimited (No Clock)' },
    { Key: '60_0', Seconds: BulletOneMinSeconds, Increment: Zero, Label: '1 min Bullet' },
    { Key: '60_1', Seconds: BulletOneMinSeconds, Increment: One, Label: '1 | 1 Bullet (+1s)' },
    { Key: '180_0', Seconds: BlitzThreeMinSeconds, Increment: Zero, Label: '3 min Blitz' },
    { Key: '180_3', Seconds: BlitzThreeMinSeconds, Increment: Three, Label: '3 | 3 Blitz (+3s)' },
    { Key: '300_0', Seconds: BlitzFiveMinSeconds, Increment: Zero, Label: '5 min Blitz' },
    { Key: '300_3', Seconds: BlitzFiveMinSeconds, Increment: Three, Label: '5 | 3 Blitz (+3s)' },
    { Key: '600_0', Seconds: RapidTenMinSeconds, Increment: Zero, Label: '10 min Rapid' },
    { Key: '600_5', Seconds: RapidTenMinSeconds, Increment: Five, Label: '10 | 5 Rapid (+5s)' }
];

// Renders the game setup panel for Bot, Multiplayer, Public Lobby, and Sandbox modes.
class BotSelectorView {
    Initialize(MountId, OnStartBotGame, OnCreateRoom, OnJoinRoom, OnStartSandbox, OnJoinPublicLobby, OnLeavePublicLobby) {
        // Stores DOM mount element, callbacks, and default setup state.
        this.Root = document.getElementById(MountId);
        this.OnStartBotGame = OnStartBotGame;
        this.OnCreateRoom = OnCreateRoom;
        this.OnJoinRoom = OnJoinRoom;
        this.OnStartSandbox = OnStartSandbox;
        this.OnJoinPublicLobby = OnJoinPublicLobby;
        this.OnLeavePublicLobby = OnLeavePublicLobby;
        this.Mode = 'bot';
        this.SelectedColor = 'w';
        this.SelectedTimeKey = '0_0';
        this.PlayerName = '';
        this.PendingJoinCode = '';
        this.CreatedRoomInfo = null;
        this.StatusNotice = '';
        this.IsPublicSearching = false;
        this.PublicStatusNotice = '';
        this.Panel = null;
        this.ModeTabsBox = null;
        this.BotTabBtn = null;
        this.MultiTabBtn = null;
        this.PublicTabBtn = null;
        this.SandboxTabBtn = null;
        this.SideRow = null;
        this.SideTabsBox = null;
        this.WhiteTabBtn = null;
        this.BlackTabBtn = null;
        this.EloSelect = null;
        this.OddsSelect = null;
        this.TimesSelect = null;
        this.NameInput = null;
        this.JoinInput = null;
        this.Render();
    }

    // Switches the active setup tab between bot, multiplayer, public, and sandbox.
    SetMode(ModeName) {
        // Leaves the public queue if the user navigates away from the Public tab while searching.
        if (this.Mode === 'public' && ModeName !== 'public' && this.IsPublicSearching) {
            this.IsPublicSearching = false;
            this.PublicStatusNotice = '';
            if (this.OnLeavePublicLobby) {
                this.OnLeavePublicLobby();
            }
        }
        this.Mode = ModeName;
        this.Render();
    }

    // Updates the selected side color and slides the side switcher indicator in-place.
    SelectSide(ColorCode) {
        // Stores the chosen color and updates the sliding tab state without rebuilding DOM.
        this.SelectedColor = ColorCode;
        this.UpdateSegmentedStates();
    }

    // Displays created room details (code and shareable link) inside the multiplayer panel.
    SetCreatedRoom(RoomInfo) {
        // Stores the room code and share link and refreshes the multiplayer view.
        this.Mode = 'multiplayer';
        this.CreatedRoomInfo = RoomInfo;
        this.StatusNotice = 'Waiting for opponent to join...';
        this.Render();
    }

    // Updates the status notice text inside the multiplayer setup panel.
    SetStatusNotice(NoticeText) {
        // Stores the notice string and re-renders.
        this.StatusNotice = NoticeText;
        this.Render();
    }

    // Updates the public lobby searching state and status text.
    SetPublicSearching(IsSearching, NoticeText) {
        // Stores the searching flag and notice text and re-renders the setup panel.
        this.IsPublicSearching = Boolean(IsSearching);
        if (typeof NoticeText === 'string') {
            this.PublicStatusNotice = NoticeText;
        }
        this.Render();
    }

    // Updates only the public lobby status message without changing the searching flag.
    SetPublicStatus(NoticeText) {
        // Stores the updated status string and refreshes the setup panel.
        this.PublicStatusNotice = NoticeText || '';
        this.Render();
    }

    // Clears any previously created room code, shareable link, and multiplayer notice.
    ResetMultiplayerState() {
        // Resets CreatedRoomInfo, PendingJoinCode, StatusNotice, and public queue state.
        this.CreatedRoomInfo = null;
        this.PendingJoinCode = '';
        this.StatusNotice = '';
        this.IsPublicSearching = false;
        this.PublicStatusNotice = '';
        this.Render();
    }

    // Switches to Multiplayer mode and pre-fills a room code from an invite link.
    PrefillJoinCode(RoomCode) {
        // Stores the pending room code and prompts the player to enter their name.
        this.Mode = 'multiplayer';
        this.PendingJoinCode = RoomCode || '';
        this.StatusNotice = `Enter your name and click Join to enter room ${this.PendingJoinCode}.`;
        this.Render();
    }

    // Creates the persistent panel header with the two sliding segmented controls once.
    EnsureBaseShell() {
        // Returns immediately if the persistent shell elements already exist.
        if (this.Panel) {
            return;
        }
        this.Root.innerHTML = '';
        this.Panel = document.createElement('div');
        this.Panel.className = 'Panel';
        this.ModeTabsBox = this.BuildModeTabs();
        this.SideRow = this.BuildSidePickerRow();
        this.Panel.appendChild(this.ModeTabsBox);
        this.Panel.appendChild(this.SideRow);
        this.Root.appendChild(this.Panel);
    }

    // Updates the sliding pill position and active button classes on both segmented controls.
    UpdateSegmentedStates() {
        // Updates the Vs Bot / Multiplayer / Public / Sandbox segmented control state.
        if (this.ModeTabsBox) {
            this.ModeTabsBox.classList.remove('SlideSecond', 'SlideThird', 'SlideFourth');
            if (this.Mode === 'multiplayer') {
                this.ModeTabsBox.classList.add('SlideSecond');
            } else if (this.Mode === 'public') {
                this.ModeTabsBox.classList.add('SlideThird');
            } else if (this.Mode === 'sandbox') {
                this.ModeTabsBox.classList.add('SlideFourth');
            }
        }
        if (this.BotTabBtn && this.MultiTabBtn && this.PublicTabBtn && this.SandboxTabBtn) {
            this.BotTabBtn.className = this.Mode === 'bot' ? 'ModeTabButton ActiveModeTab' : 'ModeTabButton';
            this.MultiTabBtn.className = this.Mode === 'multiplayer' ? 'ModeTabButton ActiveModeTab' : 'ModeTabButton';
            this.PublicTabBtn.className = this.Mode === 'public' ? 'ModeTabButton ActiveModeTab' : 'ModeTabButton';
            this.SandboxTabBtn.className = this.Mode === 'sandbox' ? 'ModeTabButton ActiveModeTab' : 'ModeTabButton';
        }

        // Updates the White / Black segmented control state.
        if (this.SideTabsBox) {
            if (this.SelectedColor === 'b') {
                this.SideTabsBox.classList.add('SlideRight');
            } else {
                this.SideTabsBox.classList.remove('SlideRight');
            }
        }
        if (this.WhiteTabBtn && this.BlackTabBtn) {
            this.WhiteTabBtn.className = this.SelectedColor === 'w' ? 'ModeTabButton ActiveModeTab' : 'ModeTabButton';
            this.BlackTabBtn.className = this.SelectedColor === 'b' ? 'ModeTabButton ActiveModeTab' : 'ModeTabButton';
        }
    }

    // Updates the setup panel while preserving the persistent sliding segmented controls.
    Render() {
        // Initializes the persistent shell and updates the sliding tab indicators in-place.
        this.EnsureBaseShell();
        this.UpdateSegmentedStates();

        // Replaces only the dynamic controls below the persistent mode and side switchers.
        while (this.Panel.children.length > Two) {
            const LastChild = this.Panel.children[this.Panel.children.length - One];
            if (this.Panel.removeChild) {
                this.Panel.removeChild(LastChild);
            } else {
                this.Panel.children.pop();
            }
        }
        if (this.Mode === 'bot') {
            this.AppendBotControls(this.Panel);
        } else if (this.Mode === 'multiplayer') {
            this.AppendMultiplayerControls(this.Panel);
        } else if (this.Mode === 'public') {
            this.AppendPublicControls(this.Panel);
        } else {
            this.AppendSandboxControls(this.Panel);
        }

        // Initializes Lucide icons for any newly added buttons.
        if (window.lucide && window.lucide.createIcons) {
            window.lucide.createIcons();
        }
    }

    // Builds the top segmented tab bar switching between Vs Bot, Multiplayer, Public, and Sandbox.
    BuildModeTabs() {
        // Creates the segmented tab container and the four mode tab buttons.
        const Tabs = document.createElement('div');
        Tabs.className = 'ModeTabs FourTabs';
        this.BotTabBtn = this.CreateTabButton('bot', 'Vs Bot', this.Mode === 'bot', () => {
            this.CreatedRoomInfo = null;
            this.StatusNotice = '';
            this.SetMode('bot');
        });
        this.MultiTabBtn = this.CreateTabButton('users', 'Multiplayer', this.Mode === 'multiplayer', () => {
            this.SetMode('multiplayer');
        });
        this.PublicTabBtn = this.CreateTabButton('globe', 'Public', this.Mode === 'public', () => {
            this.CreatedRoomInfo = null;
            this.StatusNotice = '';
            this.SetMode('public');
        });
        this.SandboxTabBtn = this.CreateTabButton('sliders', 'Sandbox', this.Mode === 'sandbox', () => {
            this.CreatedRoomInfo = null;
            this.StatusNotice = '';
            this.SetMode('sandbox');
        });
        Tabs.appendChild(this.BotTabBtn);
        Tabs.appendChild(this.MultiTabBtn);
        Tabs.appendChild(this.PublicTabBtn);
        Tabs.appendChild(this.SandboxTabBtn);
        return Tabs;
    }

    // Creates a single segmented tab button with a Lucide icon and label.
    CreateTabButton(IconName, LabelText, IsActive, OnClick) {
        // Builds the button element and attaches the icon and text.
        const Button = document.createElement('button');
        Button.type = 'button';
        Button.className = IsActive ? 'ModeTabButton ActiveModeTab' : 'ModeTabButton';
        const Icon = document.createElement('i');
        Icon.setAttribute('data-lucide', IconName);
        const Span = document.createElement('span');
        Span.textContent = LabelText;
        Button.appendChild(Icon);
        Button.appendChild(Span);
        Button.addEventListener('click', OnClick);
        return Button;
    }

    // Builds the White / Black side selection row using the same segmented ModeTabs component.
    BuildSidePickerRow() {
        // Creates the row wrapper and label for choosing White or Black.
        const Row = document.createElement('div');
        Row.className = 'SelectorRow';
        const Label = document.createElement('label');
        Label.textContent = 'Choose your side:';
        const Tabs = document.createElement('div');
        Tabs.className = 'ModeTabs';
        this.SideTabsBox = Tabs;

        // Creates the White and Black segmented tab buttons with king SVG icons.
        this.WhiteTabBtn = this.CreateSideButton('w', 'White', 'Assets/ChessKingWhite.svg');
        this.BlackTabBtn = this.CreateSideButton('b', 'Black', 'Assets/ChessKingBlack.svg');
        Tabs.appendChild(this.WhiteTabBtn);
        Tabs.appendChild(this.BlackTabBtn);
        Row.appendChild(Label);
        Row.appendChild(Tabs);
        return Row;
    }

    // Creates a segmented tab button for White or Black inside the side switcher.
    CreateSideButton(ColorCode, LabelText, ImagePath) {
        // Builds the segmented tab button with king piece icon and click handler.
        const Button = document.createElement('button');
        Button.type = 'button';
        const IsSelected = this.SelectedColor === ColorCode;
        Button.className = IsSelected ? 'ModeTabButton ActiveModeTab' : 'ModeTabButton';
        const Img = document.createElement('img');
        Img.src = ImagePath;
        Img.alt = LabelText;
        const Span = document.createElement('span');
        Span.textContent = LabelText;
        Button.appendChild(Img);
        Button.appendChild(Span);
        Button.addEventListener('click', () => {
            this.SelectSide(ColorCode);
        });
        return Button;
    }

    // Appends the Elo, material odds, move multiplier, time control, and Start Game button.
    AppendBotControls(Panel) {
        // Creates the Elo, material odds, move-count, and time control selector rows.
        const EloRow = this.BuildEloRow();
        const OddsRow = this.BuildOddsRow();
        const TimesRow = this.BuildTimesRow();
        const TimeControlRow = this.BuildTimeControlRow();
        this.EloSelect = EloRow.Select;
        this.OddsSelect = OddsRow.Select;
        this.TimesSelect = TimesRow.Select;
        this.TimeSelect = TimeControlRow.Select;
        Panel.appendChild(EloRow.Row);
        Panel.appendChild(OddsRow.Row);
        Panel.appendChild(TimesRow.Row);
        Panel.appendChild(TimeControlRow.Row);

        // Creates the Start Game button with a Lucide play icon.
        const StartButton = document.createElement('button');
        StartButton.type = 'button';
        StartButton.className = 'PrimaryButton';
        const PlayIcon = document.createElement('i');
        PlayIcon.setAttribute('data-lucide', 'play');
        const ButtonLabel = document.createElement('span');
        ButtonLabel.textContent = 'Start Game';
        StartButton.appendChild(PlayIcon);
        StartButton.appendChild(ButtonLabel);
        StartButton.addEventListener('click', () => {
            const Config = this.GetSelectedConfig();
            if (this.OnStartBotGame) {
                this.OnStartBotGame(
                    Config.Elo,
                    Config.OddsPieces,
                    Config.OddsTimes,
                    Config.PlayerColor,
                    Config.TimeSeconds,
                    Config.IncrementSeconds
                );
            }
        });
        Panel.appendChild(StartButton);
    }

    // Appends Create Game (code + link) and Join Game controls for Multiplayer mode.
    AppendMultiplayerControls(Panel) {
        // Creates the container and required player name input for multiplayer.
        const Box = document.createElement('div');
        Box.className = 'MultiplayerSection';
        Box.appendChild(this.BuildNameRow());

        // Creates the Create Game button that generates a room code and shareable link.
        const CreateBtn = document.createElement('button');
        CreateBtn.type = 'button';
        CreateBtn.className = 'PrimaryButton';
        const PlusIcon = document.createElement('i');
        PlusIcon.setAttribute('data-lucide', 'plus-circle');
        const CreateLabel = document.createElement('span');
        CreateLabel.textContent = 'Create Game (Get Code & Link)';
        CreateBtn.appendChild(PlusIcon);
        CreateBtn.appendChild(CreateLabel);
        CreateBtn.addEventListener('click', () => {
            const Name = (this.NameInput ? this.NameInput.value : this.PlayerName).trim();
            this.PlayerName = Name;
            if (Name === '') {
                this.SetStatusNotice('Please enter your name before creating a game.');
                return;
            }
            const TimeConfig = this.GetSelectedTimeControl();
            if (this.OnCreateRoom) {
                this.OnCreateRoom(this.SelectedColor, Name, TimeConfig.Seconds, TimeConfig.Increment);
            }
        });
        Box.appendChild(CreateBtn);

        // Displays the generated room code and shareable link box when a room is active.
        if (this.CreatedRoomInfo) {
            Box.appendChild(this.BuildRoomShareBox(this.CreatedRoomInfo));
        }

        // Appends the divider, Join Game input row, and Time Control selector.
        const Divider = document.createElement('div');
        Divider.className = 'DividerLabel';
        Divider.textContent = '— OR JOIN WITH CODE / LINK —';
        Box.appendChild(Divider);
        Box.appendChild(this.BuildJoinRow());
        const TimeControlRow = this.BuildTimeControlRow();
        this.TimeSelect = TimeControlRow.Select;
        Box.appendChild(TimeControlRow.Row);

        // Appends any status notice text at the bottom of the multiplayer panel.
        if (this.StatusNotice) {
            const Notice = document.createElement('div');
            Notice.className = 'HistoryStatus';
            Notice.textContent = this.StatusNotice;
            Box.appendChild(Notice);
        }
        Panel.appendChild(Box);
    }

    // Builds the required player name input row for multiplayer matches.
    BuildNameRow() {
        // Creates the label and text input for the player's multiplayer display name.
        const Row = document.createElement('div');
        Row.className = 'SelectorRow';
        const Label = document.createElement('label');
        Label.textContent = 'Your name (required for multiplayer):';
        const Input = document.createElement('input');
        Input.type = 'text';
        Input.className = 'TextInput';
        Input.placeholder = 'Enter your name';
        Input.value = this.PlayerName;
        Input.addEventListener('input', () => {
            this.PlayerName = Input.value;
        });
        Input.addEventListener('keydown', (Event) => {
            if (Event && Event.key === 'Enter') {
                Event.preventDefault();
                const Name = Input.value.trim();
                this.PlayerName = Name;
                if (Name === '') {
                    this.SetStatusNotice('Please enter your name first.');
                    return;
                }
                const JoinCode = this.JoinInput ? this.JoinInput.value.trim() : this.PendingJoinCode.trim();
                if (JoinCode !== '' && this.OnJoinRoom) {
                    this.OnJoinRoom(JoinCode, Name);
                } else if (this.OnCreateRoom) {
                    this.OnCreateRoom(this.SelectedColor, Name);
                }
            }
        });
        this.NameInput = Input;
        Row.appendChild(Label);
        Row.appendChild(Input);
        return Row;
    }

    // Appends the Public Lobby random matchmaking controls to the panel.
    AppendPublicControls(Panel) {
        // Creates the container, player name input, and time control selector.
        const Box = document.createElement('div');
        Box.className = 'MultiplayerSection';
        Box.appendChild(this.BuildPublicNameRow());
        const TimeControlRow = this.BuildTimeControlRow();
        this.TimeSelect = TimeControlRow.Select;
        if (this.IsPublicSearching) {
            TimeControlRow.Select.disabled = true;
        }
        Box.appendChild(TimeControlRow.Row);

        // Shows either the active searching box with Cancel or the Find Random Match button.
        if (this.IsPublicSearching) {
            const QueueBox = document.createElement('div');
            QueueBox.className = 'PublicQueueBox';
            const Pulse = document.createElement('div');
            Pulse.className = 'PublicQueuePulse';
            const StatusText = document.createElement('div');
            StatusText.className = 'HistoryStatus';
            StatusText.textContent = this.PublicStatusNotice || 'Searching for a random opponent...';
            const CancelBtn = document.createElement('button');
            CancelBtn.type = 'button';
            CancelBtn.className = 'DangerButton';
            const CancelIcon = document.createElement('i');
            CancelIcon.setAttribute('data-lucide', 'x');
            const CancelLabel = document.createElement('span');
            CancelLabel.textContent = 'Cancel Search';
            CancelBtn.appendChild(CancelIcon);
            CancelBtn.appendChild(CancelLabel);
            CancelBtn.addEventListener('click', () => {
                if (this.OnLeavePublicLobby) {
                    this.OnLeavePublicLobby();
                }
            });
            QueueBox.appendChild(Pulse);
            QueueBox.appendChild(StatusText);
            QueueBox.appendChild(CancelBtn);
            Box.appendChild(QueueBox);
        } else {
            const FindBtn = document.createElement('button');
            FindBtn.type = 'button';
            FindBtn.className = 'PrimaryButton';
            const ShuffleIcon = document.createElement('i');
            ShuffleIcon.setAttribute('data-lucide', 'shuffle');
            const FindLabel = document.createElement('span');
            FindLabel.textContent = 'Find Random Match';
            FindBtn.appendChild(ShuffleIcon);
            FindBtn.appendChild(FindLabel);
            FindBtn.addEventListener('click', () => {
                this.TriggerPublicSearch();
            });
            Box.appendChild(FindBtn);
            if (this.PublicStatusNotice) {
                const Notice = document.createElement('div');
                Notice.className = 'HistoryStatus';
                Notice.textContent = this.PublicStatusNotice;
                Box.appendChild(Notice);
            }
        }
        Panel.appendChild(Box);
    }

    // Builds the display name input row for Public Lobby random matchmaking.
    BuildPublicNameRow() {
        // Creates the label and input field synced with PlayerName.
        const Row = document.createElement('div');
        Row.className = 'SelectorRow';
        const Label = document.createElement('label');
        Label.textContent = 'Your name (shown to your opponent):';
        const Input = document.createElement('input');
        Input.type = 'text';
        Input.className = 'TextInput';
        Input.placeholder = 'Enter your name';
        Input.value = this.PlayerName;
        Input.disabled = this.IsPublicSearching;
        Input.addEventListener('input', () => {
            this.PlayerName = Input.value;
        });
        Input.addEventListener('keydown', (Event) => {
            if (Event && Event.key === 'Enter' && !this.IsPublicSearching) {
                Event.preventDefault();
                this.TriggerPublicSearch();
            }
        });
        this.NameInput = Input;
        Row.appendChild(Label);
        Row.appendChild(Input);
        return Row;
    }

    // Validates the player name and invokes OnJoinPublicLobby with current setup choices.
    TriggerPublicSearch() {
        // Reads the display name and selected time control before joining the public queue.
        const Name = (this.NameInput ? this.NameInput.value : this.PlayerName).trim();
        this.PlayerName = Name;
        if (Name === '') {
            this.SetPublicStatus('Please enter your name before searching.');
            return;
        }
        const TimeConfig = this.GetSelectedTimeControl();
        if (this.OnJoinPublicLobby) {
            this.OnJoinPublicLobby(this.SelectedColor, Name, TimeConfig.Seconds, TimeConfig.Increment);
        }
    }

    // Appends the Sandbox mode description and Start Sandbox button to the panel.
    AppendSandboxControls(Panel) {
        // Creates the description notice and Start Sandbox primary button.
        const Box = document.createElement('div');
        Box.className = 'MultiplayerSection';
        const Info = document.createElement('div');
        Info.className = 'HistoryStatus';
        Info.textContent = 'Control both sides, and freely add or remove any piece on the board.';
        const StartBtn = document.createElement('button');
        StartBtn.type = 'button';
        StartBtn.className = 'PrimaryButton';
        const PlayIcon = document.createElement('i');
        PlayIcon.setAttribute('data-lucide', 'sliders');
        const StartLabel = document.createElement('span');
        StartLabel.textContent = 'Start Sandbox';
        StartBtn.appendChild(PlayIcon);
        StartBtn.appendChild(StartLabel);
        StartBtn.addEventListener('click', () => {
            if (this.OnStartSandbox) {
                this.OnStartSandbox(this.SelectedColor);
            }
        });
        Box.appendChild(Info);
        Box.appendChild(StartBtn);
        Panel.appendChild(Box);
    }

    // Builds the box displaying the room code, shareable link, and copy buttons.
    BuildRoomShareBox(RoomInfo) {
        // Creates the room share container and displays the 6-character code.
        const ShareBox = document.createElement('div');
        ShareBox.className = 'RoomShareBox';
        const CodeTitle = document.createElement('label');
        CodeTitle.textContent = 'Room Code:';
        const CodeValue = document.createElement('div');
        CodeValue.className = 'RoomCodeDisplay';
        CodeValue.textContent = RoomInfo.RoomCode;
        ShareBox.appendChild(CodeTitle);
        ShareBox.appendChild(CodeValue);

        // Creates the read-only shareable link input and Copy Code / Copy Link buttons.
        const LinkInput = document.createElement('input');
        LinkInput.type = 'text';
        LinkInput.className = 'TextInput';
        LinkInput.readOnly = true;
        LinkInput.value = RoomInfo.ShareLink;
        ShareBox.appendChild(LinkInput);
        ShareBox.appendChild(this.BuildCopyButtonsRow(RoomInfo));
        return ShareBox;
    }

    // Builds the Copy Code and Copy Link action buttons for a created room.
    BuildCopyButtonsRow(RoomInfo) {
        // Creates two secondary buttons that copy the code or link to the clipboard.
        const CopyRow = document.createElement('div');
        CopyRow.className = 'InlineInputRow';
        const CopyCodeBtn = document.createElement('button');
        CopyCodeBtn.type = 'button';
        CopyCodeBtn.className = 'HistoryButton';
        CopyCodeBtn.textContent = 'Copy Code';
        CopyCodeBtn.addEventListener('click', () => {
            this.CopyTextToClipboard(RoomInfo.RoomCode, 'Room code copied!');
        });
        const CopyLinkBtn = document.createElement('button');
        CopyLinkBtn.type = 'button';
        CopyLinkBtn.className = 'HistoryButton';
        CopyLinkBtn.textContent = 'Copy Link';
        CopyLinkBtn.addEventListener('click', () => {
            this.CopyTextToClipboard(RoomInfo.ShareLink, 'Invite link copied!');
        });
        CopyRow.appendChild(CopyCodeBtn);
        CopyRow.appendChild(CopyLinkBtn);
        return CopyRow;
    }

    // Copies text to the clipboard with a textarea fallback for file:// URLs.
    CopyTextToClipboard(TextToCopy, ConfirmationMessage) {
        // Uses navigator.clipboard when available or falls back to execCommand('copy').
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(TextToCopy).catch(() => {
                this.FallbackCopyText(TextToCopy);
            });
        } else {
            this.FallbackCopyText(TextToCopy);
        }
        this.SetStatusNotice(ConfirmationMessage);
    }

    // Copies text using a temporary off-screen textarea for non-HTTPS / file:// origins.
    FallbackCopyText(TextToCopy) {
        // Creates, selects, copies, and removes a temporary textarea element.
        if (!document || !document.body || !document.createElement) {
            return;
        }
        const TempArea = document.createElement('textarea');
        TempArea.value = TextToCopy;
        document.body.appendChild(TempArea);
        if (TempArea.select) {
            TempArea.select();
        }
        if (document.execCommand) {
            document.execCommand('copy');
        }
        if (document.body.removeChild) {
            document.body.removeChild(TempArea);
        }
    }

    // Builds the input field and Join button for joining a game by code or link.
    BuildJoinRow() {
        // Creates the input box and Join button row.
        const JoinRow = document.createElement('div');
        JoinRow.className = 'InlineInputRow';
        const Input = document.createElement('input');
        Input.type = 'text';
        Input.className = 'TextInput';
        Input.placeholder = 'Enter code or paste link';
        Input.value = this.PendingJoinCode;
        Input.addEventListener('input', () => {
            this.PendingJoinCode = Input.value;
        });
        this.JoinInput = Input;
        const TriggerJoin = () => {
            const Name = (this.NameInput ? this.NameInput.value : this.PlayerName).trim();
            this.PlayerName = Name;
            if (Name === '') {
                this.SetStatusNotice('Please enter your name before joining a game.');
                return;
            }
            if (Input.value.trim() === '') {
                this.SetStatusNotice('Please enter a room code or link.');
                return;
            }
            if (this.OnJoinRoom) {
                this.OnJoinRoom(Input.value.trim(), Name);
            }
        };
        Input.addEventListener('keydown', (Event) => {
            if (Event && Event.key === 'Enter') {
                Event.preventDefault();
                TriggerJoin();
            }
        });
        const JoinBtn = document.createElement('button');
        JoinBtn.type = 'button';
        JoinBtn.className = this.PendingJoinCode !== '' ? 'PrimaryButton' : 'SecondaryButton';
        JoinBtn.textContent = 'Join';
        JoinBtn.addEventListener('click', TriggerJoin);
        JoinRow.appendChild(Input);
        JoinRow.appendChild(JoinBtn);
        return JoinRow;
    }

    // Reads the currently selected time control option object.
    GetSelectedTimeControl() {
        // Matches SelectedTimeKey against TimeControlOptions.
        const Key = this.TimeSelect ? this.TimeSelect.value : this.SelectedTimeKey;
        this.SelectedTimeKey = Key;
        for (let Index = Zero; Index < TimeControlOptions.length; Index += One) {
            if (TimeControlOptions[Index].Key === Key) {
                return TimeControlOptions[Index];
            }
        }
        return TimeControlOptions[Zero];
    }

    // Reads the currently selected Elo, material odds, move multiplier, side, and time control.
    GetSelectedConfig() {
        // Parses the current values of the dropdown menus and side picker.
        const SelectedElo = this.EloSelect ? Number(this.EloSelect.value) : DefaultBotElo;
        const SelectedOdds = this.OddsSelect ? this.OddsSelect.value : '';
        const SelectedTimes = this.TimesSelect ? Number(this.TimesSelect.value) : One;
        const TimeConfig = this.GetSelectedTimeControl();
        return {
            Elo: SelectedElo,
            OddsPieces: SelectedOdds,
            OddsTimes: SelectedTimes,
            PlayerColor: this.SelectedColor,
            TimeSeconds: TimeConfig.Seconds,
            IncrementSeconds: TimeConfig.Increment
        };
    }

    // Constructs the chess clock time control dropdown row.
    BuildTimeControlRow() {
        // Creates the row container, label, and time control select element.
        const Row = document.createElement('div');
        Row.className = 'SelectorRow';
        const Label = document.createElement('label');
        Label.textContent = 'Time control (clock):';
        const Select = document.createElement('select');
        for (let Index = Zero; Index < TimeControlOptions.length; Index += One) {
            const Item = TimeControlOptions[Index];
            const Option = document.createElement('option');
            Option.value = Item.Key;
            Option.textContent = Item.Label;
            if (Item.Key === this.SelectedTimeKey) {
                Option.selected = true;
            }
            Select.appendChild(Option);
        }
        Select.addEventListener('change', () => {
            this.SelectedTimeKey = Select.value;
        });
        Row.appendChild(Label);
        Row.appendChild(Select);
        return { Row: Row, Select: Select };
    }

    // Constructs the bot selection dropdown row from Ella (1 Elo) to Chronos (2700 Elo).
    BuildEloRow() {
        // Creates the row container, label, and select element.
        const Row = document.createElement('div');
        Row.className = 'SelectorRow';
        const Label = document.createElement('label');
        Label.textContent = 'Choose your bot (1 - 2700 Elo):';
        const Select = document.createElement('select');

        // Adds the 1 Elo bot ("Ella") as the first option.
        const EllaOption = document.createElement('option');
        EllaOption.value = String(EllaBotElo);
        EllaOption.textContent = `${EllaBotName} (${EllaBotElo} Elo)`;
        Select.appendChild(EllaOption);

        // Populates named bot options for each Elo step and selects the default bot.
        for (let Elo = BotFirstElo; Elo <= BotLastElo; Elo += BotEloStep) {
            const Option = document.createElement('option');
            const BotName = GetBotName(Elo);
            Option.value = String(Elo);
            Option.textContent = `${BotName} (${Elo} Elo)`;
            if (Elo === DefaultBotElo) {
                Option.selected = true;
            }
            Select.appendChild(Option);
        }

        // Appends the label and dropdown to the row and returns references.
        Row.appendChild(Label);
        Row.appendChild(Select);
        return { Row: Row, Select: Select };
    }

    // Constructs the material odds dropdown row.
    BuildOddsRow() {
        // Creates the row container, label, and select element.
        const Row = document.createElement('div');
        Row.className = 'SelectorRow';
        const Label = document.createElement('label');
        Label.textContent = 'Material odds (bot plays short pieces):';
        const Select = document.createElement('select');

        // Populates all material handicap options.
        for (let Index = Zero; Index < OddsOptions.length; Index += One) {
            const Item = OddsOptions[Index];
            const Option = document.createElement('option');
            Option.value = Item.Value;
            Option.textContent = Item.Label;
            Select.appendChild(Option);
        }

        // Appends the label and dropdown to the row and returns references.
        Row.appendChild(Label);
        Row.appendChild(Select);
        return { Row: Row, Select: Select };
    }

    // Constructs the bot moves-per-turn dropdown row.
    BuildTimesRow() {
        // Creates the row container, label, and select element.
        const Row = document.createElement('div');
        Row.className = 'SelectorRow';
        const Label = document.createElement('label');
        Label.textContent = 'Bot moves per player turn:';
        const Select = document.createElement('select');

        // Populates move multiplier choices.
        for (let Index = Zero; Index < TimesChoices.length; Index += One) {
            const Option = document.createElement('option');
            Option.value = String(TimesChoices[Index]);
            Option.textContent = TimesLabels[Index];
            Select.appendChild(Option);
        }

        // Appends the label and dropdown to the row and returns references.
        Row.appendChild(Label);
        Row.appendChild(Select);
        return { Row: Row, Select: Select };
    }
}