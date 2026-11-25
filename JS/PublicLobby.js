// Defines constants for multi-transport public random matchmaking.
const PublicLobbyChannel = 'ValexChessPublicLobby_v1';
const PublicLobbyRelayHttp = 'https://ntfy.sh/ValexChessPublicLobby_v1';
const PublicLobbyRelayWs = 'wss://ntfy.sh/ValexChessPublicLobby_v1/ws';
const PublicLobbyRelaySse = 'https://ntfy.sh/ValexChessPublicLobby_v1/sse';
const PublicLobbyStorageKey = 'ValexChessPublicLobbyMsg_v1';
const LobbyPlayerIdLength = Nine;
const LobbySeekIntervalMs = 1500;
const LobbySeekerTtlMs = 5500;
const GuestJoinDelayMs = 450;
const CoinFlipHalf = 0.5;
const MaxLobbyPacketLength = 1500;

// Manages public random matchmaking across devices and tabs with deterministic pairing.
class PublicLobbyManager {
    Initialize(OnEventCallback) {
        // Stores the event callback and initializes lobby transport and seeker state.
        this.OnEventCallback = OnEventCallback;
        this.PlayerId = this.GenerateId(LobbyPlayerIdLength);
        this.IsSearching = false;
        this.LocalTicket = null;
        this.SeenSeekers = {};
        this.Broadcast = null;
        this.RelaySocket = null;
        this.RelayStream = null;
        this.StorageListener = null;
        this.SeekTimerId = null;
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

    // Enters the public matchmaking queue and opens local and cross-device transports.
    JoinQueue(PlayerName, PreferredColor, TimeSeconds, IncrementSeconds) {
        // Resets any prior lobby session and prepares a fresh matchmaking ticket.
        this.LeaveQueue();
        this.PlayerId = this.GenerateId(LobbyPlayerIdLength);
        const CleanName = this.SanitizeName(PlayerName) || 'Player';
        this.IsSearching = true;
        this.SeenSeekers = {};
        this.LocalTicket = {
            PlayerId: this.PlayerId,
            PlayerName: CleanName,
            PreferredColor: PreferredColor === 'b' ? 'b' : 'w',
            TimeSeconds: Number(TimeSeconds) || Zero,
            IncrementSeconds: Number(IncrementSeconds) || Zero
        };

        // Opens BroadcastChannel, localStorage, and ntfy.sh relay transports.
        this.OpenLocalTransports();
        this.OpenRelayTransports();
        this.EmitEvent({
            Type: 'LobbyStatus',
            Message: 'Searching for a random opponent... (1 player in queue)'
        });
        this.BroadcastSeekPacket();
        this.StartSeekHeartbeat();
        return true;
    }

    // Opens BroadcastChannel and localStorage listeners for instant same-device matching.
    OpenLocalTransports() {
        // Attaches a BroadcastChannel listener when supported by the browser.
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                this.Broadcast = new BroadcastChannel(PublicLobbyChannel);
                this.Broadcast.onmessage = (Event) => {
                    if (Event && Event.data) {
                        this.HandleIncomingPacket(Event.data);
                    }
                };
            } catch (Error) {
                this.Broadcast = null;
            }
        }

