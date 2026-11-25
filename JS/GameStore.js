// Defines storage constants for persisting played games in localStorage.
const GameArchiveStorageKey = 'ValexChessGames_v1';
const MaxStoredGames = 50;
const GameIdRandomLength = Nine;

// Manages saving, loading, and deleting chess games in localStorage for move-by-move review.
class GameStorageManager {
    Initialize() {
        // Prepares the archive manager with the configured localStorage key.
        this.StorageKey = GameArchiveStorageKey;
    }

    // Generates a unique identifier for a newly started chess game.
    CreateGameId() {
        // Combines current timestamp with random characters from RoomAlphabet.
        let Suffix = '';
        for (let Index = Zero; Index < GameIdRandomLength; Index += One) {
            const Pick = Math.floor(Math.random() * RoomAlphabet.length);
            Suffix += RoomAlphabet[Pick];
        }
        return `Game_${Date.now()}_${Suffix}`;
    }

    // Reads and returns all saved games from localStorage sorted newest-first.
    LoadGames() {
        // Safely parses the JSON archive array from localStorage.
        if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
            return [];
        }
        try {
            const Raw = localStorage.getItem(this.StorageKey);
            if (!Raw) {
                return [];
            }
            const Parsed = JSON.parse(Raw);
            if (!Array.isArray(Parsed)) {
                return [];
            }
            return Parsed.sort((First, Second) => (Second.UpdatedAt || Zero) - (First.UpdatedAt || Zero));
        } catch (Error) {
            return [];
        }
    }

    // Inserts or updates a game record in localStorage and trims to MaxStoredGames.
    SaveGame(Record) {
        // Validates the game record and upserts it at the top of the archive.
        if (!Record || typeof Record.Id !== 'string' || Record.Id === '') {
            return;
        }
        const Games = this.LoadGames().filter((Item) => Item.Id !== Record.Id);
        Games.unshift(Record);
        const Trimmed = Games.slice(Zero, MaxStoredGames);
        this.WriteGames(Trimmed);
    }

    // Deletes a saved game by its identifier from localStorage.
    DeleteGame(GameId) {
        // Filters out the matching game ID and persists the remaining list.
        const Remaining = this.LoadGames().filter((Item) => Item.Id !== GameId);
        this.WriteGames(Remaining);
    }

    // Finds and returns a single saved game record by its identifier.
    GetGameById(GameId) {
        // Searches the stored archive for a matching game ID.
        const Games = this.LoadGames();
        for (let Index = Zero; Index < Games.length; Index += One) {
            if (Games[Index].Id === GameId) {
                return Games[Index];
            }
        }
        return null;
    }

    // Serializes and writes the game list array into localStorage.
    WriteGames(GamesArray) {
        // Persists the JSON payload and trims oldest entries if storage quota is tight.
        if (typeof localStorage === 'undefined' || typeof localStorage.setItem !== 'function') {
            return;
        }
        try {
            localStorage.setItem(this.StorageKey, JSON.stringify(GamesArray));
        } catch (Error) {
            if (GamesArray.length > One) {
                this.WriteGames(GamesArray.slice(Zero, Math.floor(GamesArray.length / Two)));
            }
        }
    }

    // Formats a millisecond timestamp into a concise readable date string.
    FormatTimestamp(TimestampMs) {
        // Converts the timestamp to short month, day, and 24-hour clock format.
        if (!TimestampMs) {
            return '';
        }
        try {
            const DateObj = new Date(TimestampMs);
            return DateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        } catch (Error) {
            return '';
        }
    }
}
