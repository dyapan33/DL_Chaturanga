import os
import sys
from typing import Dict

from flask import Flask, jsonify, request, send_from_directory

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from Api.Bots import ChooseMove, ConfigureEngine, CreateEngine, FindBot, ListBots
from Api.Game import Game, GameError


StaticDirectory = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')
DefaultElo = 1000
PortNumber = 5000
HostAddress = '0.0.0.0'


class ServerState:
    def __init__(self) -> None:
        self.Engine = CreateEngine()
        self.Game = Game()
        self.ConfiguredElo = -1


State = ServerState()
App = Flask(__name__, static_folder=StaticDirectory, static_url_path='')


@app.route('/')
def Index():
    return send_from_directory(StaticDirectory, 'Index.html')


@app.route('/api/Bots', methods=['GET'])
def ApiBots():
    Payload = [Item.Describe() for Item in ListBots()]
    return jsonify({'bots': Payload})


@app.route('/api/NewGame', methods=['POST'])
def ApiNewGame():
    Body: Dict[str, object] = request.get_json(silent=True) or {}
    SelectedBot = FindBot(int(Body.get('elo', DefaultElo)))
    State.Game.Start(SelectedBot.EloRating, str(Body.get('odds_pieces', '')), int(Body.get('odds_times', 1)))
    _EnsureEngine(SelectedBot.EloRating)
    return jsonify(State.Game.State())


@app.route('/api/Move', methods=['POST'])
def ApiMove():
    Body: Dict[str, object] = request.get_json(silent=True) or {}
    MoveUci = str(Body.get('move', ''))
    try:
        State.Game.PlayerMove(MoveUci)
    except GameError as Error:
        return jsonify({'error': str(Error)}), 400
    if State.Game.BotShouldMove():
        SelectedBot = FindBot(State.Game.BotElo)
        _EnsureEngine(SelectedBot.EloRating)
        BotMove = ChooseMove(State.Engine, State.Game.Board, SelectedBot)
        if BotMove:
            State.Game.ApplyBotMove(BotMove)
            State.Game.MarkTimeTaken()
    return jsonify(State.Game.State())


@app.route('/api/Undo', methods=['POST'])
def ApiUndo():
    try:
        State.Game.Undo()
    except GameError as Error:
        return jsonify({'error': str(Error)}), 400
    return jsonify(State.Game.State())


@app.route('/api/State', methods=['GET'])
def ApiState():
    return jsonify(State.Game.State())


def _EnsureEngine(EloRating: int) -> None:
    if State.ConfiguredElo != EloRating:
        ConfigureEngine(State.Engine, FindBot(EloRating))
        State.ConfiguredElo = EloRating


if __name__ == '__main__':
    App.run(host=HostAddress, port=PortNumber, debug=False)
