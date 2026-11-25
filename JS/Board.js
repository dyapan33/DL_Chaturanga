// Maps FEN piece characters to their SVG image paths inside the Assets directory.
const PieceAssetPaths = {
    k: 'Assets/ChessKingBlack.svg',
    q: 'Assets/ChessQueenBlack.svg',
    r: 'Assets/ChessRookBlack.svg',
    b: 'Assets/ChessBishopBlack.svg',
    n: 'Assets/ChessKnightBlack.svg',
    p: 'Assets/ChessPawnBlack.svg',
    K: 'Assets/ChessKingWhite.svg',
    Q: 'Assets/ChessQueenWhite.svg',
    R: 'Assets/ChessRookWhite.svg',
    B: 'Assets/ChessBishopWhite.svg',
    N: 'Assets/ChessKnightWhite.svg',
    P: 'Assets/ChessPawnWhite.svg'
};
const RankSeparator = '/';
const SvgNamespace = 'http://www.w3.org/2000/svg';
const SquarePixelSize = 65;
const BoardPixelSize = SquarePixelSize * Eight;
const HalfSquareSize = SquarePixelSize / Two;
const ArrowShortenLength = 15;
const ArrowHeadLength = 19;
const ArrowHeadHalfWidth = 11;
const TouchDragThreshold = 5;
const BoardShakeMs = 450;
const VictorySparkCount = 15;
const VictorySparkCleanupMs = 1750;
const SparkMinPercent = 10;
const SparkRangePercent = 80;
const SparkTopMinPercent = 35;
const SparkTopRangePercent = 55;
const SparkDelayStepMs = 70;

// Renders the interactive 8x8 chess board with drag-and-drop, arrows, and coordinates.
class BoardView {
    Initialize(MountId, OnSquareClick, OnPieceDrop) {
        // Stores DOM mount point, interaction callbacks, and default rendering state.
        this.Root = document.getElementById(MountId);
        this.OnSquareClick = OnSquareClick;
        this.OnPieceDrop = OnPieceDrop;
        this.Selected = null;
        this.DraggedFromSquare = null;
        this.TouchFromSquare = null;
        this.TouchStartX = Zero;
        this.TouchStartY = Zero;
        this.TouchMoved = false;
        this.ArrowStartSquare = null;
        this.Arrows = [];
        this.LegalMoves = [];
        this.LastMove = null;
        this.Premove = null;
        this.HintSquare = null;
        this.PremoveColor = null;
        this.CheckedKingSquare = null;
        this.CheckmatedKingSquare = null;
        this.EnPassantSquare = null;
        this.Flipped = false;
        this.Interactive = false;
        this.ArrowSvgElement = null;
        this.GridElement = null;
        this.PanelElement = null;
        this.PhysicsCanvas = null;
        this.Physics = null;
        this.BoardMood = '';
        this.LastAnimatedMoveKey = '';
        this.AnimateNextMove = false;
        this.LastMoveWasCapture = false;
        this.ShakeTimerId = null;
        this.SparkTimerId = null;
        this.Fen = '';
        this.Render([], null);
    }

    // Attaches the shared 2D physics engine for piece springs and particle bursts.
    SetPhysics(PhysicsInstance) {
        // Stores the physics engine reference and binds the active board canvas.
        this.Physics = PhysicsInstance;
        if (this.Physics && this.PhysicsCanvas) {
            this.Physics.AttachCanvas(this.PhysicsCanvas);
        }
    }

    // Updates the ambient emotive mood class on the board container panel.
    SetMood(MoodClass) {
        // Stores the active mood class and applies it to PanelElement if mounted.
        const NextMood = MoodClass || '';
        const PreviousMood = this.BoardMood;
        this.BoardMood = NextMood;
        if (this.PanelElement) {
            if (PreviousMood) {
                this.PanelElement.classList.remove(PreviousMood);
            }
            if (NextMood) {
                this.PanelElement.classList.add(NextMood);
            }
        }
    }

    // Plays a brief tactile micro-shake on the board panel for check or illegal move friction.
    TriggerBoardShake() {
        // Restarts the BoardShake CSS animation on PanelElement.
        if (!this.PanelElement) {
            return;
        }
        if (this.ShakeTimerId !== null) {
            clearTimeout(this.ShakeTimerId);
            this.ShakeTimerId = null;
        }
        this.PanelElement.classList.remove('BoardShake');
        void this.PanelElement.offsetWidth;
        this.PanelElement.classList.add('BoardShake');
        this.ShakeTimerId = setTimeout(() => {
            this.ShakeTimerId = null;
            if (this.PanelElement) {
                this.PanelElement.classList.remove('BoardShake');
            }
        }, BoardShakeMs);
    }

