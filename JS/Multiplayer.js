// Defines constants for room code generation, encryption, and peer channel naming.
const RoomCodeLength = Six;
const RoomAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ3579';
const ChannelPrefix = 'DlChaturangaRoom_';
const PeerPrefix = 'dl-chaturanga-room-';
const StorageKeyPrefix = 'DlChaturangaMsg_';
const SenderIdLength = Nine;
const NonceLength = 15;
const BlindedHashLength = 15;
const MaxNameLength = 25;
const MaxEnvelopeLength = 1500;
const MaxProcessedIds = 500;
const CipherRounds = 17;
const ByteMask = 255;
const WordMask = 2147483647;
const HashSeedOne = 1315423911;
const HashSeedTwo = 2654435761;
const HashMultiplier = 16777619;
const ShiftFive = Five;
const ShiftSeven = Seven;
const ShiftEleven = 11;
const ShiftThirteen = 13;
const HexRadix = Eight + Eight;
const HexPadThreshold = Eight + Eight;

// Manages encrypted multiplayer synchronization, blinded room IDs, and peer locking.
class MultiplayerManager {
    Initialize(OnEventCallback) {
        // Stores the event handler callback and initializes connection and security state.
        this.OnEventCallback = OnEventCallback;
        this.RoomCode = '';
        this.BlindedRoomId = '';
        this.SenderId = this.GenerateRandomId(SenderIdLength);
        this.SequenceNumber = Zero;
        this.AuthorizedPeerId = '';
        this.LastPeerSequence = Zero;
        this.ProcessedIds = {};
        this.ProcessedCount = Zero;
        this.IsHost = false;
        this.MatchStarted = false;
        this.HostColor = 'w';
        this.AssignedColor = 'w';
        this.LocalName = '';
        this.Broadcast = null;
        this.PeerInstance = null;
        this.PeerConnection = null;
        this.StorageListener = null;
    }

    // Generates a cryptographically random alphanumeric identifier of the requested length.
    GenerateRandomId(Length) {
        // Uses window.crypto.getRandomValues when available, falling back to Math.random.
        let Output = '';
        const HasCrypto = typeof window !== 'undefined' && window.crypto && typeof window.crypto.getRandomValues === 'function';
        if (HasCrypto) {
            const RandomWords = new Uint32Array(Length);
            window.crypto.getRandomValues(RandomWords);
            for (let Index = Zero; Index < Length; Index += One) {
                const Pick = RandomWords[Index] % RoomAlphabet.length;
                Output += RoomAlphabet[Pick];
            }
            return Output;
        }

        // Falls back to Math.random in non-browser test environments without Web Crypto.
        for (let Index = Zero; Index < Length; Index += One) {
            const RandomIndex = Math.floor(Math.random() * RoomAlphabet.length);
            Output += RoomAlphabet[RandomIndex];
        }
        return Output;
    }

