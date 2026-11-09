const ApiEndpoints = {
    Bots: '/api/Bots',
    NewGame: '/api/NewGame',
    Move: '/api/Move',
    Undo: '/api/Undo'
};

const UciSquareLength = 2;

class Controller {
    constructor() {
        this.State = null;
        this.Selected = null;
        this.Busy = false;
        this.Board = new BoardView('BoardPanel', (SquareName) => this._HandleSquareClick(SquareName));
        this.Moves = new MoveListView('MoveList');
        this.Status = new StatusView('StatusPanel');
        this.Selector = new BotSelectorView('BotSelector', (Elo, OddsPieces, OddsTimes) => this.NewGame(Elo, OddsPieces, OddsTimes));
        document.getElementById('NewGameButton').addEventListener('click', () => this.NewGame(1000, '', 1));
        document.getElementById('UndoButton').addEventListener('click', () => this.Undo());
    }

    async Start() {
        await this.Selector.Load();
        await this.NewGame(1000, '', 1);
    }

    async NewGame(Elo, OddsPieces, OddsTimes) {
        const Response = await fetch(ApiEndpoints.NewGame, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ elo: Elo, odds_pieces: OddsPieces, odds_times: OddsTimes })
        });
        this.ApplyState(await Response.json());
        this.Status.SetMessage(`Playing against Stockfish ${Elo}.`);
        this.Status.Render(this.State);
    }

    async SendMove(MoveUci) {
        if (this.Busy) {
            return;
        }
        this.Busy = true;
        const Response = await fetch(ApiEndpoints.Move, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ move: MoveUci })
        });
        const Data = await Response.json();
        if (Data.error) {
            this.Status.SetMessage(Data.error);
        } else {
            this.ApplyState(Data);
        }
        this.Busy = false;
    }

    async Undo() {
        const Response = await fetch(ApiEndpoints.Undo, { method: 'POST' });
        const Data = await Response.json();
        if (Data.error) {
            this.Status.SetMessage(Data.error);
            return;
        }
        this.ApplyState(Data);
    }

    ApplyState(NewState) {
        this.State = NewState;
        this.Selected = null;
        this.Board.ApplyState(NewState);
        this.Moves.Render(NewState.history);
        this.Status.Render(NewState);
    }

    _HandleSquareClick(SquareName) {
        if (!this.State || this.State.game_over || this.Busy) {
            return;
        }
        if (this.Selected === null) {
            this._TrySelect(SquareName);
            return;
        }
        const DirectMove = this.Selected + SquareName;
        const PromotionMoves = this.State.legal_moves.filter((Item) => Item.startsWith(DirectMove) && Item.length > UciSquareLength * 2);
        if (PromotionMoves.length > 0) {
            this.SendMove(PromotionMoves[0]);
            this.Board.ApplySelection(null);
            this.Selected = null;
            return;
        }
        if (this.State.legal_moves.includes(DirectMove)) {
            this.SendMove(DirectMove);
            this.Board.ApplySelection(null);
            this.Selected = null;
            return;
        }
        this._TrySelect(SquareName);
    }

    _TrySelect(SquareName) {
        const HasPieceHere = this.State.legal_moves.some((Item) => Item.slice(0, UciSquareLength) === SquareName);
        if (!HasPieceHere) {
            this.Selected = null;
            this.Board.ApplySelection(null);
            this.Board.Render(this.State.legal_moves, this.State.last_move);
            return;
        }
        this.Selected = SquareName;
        this.Board.ApplySelection(SquareName);
        this.Board.Render(this.State.legal_moves, this.State.last_move);
    }
}


window.addEventListener('DOMContentLoaded', () => {
    const App = new Controller();
    App.Start();
});