    // Spawns celebratory floating golden particles over the board upon victory.
    SpawnVictorySparks() {
        // Launches a physics confetti fountain and a temporary CSS spark overlay.
        if (this.Physics) {
            this.Physics.BurstVictory();
        }
        if (!this.PanelElement) {
            return;
        }
        if (this.SparkTimerId !== null) {
            clearTimeout(this.SparkTimerId);
            this.SparkTimerId = null;
        }
        const Layer = document.createElement('div');
        Layer.className = 'VictorySparkLayer';
        for (let Index = Zero; Index < VictorySparkCount; Index += One) {
            const Spark = document.createElement('span');
            Spark.className = 'VictorySpark';
            const LeftPos = SparkMinPercent + Math.floor(Math.random() * SparkRangePercent);
            const TopPos = SparkTopMinPercent + Math.floor(Math.random() * SparkTopRangePercent);
            Spark.style.left = `${LeftPos}%`;
            Spark.style.top = `${TopPos}%`;
            Spark.style.animationDelay = `${Index * SparkDelayStepMs}ms`;
            Layer.appendChild(Spark);
        }
        this.PanelElement.appendChild(Layer);
        this.SparkTimerId = setTimeout(() => {
            this.SparkTimerId = null;
            if (Layer.parentNode) {
                Layer.parentNode.removeChild(Layer);
            }
        }, VictorySparkCleanupMs);
    }

    // Sets the queued premove UCI string (or null to clear) and player color allowed to premove.
    SetPremoveState(PremoveUci, PremoveColor) {
        // Stores the premove highlight squares and premove-eligible piece color.
        this.Premove = PremoveUci || null;
        this.PremoveColor = PremoveColor || null;
    }

    // Sets an optional puzzle hint square highlight (or null to clear).
    SetHintSquare(SquareName) {
        // Stores the hint source square name.
        this.HintSquare = SquareName || null;
    }

    // Sets whether the board is viewed from Black's perspective (flipped).
    SetFlipped(IsFlipped) {
        // Updates the Flipped flag for rank/file rendering order.
        this.Flipped = Boolean(IsFlipped);
    }

    // Rebuilds the board grid DOM with SVG pieces, arrow overlay, and coordinate labels.
    Render(LegalMoves, LastMove) {
        // Updates stored move lists and clears the root container.
        this.LegalMoves = LegalMoves || [];
        this.LastMove = LastMove || null;
        this.Root.innerHTML = '';

        // Creates the outer panel, board stage wrapper, and 8x8 grid element.
        const Panel = document.createElement('div');
        Panel.className = this.BoardMood ? `Panel ${this.BoardMood}` : 'Panel';
        this.PanelElement = Panel;
        const Stage = document.createElement('div');
        Stage.className = 'BoardStage';
        Stage.addEventListener('contextmenu', (Event) => Event.preventDefault());
        const Grid = document.createElement('div');
        Grid.className = 'Grid';
        this.GridElement = Grid;

        // Populates all 64 squares according to current board orientation.
        for (let VisualRow = Zero; VisualRow < Eight; VisualRow += One) {
            for (let VisualCol = Zero; VisualCol < Eight; VisualCol += One) {
                const RankIndex = this.Flipped ? (Seven - VisualRow) : VisualRow;
                const FileIndex = this.Flipped ? (Seven - VisualCol) : VisualCol;
                const Cell = this.BuildSquareCell(RankIndex, FileIndex, VisualRow, VisualCol);
                Grid.appendChild(Cell);
            }
        }

        // Creates the SVG arrow layer and 2D physics canvas overlay.
        this.ArrowSvgElement = this.BuildArrowLayer();
        this.PhysicsCanvas = document.createElement('canvas');
        this.PhysicsCanvas.className = 'PhysicsLayer';
        Stage.appendChild(Grid);
        Stage.appendChild(this.ArrowSvgElement);
        Stage.appendChild(this.PhysicsCanvas);
        Panel.appendChild(Stage);
        Panel.appendChild(this.BuildBoardHintBar());
        this.Root.appendChild(Panel);
        if (this.Physics) {
            this.Physics.AttachCanvas(this.PhysicsCanvas);
        }
        this.RenderArrows();
        if (this.AnimateNextMove && this.Physics && this.LastMove) {
            const TargetSq = this.LastMove.slice(Two, Four);
            const Center = this.SquareToPixelCenter(TargetSq);
            const NormX = Center.X / BoardPixelSize;
            const NormY = Center.Y / BoardPixelSize;
            if (this.LastMoveWasCapture) {
                this.Physics.BurstCapture(NormX, NormY);
            } else {
                this.Physics.BurstMovePuff(NormX, NormY);
            }
            if (this.CheckedKingSquare) {
                const CheckCenter = this.SquareToPixelCenter(this.CheckedKingSquare);
                this.Physics.BurstCheck(CheckCenter.X / BoardPixelSize, CheckCenter.Y / BoardPixelSize);
            }
        }
        this.AnimateNextMove = false;
    }

