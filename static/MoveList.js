const HalfMovesPerTurn = 2;

class MoveListView {
    constructor(MountId) {
        this.Root = document.getElementById(MountId);
        this.Render([]);
    }

    Render(History) {
        this.Root.innerHTML = '';
        const Panel = document.createElement('div');
        Panel.className = 'Panel';
        const Title = document.createElement('h3');
        Title.textContent = 'Moves';
        Panel.appendChild(Title);
        const List = document.createElement('ol');
        for (let Index = 0; Index < History.length; Index += HalfMovesPerTurn) {
            const Item = document.createElement('li');
            const WhiteMove = History[Index] || '';
            const BlackMove = History[Index + 1] || '...';
            Item.textContent = `${WhiteMove} ${BlackMove}`;
            List.appendChild(Item);
        }
        Panel.appendChild(List);
        this.Root.appendChild(Panel);
        List.scrollTop = List.scrollHeight;
    }
}
