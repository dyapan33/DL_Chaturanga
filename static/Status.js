class StatusView {
    constructor(MountId) {
        this.Root = document.getElementById(MountId);
        this.Message = '';
        this.Render({ turn: 'w', bot_elo: 1000, in_check: false, game_over: false, result: '' });
    }

    Render(State) {
        this.Root.innerHTML = '';
        const Panel = document.createElement('div');
        Panel.className = 'Panel';

        const TurnLine = document.createElement('div');
        TurnLine.className = 'Line';
        const Badge = document.createElement('span');
        Badge.className = 'Badge';
        Badge.textContent = State.game_over ? 'Game finished' : (State.turn === 'w' ? 'Your move (White)' : 'Bot thinking...');
        const Elo = document.createElement('span');
        Elo.textContent = `Bot: Stockfish ${State.bot_elo}`;
        TurnLine.appendChild(Badge);
        TurnLine.appendChild(Elo);
        Panel.appendChild(TurnLine);

        const Detail = document.createElement('div');
        Detail.className = 'Line';
        if (State.game_over && State.result) {
            Detail.className = 'Line Over';
            Detail.textContent = State.result;
        } else if (State.in_check) {
            Detail.className = 'Line Check';
            Detail.textContent = 'Check!';
        } else {
            Detail.textContent = this.Message;
        }
        Panel.appendChild(Detail);
        this.Root.appendChild(Panel);
    }

    SetMessage(Text) {
        this.Message = Text;
    }
}
