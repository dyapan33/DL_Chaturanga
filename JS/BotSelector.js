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

// Renders the game setup panel for both Bot and Multiplayer modes.
class BotSelectorView {
    Initialize(MountId, OnStartBotGame, OnCreateRoom, OnJoinRoom, OnStartSandbox) {
        // Stores DOM mount element, callbacks, and default setup state.
        this.Root = document.getElementById(MountId);
        this.OnStartBotGame = OnStartBotGame;
        this.OnCreateRoom = OnCreateRoom;
        this.OnJoinRoom = OnJoinRoom;
        this.OnStartSandbox = OnStartSandbox;
        this.Mode = 'bot';
        this.SelectedColor = 'w';
        this.PlayerName = '';
        this.PendingJoinCode = '';
        this.CreatedRoomInfo = null;
        this.StatusNotice = '';
        this.Panel = null;
        this.ModeTabsBox = null;
        this.BotTabBtn = null;
        this.MultiTabBtn = null;
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

    // Switches the active setup tab between 'bot' and 'multiplayer'.
    SetMode(ModeName) {
        // Updates the Mode property and refreshes the setup panel.
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

    // Clears any previously created room code, shareable link, and multiplayer notice.
    ResetMultiplayerState() {
        // Resets CreatedRoomInfo, PendingJoinCode, and StatusNotice so expired codes are not shown.
        this.CreatedRoomInfo = null;
        this.PendingJoinCode = '';
        this.StatusNotice = '';
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
        // Updates the Vs Bot / Multiplayer / Sandbox segmented control state.
        if (this.ModeTabsBox) {
            this.ModeTabsBox.classList.remove('SlideRight');
            this.ModeTabsBox.classList.remove('SlideEnd');
            if (this.Mode === 'multiplayer') {
                this.ModeTabsBox.classList.add('SlideRight');
            } else if (this.Mode === 'sandbox') {
                this.ModeTabsBox.classList.add('SlideEnd');
            }
        }
        if (this.BotTabBtn && this.MultiTabBtn && this.SandboxTabBtn) {
            this.BotTabBtn.className = this.Mode === 'bot' ? 'ModeTabButton ActiveModeTab' : 'ModeTabButton';
            this.MultiTabBtn.className = this.Mode === 'multiplayer' ? 'ModeTabButton ActiveModeTab' : 'ModeTabButton';
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
        } else {
            this.AppendSandboxControls(this.Panel);
        }

        // Initializes Lucide icons for any newly added buttons.
        if (window.lucide && window.lucide.createIcons) {
            window.lucide.createIcons();
        }
    }

    // Builds the top segmented tab bar switching between Vs Bot, Multiplayer, and Sandbox.
    BuildModeTabs() {
        // Creates the segmented tab container and the three mode tab buttons.
        const Tabs = document.createElement('div');
        Tabs.className = 'ModeTabs ThreeTabs';
        this.BotTabBtn = this.CreateTabButton('bot', 'Vs Bot', this.Mode === 'bot', () => {
            this.CreatedRoomInfo = null;
            this.StatusNotice = '';
            this.SetMode('bot');
        });
        this.MultiTabBtn = this.CreateTabButton('users', 'Multiplayer', this.Mode === 'multiplayer', () => {
            this.SetMode('multiplayer');
        });
        this.SandboxTabBtn = this.CreateTabButton('sliders', 'Sandbox', this.Mode === 'sandbox', () => {
            this.CreatedRoomInfo = null;
            this.StatusNotice = '';
            this.SetMode('sandbox');
        });
        Tabs.appendChild(this.BotTabBtn);
        Tabs.appendChild(this.MultiTabBtn);
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

    // Appends the Elo, material odds, move multiplier, and Start Game button for Bot mode.
    AppendBotControls(Panel) {
        // Creates the Elo, material odds, and move-count selector rows.
        const EloRow = this.BuildEloRow();
        const OddsRow = this.BuildOddsRow();
        const TimesRow = this.BuildTimesRow();
        this.EloSelect = EloRow.Select;
        this.OddsSelect = OddsRow.Select;
        this.TimesSelect = TimesRow.Select;
        Panel.appendChild(EloRow.Row);
        Panel.appendChild(OddsRow.Row);
        Panel.appendChild(TimesRow.Row);

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
                this.OnStartBotGame(Config.Elo, Config.OddsPieces, Config.OddsTimes, Config.PlayerColor);
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
        CreateBtn.className = this.PendingJoinCode !== '' ? 'SecondaryButton' : 'PrimaryButton';
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
            if (this.OnCreateRoom) {
                this.OnCreateRoom(this.SelectedColor, Name);
            }
        });
        Box.appendChild(CreateBtn);

        // Displays the generated room code and shareable link box when a room is active.
        if (this.CreatedRoomInfo) {
            Box.appendChild(this.BuildRoomShareBox(this.CreatedRoomInfo));
        }

        // Appends the divider and the Join Game input row for entering a code or link.
        const Divider = document.createElement('div');
        Divider.className = 'DividerLabel';
        Divider.textContent = '— OR JOIN WITH CODE / LINK —';
        Box.appendChild(Divider);
        Box.appendChild(this.BuildJoinRow());

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
                    this.SetStatusNotice('Please enter your name.');
                    return;
                }
                const CodeText = (this.JoinInput ? this.JoinInput.value : this.PendingJoinCode).trim();
                if (CodeText !== '' && this.OnJoinRoom) {
                    this.OnJoinRoom(CodeText, Name);
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

    // Reads the currently selected Elo, material odds, move multiplier, and side color.
    GetSelectedConfig() {
        // Parses the current values of the dropdown menus and side picker.
        const SelectedElo = this.EloSelect ? Number(this.EloSelect.value) : DefaultBotElo;
        const SelectedOdds = this.OddsSelect ? this.OddsSelect.value : '';
        const SelectedTimes = this.TimesSelect ? Number(this.TimesSelect.value) : One;
        return {
            Elo: SelectedElo,
            OddsPieces: SelectedOdds,
            OddsTimes: SelectedTimes,
            PlayerColor: this.SelectedColor
        };
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