    // Builds the subtle footer bar beneath the board explaining drag and arrow gestures.
    BuildBoardHintBar() {
        // Creates the hint container showing drag-to-move and right-click arrow instructions.
        const Bar = document.createElement('div');
        Bar.className = 'BoardHintBar';
        const LeftHint = document.createElement('span');
        LeftHint.textContent = 'Drag or click pieces to move';
        const RightHint = document.createElement('span');
        RightHint.textContent = 'Right-drag (or Shift-drag) to draw arrows';
        Bar.appendChild(LeftHint);
        Bar.appendChild(RightHint);
        return Bar;
    }

    // Creates the SVG overlay element used for drawing square-to-square arrows.
    BuildArrowLayer() {
        // Configures the SVG viewBox to match the 8x8 board dimensions.
        const Svg = document.createElementNS(SvgNamespace, 'svg');
        Svg.setAttribute('class', 'ArrowLayer');
        Svg.setAttribute('viewBox', `${Zero} ${Zero} ${BoardPixelSize} ${BoardPixelSize}`);
        return Svg;
    }

    // Constructs a single square element at (RankIndex, FileIndex).
    BuildSquareCell(RankIndex, FileIndex, VisualRow, VisualCol) {
        // Computes the algebraic square name and light/dark square color class.
        const Rank = RankNumbers[RankIndex];
        const File = FileLetters[FileIndex];
        const SquareName = File + String(Rank);
        const Cell = document.createElement('div');
        const IsLight = (RankIndex + FileIndex) % Two === Zero;
        Cell.className = 'Square ' + (IsLight ? 'Light' : 'Dark');
        Cell.dataset.square = SquareName;

        // Applies last-move, selection, premove, hint, capture impact, and king-in-check classes.
        if (this.LastMove && (this.LastMove.slice(Zero, Two) === SquareName || this.LastMove.slice(Two, Four) === SquareName)) {
            Cell.classList.add('LastMove');
        }
        if (this.Premove && (this.Premove.slice(Zero, Two) === SquareName || this.Premove.slice(Two, Four) === SquareName)) {
            Cell.classList.add('PremoveSquare');
        }
        if (this.HintSquare === SquareName) {
            Cell.classList.add('PuzzleHintSquare');
        }
        if (this.AnimateNextMove && this.LastMoveWasCapture && this.LastMove && this.LastMove.slice(Two, Four) === SquareName) {
            Cell.classList.add('CaptureImpact');
        }
        if (this.Selected === SquareName) {
            Cell.classList.add('Selected');
        }
        if (this.CheckedKingSquare === SquareName) {
            Cell.classList.add('KingInCheck');
        }

        // Adds move target indicators, piece image, coordinate labels, and event handlers.
        this.AddTargets(Cell, SquareName);
        this.AddPiece(Cell, SquareName);
        this.ApplyCoordinates(Cell, FileIndex, Rank, VisualRow, VisualCol);
        this.BindSquareEvents(Cell, SquareName);
        return Cell;
    }

