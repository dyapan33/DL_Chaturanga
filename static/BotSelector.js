const OddsOptions = [
    { Value: '', Label: 'Even (no odds)' },
    { Value: 'pawnb1', Label: 'Knight b1 (~500 Elo feel)' },
    { Value: 'knightsb1g1', Label: 'Two knights (~900)' },
    { Value: 'rooksa1h1', Label: 'Two rooks (~1200)' },
    { Value: 'queen', Label: 'Queen (~1500)' },
    { Value: 'rook', Label: 'One rook (~1800)' },
    { Value: 'minor', Label: 'One knight (~2100)' },
    { Value: 'pawn', Label: 'One pawn (~2400)' }
];

const BotStep = 100;
const BotFirstElo = 100;
const BotLastElo = 2700;
const DefaultBotElo = 1000;
const TimesChoices = [1, 3, 9];
const TimesLabels = ['1 move per player turn', '3 moves per player turn', '9 moves per player turn'];

class BotSelectorView {
    constructor(MountId, OnNewGame) {
        this.Root = document.getElementById(MountId);
        this.OnNewGame = OnNewGame;
        this.Bots = [];
        this.Render();
    }

    async Load() {
        const Response = await fetch('/api/Bots');
        const Data = await Response.json();
        this.Bots = Data.bots;
        this.Render();
    }

    Render() {
        this.Root.innerHTML = '';
        const Panel = document.createElement('div');
        Panel.className = 'Panel';

        const Title = document.createElement('h3');
        Title.textContent = 'Choose your bot';
        Panel.appendChild(Title);

        const EloRow = this._BuildEloRow();
        const OddsRow = this._BuildOddsRow();
        const TimesRow = this._BuildTimesRow();
        Panel.appendChild(EloRow.Row);
        Panel.appendChild(OddsRow.Row);
        Panel.appendChild(TimesRow.Row);

        const Info = document.createElement('p');
        Info.className = 'Subtitle';
        Info.id = 'BotInfo';
        Info.textContent = this.Bots.length > 0 ? '' : 'Loading bots from Stockfish...';
        Panel.appendChild(Info);

        const StartButton = document.createElement('button');
        StartButton.type = 'button';
        StartButton.textContent = 'Start Game';
        StartButton.addEventListener('click', () => {
            this.OnNewGame(Number(EloRow.Select.value), OddsRow.Select.value, Number(TimesRow.Select.value));
        });
        Panel.appendChild(StartButton);
        this.Root.appendChild(Panel);
    }

    _BuildEloRow() {
        const Row = document.createElement('div');
        Row.className = 'SelectorRow';
        const Label = document.createElement('label');
        Label.textContent = 'Bot strength (Elo): 100 - 2700';
        const Select = document.createElement('select');
        for (let Elo = BotFirstElo; Elo <= BotLastElo; Elo += BotStep) {
            const Option = document.createElement('option');
            Option.value = String(Elo);
            Option.textContent = `${Elo} Elo`;
            if (Elo === DefaultBotElo) {
                Option.selected = true;
            }
            Select.appendChild(Option);
        }
        Row.appendChild(Label);
        Row.appendChild(Select);
        return { Row: Row, Select: Select };
    }

    _BuildOddsRow() {
        const Row = document.createElement('div');
        Row.className = 'SelectorRow';
        const Label = document.createElement('label');
        Label.textContent = 'Material odds (bot plays short pieces):';
        const Select = document.createElement('select');
        OddsOptions.forEach((Item) => {
            const Option = document.createElement('option');
            Option.value = Item.Value;
            Option.textContent = Item.Label;
            Select.appendChild(Option);
        });
        Row.appendChild(Label);
        Row.appendChild(Select);
        return { Row: Row, Select: Select };
    }

    _BuildTimesRow() {
        const Row = document.createElement('div');
        Row.className = 'SelectorRow';
        const Label = document.createElement('label');
        Label.textContent = 'Bot moves per player turn:';
        const Select = document.createElement('select');
        TimesChoices.forEach((Count, Index) => {
            const Option = document.createElement('option');
            Option.value = String(Count);
            Option.textContent = TimesLabels[Index];
            Select.appendChild(Option);
        });
        Row.appendChild(Label);
        Row.appendChild(Select);
        return { Row: Row, Select: Select };
    }
}