    // Sanitizes a player display name by stripping HTML/control characters and clamping length.
    SanitizePlayerName(RawName) {
        // Removes dangerous markup characters and trims to MaxNameLength.
        const Cleaned = String(RawName || '')
            .replace(/[<>"'`&]/g, '')
            .replace(/[\u0000-\u001F\u007F]/g, '')
            .trim();
        return Cleaned.slice(Zero, MaxNameLength);
    }

    // Mixes a secret string and salt into a 31-bit key word over CipherRounds rounds.
    DeriveKeyWord(SecretText, SaltText) {
        // Initializes two mixing accumulators from the seed constants.
        const Combined = `${SecretText}:${SaltText}`;
        let StateA = HashSeedOne & WordMask;
        let StateB = HashSeedTwo & WordMask;

        // Absorbs every character code and applies ARX mixing rounds.
        for (let Round = Zero; Round < CipherRounds; Round += One) {
            for (let Index = Zero; Index < Combined.length; Index += One) {
                const Code = Combined.charCodeAt(Index) & ByteMask;
                StateA = ((StateA ^ Code) + ((StateA << ShiftFive) & WordMask) + StateB) & WordMask;
                StateB = ((StateB ^ StateA) + ((StateB >> ShiftSeven) & WordMask) + Code + Round) & WordMask;
            }
        }
        return (StateA ^ StateB) & WordMask;
    }

    // Derives an irreversible blinded room identifier so the raw RoomCode is never exposed.
    DeriveBlindedRoomId(RoomCode) {
        // Generates a fixed-length alphanumeric token from two independent key words.
        let WordA = this.DeriveKeyWord(RoomCode, 'ValexBlindChannelA_v1');
        let WordB = this.DeriveKeyWord(RoomCode, 'ValexBlindChannelB_v1');
        let Token = '';
        for (let Index = Zero; Index < BlindedHashLength; Index += One) {
            WordA = ((WordA + HashSeedOne) ^ (WordB << ShiftFive)) & WordMask;
            WordB = ((WordB + HashMultiplier) ^ (WordA >> ShiftSeven)) & WordMask;
            const CharIndex = Math.abs(WordA ^ WordB) % RoomAlphabet.length;
            Token += RoomAlphabet[CharIndex];
        }
        return Token;
    }

    // Computes a per-byte keystream value from two 31-bit key states and the byte position.
    ComputeKeystreamByte(KeyWordA, KeyWordB, ByteIndex) {
        // Mixes the byte index with both key words using shifts and XOR operations.
        let MixA = (KeyWordA ^ ((ByteIndex + One) * HashMultiplier)) & WordMask;
        let MixB = (KeyWordB + ((ByteIndex + CipherRounds) * HashSeedOne)) & WordMask;
        MixA = (MixA ^ (MixA << ShiftEleven) ^ (MixB >> ShiftFive)) & WordMask;
        MixB = (MixB ^ (MixB >> ShiftSeven) ^ (MixA << ShiftFive)) & WordMask;
        return (MixA ^ MixB ^ (MixA >> ShiftThirteen)) & ByteMask;
    }

    // Computes a hexadecimal message authentication tag (MAC) over Iv and CipherText.
    ComputeAuthTag(RoomCode, IvText, CipherText) {
        // Derives two independent MAC key words and folds the ciphertext into them.
        let MacA = this.DeriveKeyWord(RoomCode, `ValexMacA:${IvText}`);
        let MacB = this.DeriveKeyWord(RoomCode, `ValexMacB:${IvText}`);
        const Message = `${IvText}:${CipherText}`;
        for (let Index = Zero; Index < Message.length; Index += One) {
            const Code = Message.charCodeAt(Index) & ByteMask;
            MacA = ((MacA + Code + Index) ^ ((MacA << ShiftFive) & WordMask)) & WordMask;
            MacB = ((MacB ^ Code) + ((MacB >> ShiftSeven) & WordMask) + MacA) & WordMask;
        }
        const HexA = MacA.toString(HexRadix).toUpperCase();
        const HexB = MacB.toString(HexRadix).toUpperCase();
        return `${HexA}_${HexB}`;
    }

    // Compares two strings in constant time to prevent timing side-channel attacks.
    ConstantTimeEquals(StringA, StringB) {
        // Rejects immediately if types or lengths differ, then XORs all character codes.
        if (typeof StringA !== 'string' || typeof StringB !== 'string') {
            return false;
        }
        if (StringA.length !== StringB.length) {
            return false;
        }
        let Difference = Zero;
        for (let Index = Zero; Index < StringA.length; Index += One) {
            Difference |= (StringA.charCodeAt(Index) ^ StringB.charCodeAt(Index));
        }
        return Difference === Zero;
    }

    // Encrypts and authenticates a JSON payload object using the shared RoomCode secret.
    EncryptEnvelope(PlainObject) {
        // Encodes the payload to URI-safe ASCII and derives per-nonce encryption keys.
        const IvText = this.GenerateRandomId(NonceLength);
        const AsciiPlain = encodeURIComponent(JSON.stringify(PlainObject));
        const KeyWordA = this.DeriveKeyWord(this.RoomCode, `ValexEncA:${IvText}`);
        const KeyWordB = this.DeriveKeyWord(this.RoomCode, `ValexEncB:${IvText}`);

        // XORs each byte with the keystream and encodes to uppercase hexadecimal.
        let CipherText = '';
        for (let Index = Zero; Index < AsciiPlain.length; Index += One) {
            const PlainByte = AsciiPlain.charCodeAt(Index) & ByteMask;
            const KeyByte = this.ComputeKeystreamByte(KeyWordA, KeyWordB, Index);
            const CipherByte = (PlainByte ^ KeyByte) & ByteMask;
            const HexPair = (CipherByte < HexPadThreshold ? '0' : '') + CipherByte.toString(HexRadix).toUpperCase();
            CipherText += HexPair;
        }

        // Attaches the Encrypt-then-MAC authentication tag.
        const AuthTag = this.ComputeAuthTag(this.RoomCode, IvText, CipherText);
        return {
            Sealed: true,
            Iv: IvText,
            CipherText: CipherText,
            AuthTag: AuthTag
        };
    }

    // Verifies the authentication tag and decrypts a sealed envelope using RoomCode.
    DecryptEnvelope(Packet) {
        // Validates envelope structure, field types, and maximum size bounds.
        if (!Packet || Packet.Sealed !== true || !this.RoomCode) {
            return null;
        }
        if (typeof Packet.Iv !== 'string' || typeof Packet.CipherText !== 'string' || typeof Packet.AuthTag !== 'string') {
            return null;
        }
        if (Packet.CipherText.length === Zero || Packet.CipherText.length > MaxEnvelopeLength || (Packet.CipherText.length % Two) !== Zero) {
            return null;
        }

        // Verifies the MAC tag in constant time before attempting decryption.
        const ExpectedTag = this.ComputeAuthTag(this.RoomCode, Packet.Iv, Packet.CipherText);
        if (!this.ConstantTimeEquals(ExpectedTag, Packet.AuthTag)) {
            return null;
        }

        // Decrypts each hexadecimal byte pair using the derived per-nonce keystream.
        const KeyWordA = this.DeriveKeyWord(this.RoomCode, `ValexEncA:${Packet.Iv}`);
        const KeyWordB = this.DeriveKeyWord(this.RoomCode, `ValexEncB:${Packet.Iv}`);
        let AsciiPlain = '';
        let ByteIndex = Zero;
        for (let Cursor = Zero; Cursor < Packet.CipherText.length; Cursor += Two) {
            const HexPair = Packet.CipherText.slice(Cursor, Cursor + Two);
            const CipherByte = parseInt(HexPair, HexRadix);
            if (Number.isNaN(CipherByte)) {
                return null;
            }
            const KeyByte = this.ComputeKeystreamByte(KeyWordA, KeyWordB, ByteIndex);
            const PlainByte = (CipherByte ^ KeyByte) & ByteMask;
            AsciiPlain += String.fromCharCode(PlainByte);
            ByteIndex += One;
        }

        // Parses and returns the decrypted JSON object.
        try {
            return JSON.parse(decodeURIComponent(AsciiPlain));
        } catch (Error) {
            return null;
        }
    }

    // Generates a random six-character uppercase room code.
    GenerateRoomCode() {
        // Delegates to GenerateRandomId with RoomCodeLength.
        return this.GenerateRandomId(RoomCodeLength);
    }

    // Builds a shareable URL containing the room code query parameter.
    BuildShareLink(RoomCode) {
        // Combines the current page origin and path with the ?Room= query parameter.
        if (!window.location || !window.location.href) {
            return `?Room=${RoomCode}`;
        }
        const BaseUrl = window.location.href.split('?')[Zero].split('#')[Zero];
        return `${BaseUrl}?Room=${RoomCode}`;
    }

    // Extracts a normalized room code from a raw code string or a full shareable URL.
    ExtractRoomCode(InputText) {
        // Trims whitespace and checks whether the input contains a Room= parameter.
        const Trimmed = String(InputText || '').trim();
        if (Trimmed === '') {
            return '';
        }
        const Lower = Trimmed.toLowerCase();
        const MarkerIndex = Lower.indexOf('room=');
        let Candidate = Trimmed;
        if (MarkerIndex >= Zero) {
            const Tail = Trimmed.slice(MarkerIndex + Five);
            Candidate = Tail.split('&')[Zero].split('#')[Zero].trim();
        }
        return Candidate.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(Zero, SenderIdLength);
    }

    // Reads the ?Room= query parameter from the browser's current URL if present.
    GetRoomFromUrl() {
        // Parses window.location.search or window.location.href for a Room parameter.
        if (!window.location) {
            return '';
        }
        if (window.location.search && window.location.search.toLowerCase().includes('room=')) {
            return this.ExtractRoomCode(window.location.search);
        }
        if (window.location.href && window.location.href.toLowerCase().includes('room=')) {
            return this.ExtractRoomCode(window.location.href);
        }
        return '';
    }

    // Creates and hosts a new multiplayer room with the host playing HostColor.
    CreateRoom(HostColor, HostName) {
        // Cleans up any previous session and initializes a new room code and blinded ID.
        this.Disconnect();
        this.RoomCode = this.GenerateRoomCode();
        this.BlindedRoomId = this.DeriveBlindedRoomId(this.RoomCode);
        this.IsHost = true;
        this.MatchStarted = false;
        this.HostColor = HostColor === 'b' ? 'b' : 'w';
        this.AssignedColor = this.HostColor;
        this.LocalName = this.SanitizePlayerName(HostName);

        // Opens local BroadcastChannel/storage transport and WebRTC host peer using blinded ID.
        this.OpenLocalTransport(this.BlindedRoomId);
        this.OpenHostPeer(this.BlindedRoomId);
        return {
            RoomCode: this.RoomCode,
            ShareLink: this.BuildShareLink(this.RoomCode),
            Color: this.AssignedColor
        };
    }

    // Joins an existing multiplayer room using a room code or shareable link.
    JoinRoom(CodeOrLink, GuestName) {
        // Normalizes the room code and resets any prior connection.
        const ParsedCode = this.ExtractRoomCode(CodeOrLink);
        if (ParsedCode === '') {
            return null;
        }
        this.Disconnect();
        this.RoomCode = ParsedCode;
        this.BlindedRoomId = this.DeriveBlindedRoomId(this.RoomCode);
        this.IsHost = false;
        this.MatchStarted = false;
        this.AssignedColor = 'b';
        this.LocalName = this.SanitizePlayerName(GuestName);

        // Opens local BroadcastChannel/storage transport and announces encrypted join request.
        this.OpenLocalTransport(this.BlindedRoomId);
        this.SendPayload({
            Type: 'JoinRequest',
            GuestName: this.LocalName
        });
        this.OpenClientPeer(this.BlindedRoomId);
        return {
            RoomCode: this.RoomCode,
            ShareLink: this.BuildShareLink(this.RoomCode)
        };
    }

    // Opens a BroadcastChannel and localStorage listener keyed by the blinded room ID.
    OpenLocalTransport(BlindedId) {
        // Attaches a BroadcastChannel when supported by the browser environment.
        const ChannelName = ChannelPrefix + BlindedId;
        if (typeof BroadcastChannel !== 'undefined') {
            this.Broadcast = new BroadcastChannel(ChannelName);
            this.Broadcast.onmessage = (Event) => {
                if (Event && Event.data) {
                    this.HandleIncomingPayload(Event.data);
                }
            };
        }

        // Attaches a window storage listener as a fallback cross-tab transport.
        if (window.addEventListener) {
            this.StorageListener = (Event) => {
                if (Event && Event.key === StorageKeyPrefix + BlindedId && Event.newValue) {
                    if (Event.newValue.length > MaxEnvelopeLength) {
                        return;
                    }
                    try {
                        const Parsed = JSON.parse(Event.newValue);
                        this.HandleIncomingPayload(Parsed);
                    } catch (Error) {
                        return;
                    }
                }
            };
            window.addEventListener('storage', this.StorageListener);
        }
    }

    // Initializes a PeerJS host endpoint using the blinded ID and enforces single-peer lock.
    OpenHostPeer(BlindedId) {
        // Skips WebRTC initialization if PeerJS is not loaded in the current environment.
        if (typeof window.Peer !== 'function') {
            return;
        }
        try {
            this.PeerInstance = new window.Peer(PeerPrefix + BlindedId, { secure: true });
            this.PeerInstance.on('connection', (Connection) => {
                if (this.MatchStarted || (this.PeerConnection && this.PeerConnection.open)) {
                    if (Connection && Connection.close) {
                        Connection.close();
                    }
                    return;
                }
                this.PeerConnection = Connection;
                this.BindPeerConnection(Connection);
            });
        } catch (Error) {
            this.PeerInstance = null;
        }
    }

    // Connects to a PeerJS host endpoint for cross-device WebRTC multiplayer.
    OpenClientPeer(BlindedId) {
        // Skips WebRTC initialization if PeerJS is not loaded in the current environment.
        if (typeof window.Peer !== 'function') {
            return;
        }
        try {
            this.PeerInstance = new window.Peer({ secure: true });
            this.PeerInstance.on('open', () => {
                const Connection = this.PeerInstance.connect(PeerPrefix + BlindedId, { reliable: true });
                this.PeerConnection = Connection;
                this.BindPeerConnection(Connection);
            });
        } catch (Error) {
            this.PeerInstance = null;
        }
    }

    // Binds data and open listeners on an active PeerJS WebRTC data connection.
    BindPeerConnection(Connection) {
        // Sends encrypted JoinRequest when client connection opens and forwards received packets.
        if (!Connection || !Connection.on) {
            return;
        }
        Connection.on('open', () => {
            if (!this.IsHost && !this.MatchStarted) {
                this.SendPayload({
                    Type: 'JoinRequest',
                    GuestName: this.LocalName
                });
            }
        });
        Connection.on('data', (Data) => {
            if (Data) {
                this.HandleIncomingPayload(Data);
            }
        });
    }

    // Encrypts, authenticates, and broadcasts a payload over all active multiplayer transports.
    SendPayload(Payload) {
        // Attaches a unique MessageId, SequenceNumber, and SenderId before encrypting.
        if (!this.RoomCode || !this.BlindedRoomId) {
            return;
        }
        this.SequenceNumber += One;
        const MessageId = `${this.SenderId}_${this.SequenceNumber}_${this.GenerateRandomId(Five)}`;
        const PlainEnvelope = Object.assign({}, Payload, {
            SenderId: this.SenderId,
            SequenceNumber: this.SequenceNumber,
            MessageId: MessageId
        });
        const SealedEnvelope = this.EncryptEnvelope(PlainEnvelope);

        // Sends the encrypted envelope over BroadcastChannel, localStorage, and WebRTC.
        if (this.Broadcast) {
            this.Broadcast.postMessage(SealedEnvelope);
        }
        if (typeof localStorage !== 'undefined' && this.BlindedRoomId !== '') {
            try {
                const StorageKey = StorageKeyPrefix + this.BlindedRoomId;
                localStorage.setItem(StorageKey, JSON.stringify(SealedEnvelope));
                if (typeof localStorage.removeItem === 'function') {
                    localStorage.removeItem(StorageKey);
                }
            } catch (Error) {
                // Ignores storage quota errors in restricted environments.
            }
        }
        if (this.PeerConnection && this.PeerConnection.open) {
            this.PeerConnection.send(SealedEnvelope);
        }
    }

    // Decrypts, authenticates, and processes an incoming packet once, enforcing peer lock.
    HandleIncomingPayload(RawPacket) {
        // Decrypts and authenticates the sealed envelope using the room secret.
        const Payload = this.DecryptEnvelope(RawPacket);
        if (!Payload || typeof Payload.Type !== 'string' || typeof Payload.SenderId !== 'string') {
            return;
        }
        if (Payload.SenderId === this.SenderId) {
            return;
        }

        // Enforces deduplication and bounded memory cache for ProcessedIds.
        if (typeof Payload.MessageId !== 'string' || Payload.MessageId === '') {
            return;
        }
        if (this.ProcessedIds[Payload.MessageId]) {
            return;
        }
        if (this.ProcessedCount >= MaxProcessedIds) {
            this.ProcessedIds = {};
            this.ProcessedCount = Zero;
        }
        this.ProcessedIds[Payload.MessageId] = true;
        this.ProcessedCount += One;

        // Enforces peer locking and monotonic sequence numbers once an opponent is bound.
        if (this.AuthorizedPeerId !== '' && Payload.SenderId !== this.AuthorizedPeerId) {
            return;
        }
        if (typeof Payload.SequenceNumber === 'number') {
            if (this.AuthorizedPeerId !== '' && Payload.SequenceNumber <= this.LastPeerSequence) {
                return;
            }
        }

        // Handles JoinRequest on the host by locking the guest peer and replying with GameStart.
        if (Payload.Type === 'JoinRequest' && this.IsHost) {
            if (this.MatchStarted && this.AuthorizedPeerId !== Payload.SenderId) {
                return;
            }
            this.AuthorizedPeerId = Payload.SenderId;
            if (typeof Payload.SequenceNumber === 'number') {
                this.LastPeerSequence = Payload.SequenceNumber;
            }
            const GuestColor = this.HostColor === 'w' ? 'b' : 'w';
            const OpponentName = this.SanitizePlayerName(Payload.GuestName) || 'Opponent';
            this.SendPayload({
                Type: 'GameStart',
                HostColor: this.HostColor,
                GuestColor: GuestColor,
                HostName: this.LocalName || 'Opponent',
                GuestName: OpponentName
            });
            if (!this.MatchStarted && this.OnEventCallback) {
                this.MatchStarted = true;
                this.OnEventCallback({
                    Type: 'OpponentJoined',
                    Color: this.HostColor,
                    OpponentName: OpponentName
                });
            }
            return;
        }

        // Handles GameStart on the guest by locking the host peer and notifying controller.
        if (Payload.Type === 'GameStart' && !this.IsHost) {
            if (this.MatchStarted) {
                return;
            }
            this.AuthorizedPeerId = Payload.SenderId;
            if (typeof Payload.SequenceNumber === 'number') {
                this.LastPeerSequence = Payload.SequenceNumber;
            }
            this.MatchStarted = true;
            this.AssignedColor = Payload.GuestColor === 'w' ? 'w' : 'b';
            const OpponentName = this.SanitizePlayerName(Payload.HostName) || 'Opponent';
            if (this.OnEventCallback) {
                this.OnEventCallback({
                    Type: 'JoinedRoom',
                    Color: this.AssignedColor,
                    OpponentName: OpponentName
                });
            }
            return;
        }

        // Rejects any gameplay event received before the peer handshake has locked an opponent.
        if (!this.MatchStarted || this.AuthorizedPeerId === '' || Payload.SenderId !== this.AuthorizedPeerId) {
            return;
        }
        if (typeof Payload.SequenceNumber === 'number') {
            this.LastPeerSequence = Payload.SequenceNumber;
        }
        if (this.OnEventCallback) {
            this.OnEventCallback(Payload);
        }
    }

    // Closes all active channels, listeners, and peer connections and scrubs storage.
    Disconnect() {
        // Closes BroadcastChannel, removes storage keys and listener, and destroys PeerJS.
        if (typeof localStorage !== 'undefined' && this.BlindedRoomId !== '' && typeof localStorage.removeItem === 'function') {
            try {
                localStorage.removeItem(StorageKeyPrefix + this.BlindedRoomId);
            } catch (Error) {
                // Ignores storage errors on cleanup.
            }
        }
        if (this.Broadcast) {
            this.Broadcast.close();
            this.Broadcast = null;
        }
        if (this.StorageListener && window.removeEventListener) {
            window.removeEventListener('storage', this.StorageListener);
            this.StorageListener = null;
        }
        if (this.PeerConnection) {
            this.PeerConnection.close();
            this.PeerConnection = null;
        }
        if (this.PeerInstance) {
            this.PeerInstance.destroy();
            this.PeerInstance = null;
        }
        this.RoomCode = '';
        this.BlindedRoomId = '';
        this.AuthorizedPeerId = '';
        this.LastPeerSequence = Zero;
        this.MatchStarted = false;
        this.ProcessedIds = {};
        this.ProcessedCount = Zero;
    }
}