    // Attaches click, drag-and-drop, and right-click arrow drawing listeners to a square.
    BindSquareEvents(Cell, SquareName) {
        // Handles regular left-click selection and clears drawn arrows.
        Cell.addEventListener('click', (Event) => {
            if (Event.shiftKey) {
                return;
            }
            if (this.Arrows.length > Zero) {
                this.ClearArrows();
            }
            this.OnSquareClick(SquareName);
        });

        // Starts an arrow when right-clicking or Shift-clicking on a square.
        Cell.addEventListener('mousedown', (Event) => {
            if (Event.button === Two || Event.shiftKey) {
                Event.preventDefault();
                this.ArrowStartSquare = SquareName;
            }
        });

        // Completes an arrow when releasing right-click or Shift-click on a destination square.
        Cell.addEventListener('mouseup', (Event) => {
            if (this.ArrowStartSquare !== null && (Event.button === Two || Event.shiftKey)) {
                Event.preventDefault();
                this.ToggleArrow(this.ArrowStartSquare, SquareName);
                this.ArrowStartSquare = null;
            }
        });

        // Allows dropping a dragged piece onto this square.
        Cell.addEventListener('dragover', (Event) => {
            Event.preventDefault();
            Cell.classList.add('DragHover');
        });
        Cell.addEventListener('dragleave', () => {
            Cell.classList.remove('DragHover');
        });
        Cell.addEventListener('drop', (Event) => {
            Event.preventDefault();
            Cell.classList.remove('DragHover');
            const FromSquare = this.DraggedFromSquare;
            this.DraggedFromSquare = null;
            if (FromSquare && this.OnPieceDrop) {
                this.ClearArrows();
                this.OnPieceDrop(FromSquare, SquareName);
            }
        });
    }

    // Adds or removes an arrow between FromSquare and ToSquare.
    ToggleArrow(FromSquare, ToSquare) {
        // Ignores zero-length arrows where source and destination are identical.
        if (FromSquare === ToSquare) {
            return;
        }

        // Removes the arrow if it already exists, or appends a new arrow entry.
        const ExistingIndex = this.Arrows.findIndex(
            (Item) => Item.From === FromSquare && Item.To === ToSquare
        );
        if (ExistingIndex >= Zero) {
            this.Arrows.splice(ExistingIndex, One);
        } else {
            this.Arrows.push({ From: FromSquare, To: ToSquare });
        }
        this.RenderArrows();
    }

    // Clears all user-drawn arrows from the board overlay.
    ClearArrows() {
        // Resets the Arrows array and empties the SVG overlay.
        this.Arrows = [];
        this.RenderArrows();
    }

    // Renders all active square-to-square arrows onto the SVG overlay.
    RenderArrows() {
        // Exits if the SVG overlay element has not been created yet.
        if (!this.ArrowSvgElement) {
            return;
        }
        this.ArrowSvgElement.innerHTML = '';

        // Draws a line and arrowhead polygon for each stored arrow.
        for (let Index = Zero; Index < this.Arrows.length; Index += One) {
            const Arrow = this.Arrows[Index];
            this.DrawSingleArrow(Arrow.From, Arrow.To);
        }
    }

    // Computes pixel coordinates and appends SVG shaft and arrowhead elements.
    DrawSingleArrow(FromSquare, ToSquare) {
        // Calculates the pixel centers of the start and end squares.
        const Start = this.SquareToPixelCenter(FromSquare);
        const End = this.SquareToPixelCenter(ToSquare);
        const DeltaX = End.X - Start.X;
        const DeltaY = End.Y - Start.Y;
        const Distance = Math.hypot(DeltaX, DeltaY);
        if (Distance <= Zero) {
            return;
        }

        // Computes unit direction and perpendicular vectors for the arrowhead.
        const UnitX = DeltaX / Distance;
        const UnitY = DeltaY / Distance;
        const PerpX = -UnitY;
        const PerpY = UnitX;
        const LineEndX = End.X - UnitX * ArrowShortenLength;
        const LineEndY = End.Y - UnitY * ArrowShortenLength;
        const BaseX = End.X - UnitX * ArrowHeadLength;
        const BaseY = End.Y - UnitY * ArrowHeadLength;

        // Appends the SVG shaft line and triangular arrowhead polygon.
        const Line = document.createElementNS(SvgNamespace, 'line');
        Line.setAttribute('class', 'ArrowLine');
        Line.setAttribute('x1', String(Start.X));
        Line.setAttribute('y1', String(Start.Y));
        Line.setAttribute('x2', String(LineEndX));
        Line.setAttribute('y2', String(LineEndY));
        const Head = document.createElementNS(SvgNamespace, 'polygon');
        Head.setAttribute('class', 'ArrowHeadPath');
        const LeftX = BaseX + PerpX * ArrowHeadHalfWidth;
        const LeftY = BaseY + PerpY * ArrowHeadHalfWidth;
        const RightX = BaseX - PerpX * ArrowHeadHalfWidth;
        const RightY = BaseY - PerpY * ArrowHeadHalfWidth;
        Head.setAttribute('points', `${End.X},${End.Y} ${LeftX},${LeftY} ${RightX},${RightY}`);
        this.ArrowSvgElement.appendChild(Line);
        this.ArrowSvgElement.appendChild(Head);
    }

