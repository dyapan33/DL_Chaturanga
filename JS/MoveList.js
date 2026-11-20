// Renders the ordered move history and non-destructive move playback controls.
class MoveListView {
    Initialize(MountId, OnSelectFrame, OnCopyPgn, OnCopyFen) {
        // Stores the target DOM element, frame callback, and renders an empty list.
        this.Root = document.getElementById(MountId);
        this.OnSelectFrame = OnSelectFrame;
        this.OnCopyPgn = OnCopyPgn;
        this.OnCopyFen = OnCopyFen;
        this.Render([], Zero, Zero);
    }

    // Updates the displayed move list and history navigation controls.
    Render(History, ViewedFrameIndex, LatestFrameIndex) {
        // Clears the container and builds the panel header with a Lucide history icon.
        this.Root.innerHTML = '';
        const Panel = document.createElement('div');
        Panel.className = 'Panel';
        const Title = document.createElement('h3');
        const TitleIcon = document.createElement('i');
        TitleIcon.setAttribute('data-lucide', 'history');
        const TitleText = document.createElement('span');
        TitleText.textContent = 'Moves';
        Title.appendChild(TitleIcon);
        Title.appendChild(TitleText);
        Panel.appendChild(Title);

        // Appends the Prev, Next, and Live buttons for inspecting played moves.
        const NavRow = this.BuildHistoryNav(ViewedFrameIndex, LatestFrameIndex);
        Panel.appendChild(NavRow);

        // Shows a banner when inspecting a historical move instead of the live position.
        if (ViewedFrameIndex < LatestFrameIndex) {
            const Banner = document.createElement('div');
            Banner.className = 'HistoryStatus';
            Banner.textContent = `Viewing move ${ViewedFrameIndex} of ${LatestFrameIndex} (click Live to play)`;
            Panel.appendChild(Banner);
        }

        // Pairs consecutive half-moves into numbered list items with clickable tokens.
        const List = this.BuildMoveList(History, ViewedFrameIndex);
        Panel.appendChild(List);
        Panel.appendChild(this.BuildExportBar());
        this.Root.appendChild(Panel);
        List.scrollTop = List.scrollHeight;
        if (window.lucide && window.lucide.createIcons) {
            window.lucide.createIcons();
        }
    }

    // Builds the Copy PGN and Copy FEN action buttons below the move list.
    BuildExportBar() {
        // Creates the button row for copying PGN or FEN notation to the clipboard.
        const ExportRow = document.createElement('div');
        ExportRow.className = 'HistoryControls ExportBarRow';
        const PgnBtn = this.CreateIconNavButton('copy', 'Copy PGN', false, () => {
            if (this.OnCopyPgn) {
                this.OnCopyPgn();
            }
        });
        const FenBtn = this.CreateIconNavButton('clipboard', 'Copy FEN', false, () => {
            if (this.OnCopyFen) {
                this.OnCopyFen();
            }
        });
        ExportRow.appendChild(PgnBtn);
        ExportRow.appendChild(FenBtn);
        return ExportRow;
    }

    // Builds the Prev, Next, and Live navigation buttons for reviewing played moves.
    BuildHistoryNav(ViewedFrameIndex, LatestFrameIndex) {
        // Creates the button row container.
        const NavRow = document.createElement('div');
        NavRow.className = 'HistoryControls';

        // Creates the Prev button to inspect the previous move without undoing.
        const PrevButton = this.CreateIconNavButton('chevron-left', 'Prev', ViewedFrameIndex <= Zero, () => {
            if (this.OnSelectFrame && ViewedFrameIndex > Zero) {
                this.OnSelectFrame(ViewedFrameIndex - One);
            }
        });

        // Creates the Next button to step forward in the played move history.
        const NextButton = this.CreateIconNavButton('chevron-right', 'Next', ViewedFrameIndex >= LatestFrameIndex, () => {
            if (this.OnSelectFrame && ViewedFrameIndex < LatestFrameIndex) {
                this.OnSelectFrame(ViewedFrameIndex + One);
            }
        });

        // Creates the Live button to return immediately to the latest board position.
        const LiveButton = this.CreateIconNavButton('chevrons-right', 'Live', ViewedFrameIndex >= LatestFrameIndex, () => {
            if (this.OnSelectFrame) {
                this.OnSelectFrame(LatestFrameIndex);
            }
        });

        // Appends all three history buttons to the navigation row.
        NavRow.appendChild(PrevButton);
        NavRow.appendChild(NextButton);
        NavRow.appendChild(LiveButton);
        return NavRow;
    }

    // Builds a history navigation button containing a Lucide icon and label.
    CreateIconNavButton(IconName, LabelText, IsDisabled, OnClick) {
        // Creates the button element, attaches icon and label spans, and binds click.
        const Button = document.createElement('button');
        Button.type = 'button';
        Button.className = 'HistoryButton';
        Button.disabled = IsDisabled;
        const Icon = document.createElement('i');
        Icon.setAttribute('data-lucide', IconName);
        const Text = document.createElement('span');
        Text.textContent = LabelText;
        Button.appendChild(Icon);
        Button.appendChild(Text);
        Button.addEventListener('click', OnClick);
        return Button;
    }

    // Constructs the ordered list of clickable half-move tokens.
    BuildMoveList(History, ViewedFrameIndex) {
        // Iterates through move pairs and creates clickable spans for each half-move.
        const List = document.createElement('ol');
        for (let Index = Zero; Index < History.length; Index += Two) {
            const Item = document.createElement('li');
            Item.className = 'MovePairRow';
            const WhiteFrame = Index + One;
            const WhiteSpan = this.BuildMoveToken(History[Index], WhiteFrame, ViewedFrameIndex);
            Item.appendChild(WhiteSpan);
            if (Index + One < History.length) {
                const BlackFrame = Index + Two;
                const BlackSpan = this.BuildMoveToken(History[Index + One], BlackFrame, ViewedFrameIndex);
                Item.appendChild(BlackSpan);
            }
            List.appendChild(Item);
        }

        // Returns the populated ordered list element.
        return List;
    }

    // Creates a single clickable move token span for a specific frame index.
    BuildMoveToken(MoveText, FrameIndex, ViewedFrameIndex) {
        // Styles the token and highlights it if its frame is currently being viewed.
        const Span = document.createElement('span');
        Span.className = FrameIndex === ViewedFrameIndex ? 'MoveToken ActiveMoveToken' : 'MoveToken';
        Span.textContent = MoveText;
        Span.addEventListener('click', () => {
            if (this.OnSelectFrame) {
                this.OnSelectFrame(FrameIndex);
            }
        });
        return Span;
    }
}
