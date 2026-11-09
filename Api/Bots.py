from typing import Dict

import chess
from stockfish import Stockfish


EnginePath = '/usr/games/stockfish'
FallbackEnginePaths = ['/usr/local/bin/stockfish', '/usr/bin/stockfish', 'stockfish']
LowestElo = 100
HighestElo = 2700
EloStep = 100
MinUciElo = 1350
MaxUciElo = 2850
SkillFloor = 0
SkillCeiling = 8
FastTimeMs = 100
MediumTimeMs = 300
SlowTimeMs = 700
DefaultDepth = 15
WeakOddsPawns = 3
WeakOddsTimes = 9
StrongOddsTimes = 1


class Bot:
    def __init__(self, EloRating: int) -> None:
        self.EloRating = EloRating
        self.Name = f'Stockfish {EloRating}'
        self.ThinkingMs = _ThinkingTime(EloRating)
        self.OddsTimes = _OddsTimes(EloRating)
        self.OddsPieces = _OddsPieces(EloRating)

    def Describe(self) -> Dict[str, object]:
        return {'elo': self.EloRating, 'name': self.Name, 'thinking_ms': self.ThinkingMs}


def ListBots() -> list[Bot]:
    return [Bot(SelectedElo) for SelectedElo in range(LowestElo, HighestElo + EloStep, EloStep)]


def FindBot(RequestedElo: int) -> Bot:
    ClampedElo = min(max(int(RequestedElo), LowestElo), HighestElo)
    RoundedElo = (ClampedElo // EloStep) * EloStep
    return Bot(RoundedElo)


def CreateEngine() -> Stockfish:
    for CandidatePath in [EnginePath] + FallbackEnginePaths:
        try:
            return Stockfish(path=CandidatePath, depth=DefaultDepth)
        except Exception:
            continue
    raise RuntimeError('Stockfish binary not found; install it and retry.')


def ConfigureEngine(Engine: Stockfish, SelectedBot: Bot) -> None:
    Engine.set_skill_level(SkillFloor)
    Engine.resume_full_strength()
    if SelectedBot.EloRating <= MinUciElo:
        Engine.update_engine_parameters({'UCI_LimitStrength': False})
        Engine.set_skill_level(_SkillForElo(SelectedBot.EloRating))
    else:
        Engine.set_elo_rating(min(SelectedBot.EloRating, MaxUciElo))


def ChooseMove(Engine: Stockfish, Board: chess.Board, SelectedBot: Bot) -> str | None:
    Engine.set_fen_position(Board.fen())
    BestMove = Engine.get_best_move_time(SelectedBot.ThinkingMs)
    if BestMove is None:
        return None
    FromSquare, ToSquare, PromotionPart = BestMove[:2], BestMove[2:4], BestMove[4:]
    return FromSquare + ToSquare + PromotionPart.lower()


def OddsConfig(SelectedBot: Bot) -> Dict[str, object]:
    return {'odds_pieces': SelectedBot.OddsPieces, 'odds_times': SelectedBot.OddsTimes}


def _SkillForElo(EloRating: int) -> int:
    Span = MinUciElo - LowestElo
    Scaled = (EloRating - LowestElo) * (SkillCeiling - SkillFloor) // max(Span, 1)
    return min(max(SkillFloor + Scaled, SkillFloor), SkillCeiling)


def _ThinkingTime(EloRating: int) -> int:
    if EloRating < 900:
        return FastTimeMs
    if EloRating < 1700:
        return MediumTimeMs
    return SlowTimeMs


def _OddsPieces(EloRating: int) -> str:
    if EloRating < 700:
        return 'pawnb1'
    if EloRating < 1000:
        return 'knightsb1g1'
    if EloRating < 1300:
        return 'rooksa1h1'
    if EloRating < 1700:
        return 'queen'
    if EloRating < 2000:
        return 'rook'
    if EloRating < 2300:
        return 'minor'
    if EloRating < 2600:
        return 'pawn'
    return ''


def _OddsTimes(EloRating: int) -> int:
    if EloRating < 500:
        return WeakOddsTimes
    if EloRating < 900:
        return WeakOddsPawns
    return StrongOddsTimes