    // Converts an algebraic square name into its pixel center coordinates on the SVG canvas.
    SquareToPixelCenter(SquareName) {
        // Maps file letter and rank digit to visual pixel offsets accounting for board flip.
        const RawFile = FileLetters.indexOf(SquareName[Zero]);
        const RawRank = Eight - Number(SquareName[One]);
        const VisualCol = this.Flipped ? (Seven - RawFile) : RawFile;
        const VisualRow = this.Flipped ? (Seven - RawRank) : RawRank;
        return {
            X: VisualCol * SquarePixelSize + HalfSquareSize,
            Y: VisualRow * SquarePixelSize + HalfSquareSize
        };
    }

    // Updates selection and target highlights in-place without destroying DOM nodes during drag.
    UpdateSelectionInPlace(SquareName) {
        // Sets the active Selected square and exits if the grid is not mounted.
        this.Selected = SquareName;
        if (!this.GridElement) {
            return;
        }

        // Updates CSS classes on each of the 64 square elements in-place.
        const Cells = this.GridElement.children;
        for (let Index = Zero; Index < Cells.length; Index += One) {
            const Cell = Cells[Index];
            const CellSquare = Cell.dataset.square;
            Cell.classList.remove('Selected');
            Cell.classList.remove('Dot');
            Cell.classList.remove('CaptureHint');
            if (CellSquare === SquareName) {
                Cell.classList.add('Selected');
            }
            this.AddTargets(Cell, CellSquare);
        }
    }

    // Adds rank numbers (1-8) and uppercase file letters (A-H) to board edge squares.
    ApplyCoordinates(Cell, FileIndex, Rank, VisualRow, VisualCol) {
        // Renders the rank number 1-8 in the top-left corner of the leftmost column.
        if (VisualCol === Zero) {
            const RankLabel = document.createElement('span');
            RankLabel.className = 'Coord CoordRank';
            RankLabel.textContent = String(Rank);
            Cell.appendChild(RankLabel);
        }

        // Renders the uppercase file letter A-H in the bottom-right corner of the bottom row.
        if (VisualRow === Seven) {
            const FileLabel = document.createElement('span');
            FileLabel.className = 'Coord CoordFile';
            FileLabel.textContent = DisplayFileLetters[FileIndex];
            Cell.appendChild(FileLabel);
        }
    }

    // Updates the board view from a live game state object.
    ApplyState(State, AllowMoves) {
        // Detects newly played moves and captures to trigger spring landing and ripple animations.
        const HistoryLen = State.History ? State.History.length : Zero;
        const MoveKey = State.LastMove ? `${HistoryLen}_${State.LastMove}` : '';
        if (MoveKey !== '' && MoveKey !== this.LastAnimatedMoveKey) {
            this.LastAnimatedMoveKey = MoveKey;
            this.AnimateNextMove = true;
            const LastSan = (State.SanHistory && State.SanHistory.length > Zero) ? State.SanHistory[State.SanHistory.length - One] : '';
            this.LastMoveWasCapture = typeof LastSan === 'string' && LastSan.includes('x');
        } else {
            this.AnimateNextMove = false;
            this.LastMoveWasCapture = false;
        }

        // Stores FEN, checked/checkmated king squares, and en passant square, then re-renders.
        this.Fen = State.Fen;
        this.CheckedKingSquare = State.CheckedKingSquare || null;
        this.CheckmatedKingSquare = State.CheckmatedKingSquare || null;
        this.EnPassantSquare = State.EnPassantSquare || null;
        this.Interactive = AllowMoves !== false;
        this.Arrows = [];
        this.ApplySelection(null);
        const VisibleMoves = this.Interactive ? State.LegalMoves : [];
        this.Render(VisibleMoves, State.LastMove);
    }

