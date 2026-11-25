// Defines constants for the PeerJS public random matchmaking lobby.
const PublicLobbyPeerId = 'dl-chaturanga-public-lobby-v1';
const LobbyPlayerIdLength = Nine;
const LobbyHandoverDelayMs = 350;
const GuestJoinDelayMs = 550;
const FailoverBaseMs = 500;
const FailoverJitterMs = 950;
const LobbyConnectTimeoutMs = 5000;
const CoinFlipHalf = 0.5;

// Manages PeerJS-only public random matchmaking with automatic host election and failover.
class PublicLobbyManager {
    Initialize(OnEventCallback) {
        // Stores the event callback and initializes lobby peer and queue state.
        this.OnEventCallback = OnEventCallback;
        this.PlayerId = this.GenerateId(LobbyPlayerIdLength);
        this.IsSearching = false;
        this.IsLobbyHost = false;
        this.LocalTicket = null;
        this.LobbyPeer = null;
        this.HostConnection = null;
        this.Queue = [];
        this.ReconnectTimerId = null;
        this.ConnectTimeoutId = null;
        this.HandoverTimerId = null;
    }

    // Generates a random alphanumeric identifier using Web Crypto or Math.random.
    GenerateId(Length) {
        // Uses RoomAlphabet and Web Crypto when available in the browser.
        let Output = '';
        const HasCrypto = typeof window !== 'undefined' && window.crypto && typeof window.crypto.getRandomValues === 'function';
        if (HasCrypto) {
            const Words = new Uint32Array(Length);
            window.crypto.getRandomValues(Words);
            for (let Index = Zero; Index < Length; Index += One) {
                Output += RoomAlphabet[Words[Index] % RoomAlphabet.length];
            }
            return Output;
        }

        // Falls back to Math.random when Web Crypto is unavailable.
        for (let Index = Zero; Index < Length; Index += One) {
            const Pick = Math.floor(Math.random() * RoomAlphabet.length);
            Output += RoomAlphabet[Pick];
        }
        return Output;
    }

