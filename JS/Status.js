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
        Badge.className = 'Badge';
        Badge.textContent = this.BuildTurnBadgeText(State);
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
