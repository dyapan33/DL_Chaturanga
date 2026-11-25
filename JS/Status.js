// Displays turn status, opponent info, check alerts, and game outcome messages.
class StatusView {
    Initialize(MountId) {
        // Stores the root container element and renders the initial status panel.
        this.Root = document.getElementById(MountId);
        this.Message = '';
        this.RoomCode = '';
        this.Render({
            Turn: 'w',
            PlayerColor: 'w',
            IsMultiplayer: false,
            BotElo: DefaultBotElo,
            InCheck: false,
            GameOver: false,
            Result: '',
            LastSpecialText: ''
        });
    }

    // Sets the active room code to display during multiplayer games.
    SetRoomCode(RoomCode) {
        // Stores the room code string.
        this.RoomCode = RoomCode || '';
    }

    // Renders the status panel for the given game state.
    Render(State) {
        // Clears the container and builds the status panel and turn indicator line.
        this.Root.innerHTML = '';
        const Panel = document.createElement('div');
        Panel.className = 'Panel';
        const TurnLine = document.createElement('div');
        TurnLine.className = 'Line';
        const Badge = document.createElement('span');
        Badge.className = this.BuildTurnBadgeClass(State);
        const BadgeLabel = document.createElement('span');
        BadgeLabel.textContent = this.BuildTurnBadgeText(State);
        Badge.appendChild(BadgeLabel);
        if (!State.GameOver && !State.IsSandbox && State.Turn !== State.PlayerColor) {
            Badge.appendChild(this.BuildThinkingDots());
        }
        const OpponentLabel = document.createElement('span');
        const ShowActiveRoom = State.IsMultiplayer && !State.GameOver && this.RoomCode !== '';
        if (State.IsSandbox) {
            OpponentLabel.textContent = 'Sandbox Mode';
        } else if (State.IsMultiplayer) {
            OpponentLabel.textContent = ShowActiveRoom ? `Room: ${this.RoomCode}` : 'Multiplayer';
        } else {
            const BotName = GetBotName(State.BotElo);
            OpponentLabel.textContent = `${BotName} (${State.BotElo} Elo)`;
        }
        TurnLine.appendChild(Badge);
        TurnLine.appendChild(OpponentLabel);
        Panel.appendChild(TurnLine);

        // Builds the secondary line showing game outcome, check warning, or info text.
        const Detail = document.createElement('div');
        Detail.className = 'Line';
        if (State.GameOver && State.Result) {
            Detail.className = 'Line Over';
            Detail.textContent = State.Result;
        } else if (State.InCheck) {
            Detail.className = 'Line Check';
            Detail.textContent = State.LastSpecialText ? `${State.LastSpecialText} Check!` : 'Check!';
        } else if (State.LastSpecialText) {
            Detail.textContent = State.LastSpecialText;
        } else {
            Detail.textContent = this.Message;
        }
        Panel.appendChild(Detail);
        this.Root.appendChild(Panel);
    }

    // Computes the emotive styling class for the turn status badge.
    BuildTurnBadgeClass(State) {
        // Applies urgent check, victory, or active-turn accent styling.
        if (State.GameOver) {
            const ResultText = String(State.Result || '').toLowerCase();
            const PlayerSide = State.PlayerColor === 'w' ? 'white' : 'black';
            if (ResultText.includes('you win') || ResultText.includes(`${PlayerSide} wins`)) {
                return 'Badge BadgeVictory';
            }
            return 'Badge';
        }
        if (State.InCheck) {
            return 'Badge BadgeCheck';
        }
        if (!State.IsSandbox && State.Turn === State.PlayerColor) {
            return 'Badge BadgeYourTurn';
        }
        return 'Badge';
    }

    // Builds an animated three-dot thinking indicator for opponent or bot turns.
    BuildThinkingDots() {
        // Creates three staggered dots that gently bounce while waiting.
        const Group = document.createElement('span');
        Group.className = 'ThinkingDots';
        const DotOne = document.createElement('span');
        DotOne.className = 'ThinkingDot';
        const DotTwo = document.createElement('span');
        DotTwo.className = 'ThinkingDot ThinkingDotTwo';
        const DotThree = document.createElement('span');
        DotThree.className = 'ThinkingDot ThinkingDotThree';
        Group.appendChild(DotOne);
        Group.appendChild(DotTwo);
        Group.appendChild(DotThree);
        return Group;
    }

    // Formats the turn badge text based on PlayerColor, Turn, and game mode.
    BuildTurnBadgeText(State) {
        // Returns finished message if over, or active player/opponent turn label.
        if (State.GameOver) {
            return 'Game finished';
        }
        const IsMyTurn = State.Turn === State.PlayerColor;
        const SideName = State.Turn === 'w' ? 'White' : 'Black';
        if (State.IsSandbox) {
            return `${SideName} to move`;
        }
        if (IsMyTurn) {
            return `Your move (${SideName})`;
        }
        const BotName = GetBotName(State.BotElo);
        return State.IsMultiplayer ? `Opponent move (${SideName})` : `${BotName} thinking...`;
    }

    // Updates the informational status message text.
    SetMessage(Text) {
        // Stores the message string for the next render pass.
        this.Message = Text;
    }
}