    // Sanitizes a player display name for public lobby matchmaking.
    SanitizeName(RawName) {
        // Strips markup and control characters and clamps to MaxNameLength.
        const Cleaned = String(RawName || '')
            .replace(/[<>"'`&]/g, '')
            .replace(/[\u0000-\u001F\u007F]/g, '')
            .trim();
        return Cleaned.slice(Zero, MaxNameLength);
    }

    // Enters the PeerJS public matchmaking queue to find a random opponent.
    JoinQueue(PlayerName, PreferredColor, TimeSeconds, IncrementSeconds) {
        // Resets any prior lobby session and stores the local matchmaking ticket.
        this.LeaveQueue();
        if (typeof window === 'undefined' || typeof window.Peer !== 'function') {
            this.EmitEvent({
                Type: 'LobbyError',
                Message: 'PeerJS is not available in this browser.'
            });
            return false;
        }
        const CleanName = this.SanitizeName(PlayerName) || 'Player';
        this.IsSearching = true;
        this.LocalTicket = {
            PlayerId: this.PlayerId,
            PlayerName: CleanName,
            PreferredColor: PreferredColor === 'b' ? 'b' : 'w',
            TimeSeconds: Number(TimeSeconds) || Zero,
            IncrementSeconds: Number(IncrementSeconds) || Zero,
            Connection: null
        };
        this.EmitEvent({
            Type: 'LobbyStatus',
            Message: 'Connecting to public lobby...'
        });
        this.AttemptHostElection();
        return true;
    }

    // Attempts to claim the fixed Lobby Peer ID, falling back to client mode if taken.
    AttemptHostElection() {
        // Aborts if the player cancelled matchmaking before this attempt started.
        if (!this.IsSearching) {
            return;
        }
        this.TeardownPeer();
        this.IsLobbyHost = false;
        try {
            const PeerObj = new window.Peer(PublicLobbyPeerId, {
                secure: true,
                config: { iceServers: IceServerList }
            });
            this.LobbyPeer = PeerObj;
            this.BindHostPeerEvents(PeerObj);
        } catch (Error) {
            this.ScheduleReconnect();
        }
    }

    // Binds open, connection, and error handlers for a candidate Lobby Host peer.
    BindHostPeerEvents(PeerObj) {
        // Registers this peer as Lobby Host once the fixed ID is claimed.
        PeerObj.on('open', () => {
            if (!this.IsSearching || this.LobbyPeer !== PeerObj) {
                return;
            }
            this.IsLobbyHost = true;
            this.Queue = [];
            if (this.LocalTicket) {
                this.Queue.push(this.LocalTicket);
            }
            this.EmitEvent({
                Type: 'LobbyStatus',
                Message: 'Searching for a random opponent... (1 player in queue)'
            });
        });

        // Accepts incoming lobby clients and processes their queue join/leave packets.
        PeerObj.on('connection', (Connection) => {
            if (!this.IsSearching || !this.IsLobbyHost) {
                if (Connection && Connection.close) {
                    Connection.close();
                }
                return;
            }
            this.BindIncomingClientConnection(Connection);
        });

        // Switches to client mode if the fixed Lobby ID is already claimed by another player.
        PeerObj.on('error', (Err) => {
            if (!this.IsSearching || this.LobbyPeer !== PeerObj) {
                return;
            }
            if (Err && Err.type === 'unavailable-id') {
                this.ConnectAsLobbyClient();
                return;
            }
            this.ScheduleReconnect();
        });
    }

    // Binds data and close listeners on a remote client connected to the Lobby Host.
    BindIncomingClientConnection(Connection) {
        // Handles QueueJoin and QueueLeave messages from a waiting client.
        if (!Connection || !Connection.on) {
            return;
        }
        Connection.on('data', (Packet) => {
            if (!this.IsSearching || !this.IsLobbyHost || !Packet || typeof Packet.Type !== 'string') {
                return;
            }
            if (Packet.Type === 'QueueJoin' && typeof Packet.PlayerId === 'string') {
                this.EnqueueRemotePlayer(Packet, Connection);
                return;
            }
            if (Packet.Type === 'QueueLeave' && typeof Packet.PlayerId === 'string') {
                this.RemoveFromQueueById(Packet.PlayerId);
                this.BroadcastQueueStatus();
            }
        });
        Connection.on('close', () => {
            this.RemoveFromQueueByConnection(Connection);
            this.BroadcastQueueStatus();
        });
    }

    // Adds or updates a remote player's ticket in the host queue and attempts pairing.
    EnqueueRemotePlayer(Packet, Connection) {
        // Deduplicates the player ID, appends their ticket, and tries to match a pair.
        this.RemoveFromQueueById(Packet.PlayerId);
        this.Queue.push({
            PlayerId: Packet.PlayerId,
            PlayerName: this.SanitizeName(Packet.PlayerName) || 'Player',
            PreferredColor: Packet.PreferredColor === 'b' ? 'b' : 'w',
            TimeSeconds: Number(Packet.TimeSeconds) || Zero,
            IncrementSeconds: Number(Packet.IncrementSeconds) || Zero,
            Connection: Connection
        });
        this.TryMatchPlayers();
        this.BroadcastQueueStatus();
    }

    // Removes a waiting player entry from the host queue by PlayerId.
    RemoveFromQueueById(TargetPlayerId) {
        // Filters out any queue entry matching TargetPlayerId.
        this.Queue = this.Queue.filter((Entry) => Entry.PlayerId !== TargetPlayerId);
    }

    // Removes a waiting player entry from the host queue when their connection closes.
    RemoveFromQueueByConnection(TargetConnection) {
        // Filters out any queue entry attached to TargetConnection.
        this.Queue = this.Queue.filter((Entry) => Entry.Connection !== TargetConnection);
    }

    // Pairs waiting players in the queue into encrypted multiplayer rooms.
    TryMatchPlayers() {
        // Repeats pairing while at least two waiting players are in the queue.
        while (this.Queue.length >= Two && this.IsSearching) {
            const Pair = this.SelectMatchPair();
            if (!Pair) {
                return;
            }
            this.DispatchMatch(Pair.First, Pair.Second);
        }
    }

    // Selects two players to pair, preferring matching time controls when available.
    SelectMatchPair() {
        // Checks whether the first player has an exact time-control match in the queue.
        if (this.Queue.length < Two) {
            return null;
        }
        const First = this.Queue.shift();
        let PartnerIndex = Zero;
        for (let Index = Zero; Index < this.Queue.length; Index += One) {
            const Candidate = this.Queue[Index];
            if (Candidate.TimeSeconds === First.TimeSeconds && Candidate.IncrementSeconds === First.IncrementSeconds) {
                PartnerIndex = Index;
                break;
            }
        }
        const Second = this.Queue.splice(PartnerIndex, One)[Zero];
        return { First: First, Second: Second };
    }

    // Assigns colors and a room code to a matched pair and notifies both players.
    DispatchMatch(FirstPlayer, SecondPlayer) {
        // Determines room host, guest, colors, and agreed clock settings.
        const RoomCode = this.GenerateId(RoomCodeLength);
        const Colors = this.AssignMatchColors(FirstPlayer.PreferredColor, SecondPlayer.PreferredColor);
        const AgreedTime = FirstPlayer.TimeSeconds;
        const AgreedIncrement = FirstPlayer.IncrementSeconds;
        const FirstPayload = {
            Type: 'MatchFound',
            Role: 'host',
            RoomCode: RoomCode,
            Color: Colors.FirstColor,
            OpponentName: SecondPlayer.PlayerName,
            TimeSeconds: AgreedTime,
            IncrementSeconds: AgreedIncrement
        };
        const SecondPayload = {
            Type: 'MatchFound',
            Role: 'guest',
            RoomCode: RoomCode,
            Color: Colors.SecondColor,
            OpponentName: FirstPlayer.PlayerName,
            TimeSeconds: AgreedTime,
            IncrementSeconds: AgreedIncrement
        };

        // Delivers MatchFound to remote clients and schedules local handover if host matched.
        const FirstIsLocal = FirstPlayer.PlayerId === this.PlayerId;
        const SecondIsLocal = SecondPlayer.PlayerId === this.PlayerId;
        if (!FirstIsLocal && FirstPlayer.Connection && FirstPlayer.Connection.open) {
            FirstPlayer.Connection.send(FirstPayload);
        }
        if (!SecondIsLocal && SecondPlayer.Connection && SecondPlayer.Connection.open) {
            SecondPlayer.Connection.send(SecondPayload);
        }
        if (FirstIsLocal || SecondIsLocal) {
            const LocalPayload = FirstIsLocal ? FirstPayload : SecondPayload;
            this.IsSearching = false;
            this.IsLobbyHost = false;
            this.ClearTimers();
            this.HandoverTimerId = setTimeout(() => {
                this.HandoverTimerId = null;
                this.TeardownPeer();
                this.EmitEvent(LocalPayload);
            }, LobbyHandoverDelayMs);
        }
    }

    // Assigns White and Black to two matched players, honoring opposite preferences or flipping a coin.
    AssignMatchColors(FirstPref, SecondPref) {
        // Honors preferences when opposite; otherwise assigns White randomly.
        if (FirstPref === 'w' && SecondPref === 'b') {
            return { FirstColor: 'w', SecondColor: 'b' };
        }
        if (FirstPref === 'b' && SecondPref === 'w') {
            return { FirstColor: 'b', SecondColor: 'w' };
        }
        const FirstIsWhite = Math.random() < CoinFlipHalf;
        return {
            FirstColor: FirstIsWhite ? 'w' : 'b',
            SecondColor: FirstIsWhite ? 'b' : 'w'
        };
    }

    // Broadcasts the current queue count to all waiting clients and updates local status.
    BroadcastQueueStatus() {
        // Exits if this peer is no longer acting as the active Lobby Host.
        if (!this.IsSearching || !this.IsLobbyHost) {
            return;
        }
        const Count = this.Queue.length;
        const Label = Count === One ? '1 player in queue' : `${Count} players in queue`;
        for (let Index = Zero; Index < this.Queue.length; Index += One) {
            const Entry = this.Queue[Index];
            if (Entry.Connection && Entry.Connection.open) {
                Entry.Connection.send({
                    Type: 'QueueStatus',
                    WaitingCount: Count
                });
            }
        }
        this.EmitEvent({
            Type: 'LobbyStatus',
            Message: `Searching for a random opponent... (${Label})`
        });
    }

    // Connects as an anonymous PeerJS client to the active Lobby Host peer.
    ConnectAsLobbyClient() {
        // Creates an ephemeral PeerJS instance and opens a connection to PublicLobbyPeerId.
        if (!this.IsSearching) {
            return;
        }
        this.TeardownPeer();
        this.IsLobbyHost = false;
        try {
            const PeerObj = new window.Peer({
                secure: true,
                config: { iceServers: IceServerList }
            });
            this.LobbyPeer = PeerObj;
            PeerObj.on('open', () => {
                if (!this.IsSearching || this.LobbyPeer !== PeerObj) {
                    return;
                }
                const Connection = PeerObj.connect(PublicLobbyPeerId, { reliable: true });
                this.HostConnection = Connection;
                this.BindClientToHostConnection(Connection);
                this.StartConnectTimeout(Connection);
            });
            PeerObj.on('error', () => {
                if (this.IsSearching && this.LobbyPeer === PeerObj) {
                    this.ScheduleReconnect();
                }
            });
        } catch (Error) {
            this.ScheduleReconnect();
        }
    }

    // Binds open, data, close, and error handlers on the client's connection to the Lobby Host.
    BindClientToHostConnection(Connection) {
        // Sends QueueJoin once connected and listens for QueueStatus or MatchFound.
        if (!Connection || !Connection.on) {
            return;
        }
        Connection.on('open', () => {
            this.ClearConnectTimeout();
            if (!this.IsSearching || !this.LocalTicket) {
                return;
            }
            Connection.send({
                Type: 'QueueJoin',
                PlayerId: this.LocalTicket.PlayerId,
                PlayerName: this.LocalTicket.PlayerName,
                PreferredColor: this.LocalTicket.PreferredColor,
                TimeSeconds: this.LocalTicket.TimeSeconds,
                IncrementSeconds: this.LocalTicket.IncrementSeconds
            });
            this.EmitEvent({
                Type: 'LobbyStatus',
                Message: 'Connected to public lobby. Searching for an opponent...'
            });
        });
        Connection.on('data', (Packet) => {
            if (!this.IsSearching || !Packet || typeof Packet.Type !== 'string') {
                return;
            }
            if (Packet.Type === 'QueueStatus') {
                const Count = Number(Packet.WaitingCount) || One;
                const Label = Count === One ? '1 player in queue' : `${Count} players in queue`;
                this.EmitEvent({
                    Type: 'LobbyStatus',
                    Message: `Searching for a random opponent... (${Label})`
                });
                return;
            }
            if (Packet.Type === 'MatchFound') {
                this.IsSearching = false;
                this.ClearTimers();
                this.TeardownPeer();
                this.EmitEvent(Packet);
            }
        });
        Connection.on('close', () => {
            if (this.IsSearching) {
                this.ScheduleReconnect();
            }
        });
        Connection.on('error', () => {
            if (this.IsSearching) {
                this.ScheduleReconnect();
            }
        });
    }

    // Starts a timeout to detect an unresponsive Lobby Host and trigger re-election.
    StartConnectTimeout(Connection) {
        // Schedules a reconnect if the client data channel does not open in time.
        this.ClearConnectTimeout();
        if (typeof setTimeout !== 'function') {
            return;
        }
        this.ConnectTimeoutId = setTimeout(() => {
            this.ConnectTimeoutId = null;
            if (this.IsSearching && (!Connection || !Connection.open)) {
                this.ScheduleReconnect();
            }
        }, LobbyConnectTimeoutMs);
    }

    // Clears any pending client connection timeout.
    ClearConnectTimeout() {
        // Cancels ConnectTimeoutId if currently active.
        if (this.ConnectTimeoutId !== null) {
            clearTimeout(this.ConnectTimeoutId);
            this.ConnectTimeoutId = null;
        }
    }

    // Schedules a jittered re-election attempt after a host disconnect or network error.
    ScheduleReconnect() {
        // Avoids overlapping timers and retries host election after a randomized delay.
        if (!this.IsSearching || this.ReconnectTimerId !== null) {
            return;
        }
        this.TeardownPeer();
        this.EmitEvent({
            Type: 'LobbyStatus',
            Message: 'Reconnecting to public lobby...'
        });
        const Delay = FailoverBaseMs + Math.floor(Math.random() * FailoverJitterMs);
        this.ReconnectTimerId = setTimeout(() => {
            this.ReconnectTimerId = null;
            if (this.IsSearching) {
                this.AttemptHostElection();
            }
        }, Delay);
    }

    // Leaves the public matchmaking queue and frees all PeerJS resources and timers.
    LeaveQueue() {
        // Notifies the Lobby Host if connected as a client, then cleans up peers and timers.
        if (this.HostConnection && this.HostConnection.open && this.LocalTicket) {
            try {
                this.HostConnection.send({
                    Type: 'QueueLeave',
                    PlayerId: this.LocalTicket.PlayerId
                });
            } catch (Error) {
                // Ignores send errors during teardown.
            }
        }
        this.IsSearching = false;
        this.IsLobbyHost = false;
        this.LocalTicket = null;
        this.Queue = [];
        this.ClearTimers();
        this.TeardownPeer();
    }

    // Clears all active reconnect, connection timeout, and handover timers.
    ClearTimers() {
        // Cancels every timer identifier managed by PublicLobbyManager.
        this.ClearConnectTimeout();
        if (this.ReconnectTimerId !== null) {
            clearTimeout(this.ReconnectTimerId);
            this.ReconnectTimerId = null;
        }
        if (this.HandoverTimerId !== null) {
            clearTimeout(this.HandoverTimerId);
            this.HandoverTimerId = null;
        }
    }

    // Closes active PeerJS lobby connections and destroys the PeerJS instance.
    TeardownPeer() {
        // Safely closes HostConnection and destroys LobbyPeer.
        if (this.HostConnection) {
            try {
                this.HostConnection.close();
            } catch (Error) {
                // Ignores connection close errors.
            }
            this.HostConnection = null;
        }
        if (this.LobbyPeer) {
            try {
                this.LobbyPeer.destroy();
            } catch (Error) {
                // Ignores peer destroy errors.
            }
            this.LobbyPeer = null;
        }
    }

    // Invokes the registered controller event callback with a lobby event payload.
    EmitEvent(Payload) {
        // Dispatches Payload to OnEventCallback when configured.
        if (this.OnEventCallback) {
            this.OnEventCallback(Payload);
        }
    }
}