    // Displays a historical move frame on the board without altering the live game.
    ApplyHistoricalFrame(Frame) {
        // Loads the historical FEN, checked/checkmated king square, and last-move highlight.
        this.Fen = Frame.Fen;
        this.CheckedKingSquare = Frame.CheckedKingSquare || null;
        this.CheckmatedKingSquare = Frame.CheckmatedKingSquare || null;
        this.EnPassantSquare = null;
        this.Interactive = false;
        this.Arrows = [];
        this.ApplySelection(null);
        this.Render([], Frame.LastMove);
    }

    // Sets the currently selected square name.
    ApplySelection(SquareName) {
        // Updates the internal Selected property.
        this.Selected = SquareName;
    }

    // Marks legal destination squares for the currently selected piece.
    AddTargets(Cell, SquareName) {
        // Skips target rendering when no source square is currently selected.
        if (!this.Selected) {
            return;
        }

        // Checks whether any legal move from the selected square lands on SquareName.
        const MatchingTargets = this.LegalMoves.filter(
            (Item) => Item.slice(Zero, Two) === this.Selected && Item.slice(Two, Four) === SquareName
        );
        if (MatchingTargets.length === Zero) {
            return;
        }

        // Applies a capture ring if occupied or if the move is an en passant capture.
        const SelectedPiece = this.PieceAt(this.Selected).toUpperCase();
        const IsEnPassantCapture = SelectedPiece === 'P' && SquareName === this.EnPassantSquare && this.Selected[Zero] !== SquareName[Zero];
        const Occupied = this.PieceAt(SquareName) !== '' || IsEnPassantCapture;
        Cell.classList.add(Occupied ? 'CaptureHint' : 'Dot');
    }

    // Appends the SVG piece image from Assets to the square element if occupied.
    AddPiece(Cell, SquareName) {
        // Looks up the FEN piece character and its corresponding asset path.
        const GlyphKey = this.PieceAt(SquareName);
        if (GlyphKey === '') {
            return;
        }
        const AssetPath = PieceAssetPaths[GlyphKey];
        if (!AssetPath) {
            return;
        }

        // Creates the draggable image element and applies spring flight or falling animations.
        const ImageElement = document.createElement('img');
        ImageElement.className = 'PieceImage';
        if (this.AnimateNextMove && this.LastMove && this.LastMove.slice(Two, Four) === SquareName) {
            if (this.Physics) {
                const OriginCenter = this.SquareToPixelCenter(this.LastMove.slice(Zero, Two));
                const TargetCenter = this.SquareToPixelCenter(SquareName);
                this.Physics.AnimateSpringPiece(
                    ImageElement,
                    OriginCenter.X - TargetCenter.X,
                    OriginCenter.Y - TargetCenter.Y
                );
            } else {
                ImageElement.classList.add('PieceLanded');
            }
        }
        if (this.CheckmatedKingSquare === SquareName) {
            ImageElement.classList.add('CheckmatedKing');
        }
        ImageElement.src = AssetPath;
        ImageElement.alt = GlyphKey;
        const IsPremovePiece = !this.Interactive && this.PremoveColor !== null && this.IsPieceOfColor(GlyphKey, this.PremoveColor);
        const CanDrag = (this.Interactive && this.LegalMoves.some((Item) => Item.slice(Zero, Two) === SquareName)) || IsPremovePiece;
        ImageElement.draggable = CanDrag;
        ImageElement.addEventListener('dragstart', (Event) => {
            if (!CanDrag) {
                Event.preventDefault();
                return;
            }
            this.DraggedFromSquare = SquareName;
            ImageElement.classList.add('Dragging');
            this.UpdateSelectionInPlace(SquareName);
            if (Event.dataTransfer) {
                Event.dataTransfer.setData('text/plain', SquareName);
            }
        });
        ImageElement.addEventListener('dragend', () => {
            ImageElement.classList.remove('Dragging');
        });
        this.BindPieceTouchEvents(ImageElement, SquareName, CanDrag);
        Cell.appendChild(ImageElement);
    }