        // Attaches a window storage listener as a cross-tab fallback.
        if (typeof window !== 'undefined' && window.addEventListener) {
            this.StorageListener = (Event) => {
                if (Event && Event.key === PublicLobbyStorageKey && Event.newValue) {
                    if (Event.newValue.length > MaxLobbyPacketLength) {
                        return;
                    }
                    try {
                        this.HandleIncomingPacket(JSON.parse(Event.newValue));
                    } catch (Error) {
                        return;
                    }
                }
            };
            window.addEventListener('storage', this.StorageListener);
        }
    }

    // Opens WebSocket and SSE subscriptions on the public ntfy.sh matchmaking topic.
    OpenRelayTransports() {
        // Connects via WebSocket for low-latency cross-device matchmaking.
        if (typeof WebSocket === 'function') {
            try {
                const Socket = new WebSocket(PublicLobbyRelayWs);
                this.RelaySocket = Socket;
                Socket.onopen = () => {
                    if (this.IsSearching) {
                        this.BroadcastSeekPacket();
                    }
                };
                Socket.onmessage = (Event) => {
                    if (Event && typeof Event.data === 'string') {
                        this.HandleRelayRawJson(Event.data);
                    }
                };
            } catch (Error) {
                this.RelaySocket = null;
            }
        }

        // Connects via HTTPS EventSource as a firewall-safe fallback.
        if (typeof EventSource === 'function') {
            try {
                const Stream = new EventSource(PublicLobbyRelaySse);
                this.RelayStream = Stream;
                Stream.onmessage = (Event) => {
                    if (Event && typeof Event.data === 'string') {
                        this.HandleRelayRawJson(Event.data);
                    }
                };
            } catch (Error) {
                this.RelayStream = null;
            }
        }
    }

    // Parses an incoming ntfy.sh JSON wrapper and forwards the inner lobby packet.
    HandleRelayRawJson(RawJson) {
        // Extracts the inner message payload from the relay event wrapper.
        try {
            const Wrapper = JSON.parse(RawJson);
            if (!Wrapper) {
                return;
            }
            if (typeof Wrapper.Type === 'string') {
                this.HandleIncomingPacket(Wrapper);
                return;
            }
            if (Wrapper.event === 'message' && typeof Wrapper.message === 'string') {
                if (Wrapper.message.length > MaxLobbyPacketLength) {
                    return;
                }
                this.HandleIncomingPacket(JSON.parse(Wrapper.message));
            }
        } catch (Error) {
            return;
        }
    }

    // Starts the periodic seek heartbeat that announces presence and prunes stale seekers.
    StartSeekHeartbeat() {
        // Schedules a recurring interval to re-broadcast LobbySeek until matched.
        this.StopSeekHeartbeat();
        if (typeof setInterval !== 'function') {
            return;
        }
        this.SeekTimerId = setInterval(() => {
            if (!this.IsSearching) {
                this.StopSeekHeartbeat();
                return;
            }
            this.PruneExpiredSeekers();
            this.BroadcastSeekPacket();
        }, LobbySeekIntervalMs);
    }

    // Stops the periodic seek heartbeat timer if active.
    StopSeekHeartbeat() {
        // Clears SeekTimerId when currently scheduled.
        if (this.SeekTimerId !== null) {
            if (typeof clearInterval === 'function') {
                clearInterval(this.SeekTimerId);
            }
            this.SeekTimerId = null;
        }
    }

    // Broadcasts this player's LobbySeek ticket over all active lobby transports.
    BroadcastSeekPacket(IsReply) {
        // Publishes the local ticket when actively searching.
        if (!this.IsSearching || !this.LocalTicket) {
            return;
        }
        this.SendLobbyPacket({
            Type: 'LobbySeek',
            PlayerId: this.LocalTicket.PlayerId,
            PlayerName: this.LocalTicket.PlayerName,
            PreferredColor: this.LocalTicket.PreferredColor,
            TimeSeconds: this.LocalTicket.TimeSeconds,
            IncrementSeconds: this.LocalTicket.IncrementSeconds,
            IsReply: Boolean(IsReply),
            SentAt: Date.now()
        });
    }

    // Sends a lobby control packet across BroadcastChannel, localStorage, and HTTPS relay.
    SendLobbyPacket(Packet) {
        // Dispatches Packet to all available transports without blocking.
        if (this.Broadcast) {
            try {
                this.Broadcast.postMessage(Packet);
            } catch (Error) {
                // Ignores closed BroadcastChannel errors.
            }
        }
        if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
            try {
                localStorage.setItem(PublicLobbyStorageKey, JSON.stringify(Packet));
            } catch (Error) {
                // Ignores storage quota errors.
            }
        }
        if (typeof fetch === 'function') {
            try {
                fetch(PublicLobbyRelayHttp, {
                    method: 'POST',
                    body: JSON.stringify(Packet)
                }).catch(() => {});
            } catch (Error) {
                // Ignores offline fetch errors.
            }
        }
    }

    // Processes incoming LobbySeek, LobbyLeave, and LobbyMatch packets.
    HandleIncomingPacket(Packet) {
        // Ignores invalid packets or packets received when not searching.
        if (!this.IsSearching || !this.LocalTicket || !Packet || typeof Packet.Type !== 'string') {
            return;
        }

        // Handles direct match assignment when another player paired with us as Host.
        if (Packet.Type === 'LobbyMatch' && Packet.GuestId === this.PlayerId && typeof Packet.RoomCode === 'string') {
            this.IsSearching = false;
            this.TeardownTransports();
            this.EmitEvent({
                Type: 'MatchFound',
                Role: 'guest',
                RoomCode: Packet.RoomCode,
                Color: Packet.GuestColor === 'w' ? 'w' : 'b',
                OpponentName: this.SanitizeName(Packet.HostName) || 'Opponent',
                TimeSeconds: Number(Packet.TimeSeconds) || Zero,
                IncrementSeconds: Number(Packet.IncrementSeconds) || Zero
            });
            return;
        }

        // Removes a departed seeker from the live queue count.
        if (Packet.Type === 'LobbyLeave' && typeof Packet.PlayerId === 'string') {
            delete this.SeenSeekers[Packet.PlayerId];
            this.EmitQueueCountStatus();
            return;
        }

        // Handles another player's LobbySeek and deterministically pairs when our ID is smaller.
        if (Packet.Type === 'LobbySeek' && typeof Packet.PlayerId === 'string' && Packet.PlayerId !== this.PlayerId) {
            this.SeenSeekers[Packet.PlayerId] = Date.now();
            this.EmitQueueCountStatus();
            if (this.PlayerId < Packet.PlayerId) {
                this.InitiateMatchAsHost(Packet);
            } else if (!Packet.IsReply) {
                this.BroadcastSeekPacket(true);
            }
        }
    }

    // Creates a room code, broadcasts LobbyMatch to the guest, and starts as room host.
    InitiateMatchAsHost(GuestPacket) {
        // Assigns colors and room code, notifies the guest, and transitions into the match.
        const RoomCode = this.GenerateId(RoomCodeLength);
        const Colors = this.AssignMatchColors(this.LocalTicket.PreferredColor, GuestPacket.PreferredColor);
        const AgreedTime = this.LocalTicket.TimeSeconds;
        const AgreedIncrement = this.LocalTicket.IncrementSeconds;
        const GuestName = this.SanitizeName(GuestPacket.PlayerName) || 'Opponent';
        this.SendLobbyPacket({
            Type: 'LobbyMatch',
            HostId: this.PlayerId,
            GuestId: GuestPacket.PlayerId,
            RoomCode: RoomCode,
            HostColor: Colors.FirstColor,
            GuestColor: Colors.SecondColor,
            HostName: this.LocalTicket.PlayerName,
            GuestName: GuestName,
            TimeSeconds: AgreedTime,
            IncrementSeconds: AgreedIncrement
        });
        this.IsSearching = false;
        this.TeardownTransports();
        this.EmitEvent({
            Type: 'MatchFound',
            Role: 'host',
            RoomCode: RoomCode,
            Color: Colors.FirstColor,
            OpponentName: GuestName,
            TimeSeconds: AgreedTime,
            IncrementSeconds: AgreedIncrement
        });
    }

    // Assigns White and Black to two matched players, honoring opposite preferences or flipping a coin.
    AssignMatchColors(FirstPref, SecondPref) {
        // Honors opposite preferences; otherwise flips a fair coin.
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

    // Removes expired remote seekers from SeenSeekers and refreshes the status counter.
    PruneExpiredSeekers() {
        // Drops any seeker who has not sent a heartbeat within LobbySeekerTtlMs.
        const Now = Date.now();
        const Keys = Object.keys(this.SeenSeekers);
        for (let Index = Zero; Index < Keys.length; Index += One) {
            const Key = Keys[Index];
            if (Now - this.SeenSeekers[Key] > LobbySeekerTtlMs) {
                delete this.SeenSeekers[Key];
            }
        }
        this.EmitQueueCountStatus();
    }

    // Emits a live queue count message for the UI status box.
    EmitQueueCountStatus() {
        // Counts this player plus all active remote seekers.
        if (!this.IsSearching) {
            return;
        }
        const Total = One + Object.keys(this.SeenSeekers).length;
        const Label = Total === One ? '1 player in queue' : `${Total} players in queue`;
        this.EmitEvent({
            Type: 'LobbyStatus',
            Message: `Searching for a random opponent... (${Label})`
        });
    }

    // Leaves the public matchmaking queue and closes all active transports and timers.
    LeaveQueue() {
        // Announces departure if currently searching, then tears down transports.
        if (this.IsSearching && this.LocalTicket) {
            this.SendLobbyPacket({
                Type: 'LobbyLeave',
                PlayerId: this.LocalTicket.PlayerId
            });
        }
        this.IsSearching = false;
        this.LocalTicket = null;
        this.SeenSeekers = {};
        this.TeardownTransports();
    }

    // Stops timers and closes BroadcastChannel, storage listener, WebSocket, and EventSource.
    TeardownTransports() {
        // Releases all network and local listeners cleanly without leaks.
        this.StopSeekHeartbeat();
        if (this.Broadcast) {
            try {
                this.Broadcast.close();
            } catch (Error) {
                // Ignores close errors.
            }
            this.Broadcast = null;
        }
        if (this.RelaySocket) {
            try {
                this.RelaySocket.close();
            } catch (Error) {
                // Ignores socket close errors.
            }
            this.RelaySocket = null;
        }
        if (this.RelayStream) {
            try {
                this.RelayStream.close();
            } catch (Error) {
                // Ignores stream close errors.
            }
            this.RelayStream = null;
        }
        if (this.StorageListener && typeof window !== 'undefined' && window.removeEventListener) {
            window.removeEventListener('storage', this.StorageListener);
            this.StorageListener = null;
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
