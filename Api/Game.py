import threading
from typing import Dict, Optional

import chess


class GameError(Exception):
    pass


class Game:
    def __init__(self) -> None:
        self.Board = chess.Board()
        self.History: list[str] = []
        self.Lock = threading.Lock()
        self.BotElo = 1000
        self.OddsPieces = ''
        self.OddsTimes = 1
        self.TimesTaken = 0
        self.Result: Optional[str] = None
        self.LastMove: Optional[str] = None

    def Start(self, EloRating: int, OddsPieces: str, OddsTimes: int) -> None:
        with self.Lock:
            self.Board = chess.Board()
            self._ApplyOdds(OddsPieces)
            self.History = []
            self.BotElo = EloRating
            self.OddsPieces = OddsPieces
            self.OddsTimes = OddsTimes
            self.TimesTaken = 0
            self.Result = None
            self.LastMove = None

    def State(self) -> Dict[str, object]:
        return {
            'fen': self.Board.fen(),
            'turn': 'w' if self.Board.turn else 'b',
            'history': list(self.History),
            'legal_moves': [Item.uci() for Item in self.Board.legal_moves],
            'in_check': self.Board.is_check(),
            'game_over': self.Board.is_game_over(),
            'result': self.Result or _OutcomeText(self.Board),
            'bot_elo': self.BotElo,
            'odds_pieces': self.OddsPieces,
            'odds_times': self.OddsTimes,
            'times_taken': self.TimesTaken,
            'last_move': self.LastMove,
        }

    def PlayerMove(self, MoveUci: str) -> None:
        with self.Lock:
            self._GuardTurn()
            Parsed = chess.Move.from_uci(MoveUci)
            if Parsed not in self.Board.legal_moves:
                raise GameError('Illegal move.')
            self.Board.push(Parsed)
            self.History.append(Parsed.uci())
            self.LastMove = Parsed.uci()
            self._CheckTerminal()

    def ApplyBotMove(self, MoveUci: str) -> None:
        with self.Lock:
            self._GuardTurn()
            Parsed = chess.Move.from_uci(MoveUci)
            if Parsed not in self.Board.legal_moves:
                raise GameError('Engine returned an illegal move.')
            self.Board.push(Parsed)
            self.History.append(Parsed.uci())
            self.LastMove = Parsed.uci()
            self._CheckTerminal()

    def BotShouldMove(self) -> bool:
        with self.Lock:
            if self.Board.is_game_over():
                return False
            if self.Board.turn != chess.BLACK:
                return False
            if self.TimesTaken >= self.OddsTimes:
                return False
            return True

    def MarkTimeTaken(self) -> None:
        with self.Lock:
            self.TimesTaken += 1

    def Undo(self) -> None:
        with self.Lock:
            if not self.Board.move_stack:
                raise GameError('No moves to undo.')
            while self.Board.move_stack and self.Board.move_stack[-1].color != chess.WHITE:
                self.Board.pop()
            if self.Board.move_stack:
                self.Board.pop()
            self.History = [Item.uci() for Item in self.Board.move_stack]
            self.Result = None
            self.TimesTaken = max(self.TimesTaken - 1, 0)
            self.LastMove = self.History[-1] if self.History else None

    def _GuardTurn(self) -> None:
        if self.Board.is_game_over():
            raise GameError('Game is over.')
        if self.Board.turn != chess.WHITE:
            raise GameError('Not your turn.')

    def _CheckTerminal(self) -> None:
        if self.Board.is_game_over():
            self.Result = _OutcomeText(self.Board)

    def _ApplyOdds(self, OddsPieces: str) -> None:
        RemovedSquares = _OddsSquares(OddsPieces)
        for SquareName in RemovedSquares:
            Square = chess.parse_square(SquareName)
            Piece = self.Board.piece_at(Square)
            if Piece and Piece.color == chess.WHITE:
                self.Board.remove_piece_at(Square)


def _OddsSquares(OddsPieces: str) -> list[str]:
    Presets = {
        'pawnb1': ['b1'],
        'knightsb1g1': ['b1', 'g1'],
        'rooksa1h1': ['a1', 'h1'],
        'queen': ['d1'],
        'rook': ['a1'],
        'minor': ['b1'],
        'pawn': ['b2'],
    }
    return Presets.get(OddsPieces, [])


def _OutcomeText(Board: chess.Board) -> str:
    if not Board.is_game_over():
        return ''
    Result = Board.result()
    Labels = {'1-0': 'Bot wins', '0-1': 'You win', '1/2-1/2': 'Draw'}
    return Labels.get(Result, 'Game over')
