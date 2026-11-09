const PieceGlyphs = {
    k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
    K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙'
};

const BoardFiles = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const BoardRanks = [8, 7, 6, 5, 4, 3, 2, 1];
const RankSeparator = '/';

class BoardView {
    constructor(MountId, OnSquareClick) {
        this.Root = document.getElementById(MountId);
        this.OnSquareClick = OnSquareClick;
        this.Selected = null;
        this.LegalMoves = [];
        this.LastMove = null;
        this.Render([]);
    }

    Render(LegalMoves, LastMove) {
        this.LegalMoves = LegalMoves || [];
        this.LastMove = LastMove || null;
        this.Root.innerHTML = '';
        const Panel = document.createElement('div');
        Panel.className = 'Panel';
        const Grid = document.createElement('div');
        Grid.className = 'Grid';
        BoardRanks.forEach((Rank, RankIndex) => {
            BoardFiles.forEach((File, FileIndex) => {
                const SquareName = File + Rank;
                const Cell = document.createElement('div');
                Cell.className = 'Square ' + ((RankIndex + FileIndex) % 2 === 0 ? 'Light' : 'Dark');
                Cell.dataset.square = SquareName;
                if (this.LastMove && (this.LastMove.startsWith(SquareName) || this.LastMove.slice(2, 4) === SquareName)) {
                    Cell.classList.add('LastMove');
                }
                if (this.Selected === SquareName) {
                    Cell.classList.add('Selected');
                }
                this._AddTargets(Cell, SquareName);
                this._AddPiece(Cell, SquareName);
                if (FileIndex === 0) {
                    const Label = document.createElement('span');
                    Label.className = 'Coord';
                    Label.textContent = String(Rank);
                    Cell.appendChild(Label);
                }
                if (RankIndex === 7) {
                    const Label = document.createElement('span');
                    Label.className = 'Coord';
                    Label.textContent = File;
                    Cell.appendChild(Label);
                }
                Cell.addEventListener('click', () => this.OnSquareClick(SquareName));
                Grid.appendChild(Cell);
            });
        });
        Panel.appendChild(Grid);
        this.Root.appendChild(Panel);
    }

    ApplyState(State) {
        this.Fen = State.fen;
        this.ApplySelection(null);
        this.Render(State.legal_moves, State.last_move);
    }

    ApplySelection(SquareName) {
        this.Selected = SquareName;
    }

    _AddTargets(Cell, SquareName) {
        const Targets = this.LegalMoves.filter((Item) => Item.slice(2, 4) === SquareName);
        if (Targets.length === 0) {
            return;
        }
        const Occupied = this._PieceAt(SquareName) !== '';
        Cell.classList.add(Occupied ? 'CaptureHint' : 'Dot');
    }

    _AddPiece(Cell, SquareName) {
        const Glyph = this._PieceAt(SquareName);
        if (Glyph === '') {
            return;
        }
        const Span = document.createElement('span');
        Span.className = Glyph === Glyph.toLowerCase() ? 'BlackPiece' : 'WhitePiece';
        Span.textContent = PieceGlyphs[Glyph] || '';
        Cell.appendChild(Span);
    }

    _PieceAt(SquareName) {
        if (!this.Fen) {
            return '';
        }
        const Fields = this.Fen.split(' ');
        const Placement = Fields[0];
        const Rows = Placement.split(RankSeparator);
        const WantedRank = Number(SquareName[1]);
        const WantedFile = BoardFiles.indexOf(SquareName[0]);
        const Row = Rows[BoardRanks.indexOf(WantedRank)];
        let FileCursor = 0;
        for (const Char of Row) {
            if (Char >= '1' && Char <= '8') {
                FileCursor += Number(Char);
                continue;
            }
            if (FileCursor === WantedFile) {
                return Char;
            }
            FileCursor += 1;
        }
        return '';
    }
}