    // Attaches touchstart, touchmove, and touchend handlers for mobile finger drag-and-drop.
    BindPieceTouchEvents(ImageElement, SquareName, CanDrag) {
        // Starts tracking a finger drag when touching a movable piece.
        ImageElement.addEventListener('touchstart', (Event) => {
            if (!CanDrag || !Event.touches || Event.touches.length !== One) {
                return;
            }
            const Touch = Event.touches[Zero];
            this.TouchFromSquare = SquareName;
            this.TouchStartX = Touch.clientX;
            this.TouchStartY = Touch.clientY;
            this.TouchMoved = false;
            this.UpdateSelectionInPlace(SquareName);
        }, { passive: true });

        // Prevents page scrolling and highlights the square beneath the user's finger.
        ImageElement.addEventListener('touchmove', (Event) => {
            if (this.TouchFromSquare !== SquareName || !Event.touches || Event.touches.length === Zero) {
                return;
            }
            Event.preventDefault();
            const Touch = Event.touches[Zero];
            const Distance = Math.hypot(Touch.clientX - this.TouchStartX, Touch.clientY - this.TouchStartY);
            if (Distance >= TouchDragThreshold) {
                this.TouchMoved = true;
                ImageElement.classList.add('Dragging');
            }
            this.ClearDragHover();
            const HoverSquare = this.FindSquareCellAtPoint(Touch.clientX, Touch.clientY);
            if (HoverSquare) {
                HoverSquare.classList.add('DragHover');
            }
        }, { passive: false });

        // Completes the piece drop if the finger dragged to another square, or lets tap click fire.
        ImageElement.addEventListener('touchend', (Event) => {
            ImageElement.classList.remove('Dragging');
            this.ClearDragHover();
            if (this.TouchFromSquare === SquareName && this.TouchMoved && Event.changedTouches && Event.changedTouches.length > Zero) {
                const Touch = Event.changedTouches[Zero];
                const TargetCell = this.FindSquareCellAtPoint(Touch.clientX, Touch.clientY);
                const TargetSquare = TargetCell ? TargetCell.dataset.square : '';
                if (TargetSquare && TargetSquare !== SquareName && this.OnPieceDrop) {
                    Event.preventDefault();
                    this.ClearArrows();
                    this.OnPieceDrop(SquareName, TargetSquare);
                }
            }
            this.TouchFromSquare = null;
            this.TouchMoved = false;
        });

        // Resets touch state if the gesture is interrupted by the browser.
        ImageElement.addEventListener('touchcancel', () => {
            ImageElement.classList.remove('Dragging');
            this.ClearDragHover();
            this.TouchFromSquare = null;
            this.TouchMoved = false;
        });
    }

    // Finds the board square element under the given viewport coordinates.
    FindSquareCellAtPoint(ClientX, ClientY) {
        // Walks up from elementFromPoint until a .Square cell with dataset.square is found.
        if (!document.elementFromPoint) {
            return null;
        }
        let Node = document.elementFromPoint(ClientX, ClientY);
        while (Node && Node !== this.Root) {
            if (Node.dataset && Node.dataset.square) {
                return Node;
            }
            Node = Node.parentElement;
        }
        return null;
    }

    // Removes the DragHover highlight class from all squares on the board.
    ClearDragHover() {
        // Iterates over grid children and clears DragHover.
        if (!this.GridElement) {
            return;
        }
        const Cells = this.GridElement.children;
        for (let Index = Zero; Index < Cells.length; Index += One) {
            Cells[Index].classList.remove('DragHover');
        }
    }

    // Checks whether a FEN piece character belongs to ColorCode ('w' or 'b').
    IsPieceOfColor(PieceChar, ColorCode) {
        // Uppercase FEN characters are White; lowercase characters are Black.
        if (!PieceChar) {
            return false;
        }
        const IsUpper = PieceChar === PieceChar.toUpperCase();
        return ColorCode === 'w' ? IsUpper : !IsUpper;
    }

    // Reads the piece character at SquareName from the current FEN string.
    PieceAt(SquareName) {
        // Returns empty string when no FEN position has been loaded yet.
        if (!this.Fen) {
            return '';
        }

        // Extracts the target rank row from the FEN placement field.
        const Fields = this.Fen.split(' ');
        const Placement = Fields[Zero];
        const Rows = Placement.split(RankSeparator);
        const WantedRank = Number(SquareName[One]);
        const WantedFile = FileLetters.indexOf(SquareName[Zero]);
        const RowString = Rows[RankNumbers.indexOf(WantedRank)];

        // Walks across the FEN row characters to locate WantedFile.
        let FileCursor = Zero;
        for (let Index = Zero; Index < RowString.length; Index += One) {
            const Char = RowString[Index];
            if (Char >= '1' && Char <= '8') {
                FileCursor += Number(Char);
            } else {
                if (FileCursor === WantedFile) {
                    return Char;
                }
                FileCursor += One;
            }
        }

        // Returns empty string if no piece occupies the square.
        return '';
    }
}
