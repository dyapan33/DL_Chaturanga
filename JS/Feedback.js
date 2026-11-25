// Defines audio synthesis frequencies, durations, gains, and mobile vibration patterns.
const AudioFloorGain = 0.001;
const MoveBaseFreq = 195;
const MoveEndFreq = 95;
const MoveClickFreq = 650;
const MoveDurationSec = 0.07;
const MoveGain = 0.25;
const CaptureBaseFreq = 155;
const CaptureEndFreq = 65;
const CaptureSnapFreq = 950;
const CaptureDurationSec = 0.11;
const CaptureGain = 0.35;
const CheckFreqOne = 590;
const CheckFreqTwo = 790;
const CheckStepSec = 0.09;
const CheckDurationSec = 0.19;
const CheckGain = 0.21;
const IllegalFreqOne = 135;
const IllegalFreqTwo = 115;
const IllegalDurationSec = 0.09;
const IllegalGain = 0.21;
const VictoryNotes = [525, 665, 790, 1050];
const DefeatNotes = [395, 335, 265];
const DrawNotes = [440, 555];
const ChordStepSec = 0.11;
const ChordDurationSec = 0.29;
const ChordGain = 0.19;
const UiTapFreq = 510;
const UiTapDurationSec = 0.03;
const UiTapGain = 0.09;
const VibrateTapMs = 10;
const VibrateMoveMs = 15;
const VibrateCaptureMs = 35;
const VibrateCheckPattern = [35, 45, 55];
const VibrateIllegalPattern = [15, 35, 15];
const VibrateVictoryPattern = [35, 55, 35, 55, 75];
const VibrateDefeatMs = 75;
const VibrateDrawMs = 35;

// Synthesizes tactile Web Audio sound effects and triggers mobile haptic vibrations.
class FeedbackManager {
    Initialize() {
        // Initializes lazy AudioContext state and enabled flag.
        this.AudioCtx = null;
        this.Enabled = true;
    }

    // Lazily creates and resumes the Web Audio API context on user interaction.
    EnsureAudioContext() {
        // Returns the active AudioContext or null if unsupported by the browser.
        if (!this.Enabled || typeof window === 'undefined') {
            return null;
        }
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (typeof Ctor !== 'function') {
            return null;
        }
        if (!this.AudioCtx) {
            try {
                this.AudioCtx = new Ctor();
            } catch (Error) {
                return null;
            }
        }
        if (this.AudioCtx && this.AudioCtx.state === 'suspended' && typeof this.AudioCtx.resume === 'function') {
            this.AudioCtx.resume().catch(() => {});
        }
        return this.AudioCtx;
    }

    // Triggers a mobile haptic vibration pattern when supported by the device.
    Vibrate(Pattern) {
        // Calls navigator.vibrate safely without throwing on desktop browsers.
        if (!this.Enabled || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
            return;
        }
        try {
            navigator.vibrate(Pattern);
        } catch (Error) {
            // Ignores vibration errors on unsupported platforms.
        }
    }

    // Schedules a single synthesized tone with pitch glide and exponential decay.
    PlayTone(StartFreq, EndFreq, DelaySec, DurationSec, PeakGain, WaveType) {
        // Builds an oscillator and gain envelope connected to the audio destination.
        const Ctx = this.EnsureAudioContext();
        if (!Ctx) {
            return;
        }
        const Now = Ctx.currentTime + (DelaySec || Zero);
        const Osc = Ctx.createOscillator();
        const Gain = Ctx.createGain();
        Osc.type = WaveType || 'triangle';
        Osc.frequency.setValueAtTime(StartFreq, Now);
        if (EndFreq && EndFreq !== StartFreq) {
            Osc.frequency.exponentialRampToValueAtTime(EndFreq, Now + DurationSec);
        }
        Gain.gain.setValueAtTime(PeakGain, Now);
        Gain.gain.exponentialRampToValueAtTime(AudioFloorGain, Now + DurationSec);
        Osc.connect(Gain);
        Gain.connect(Ctx.destination);
        Osc.start(Now);
        Osc.stop(Now + DurationSec);
    }

    // Plays a warm wooden piece-placement click and light mobile vibration.
    PlayMove() {
        // Combines a low wooden thump with a crisp short surface click.
        this.PlayTone(MoveBaseFreq, MoveEndFreq, Zero, MoveDurationSec, MoveGain, 'triangle');
        this.PlayTone(MoveClickFreq, MoveBaseFreq, Zero, UiTapDurationSec, UiTapGain, 'sine');
        this.Vibrate(VibrateMoveMs);
    }

    // Plays a punchier wooden capture impact and firmer mobile vibration.
    PlayCapture() {
        // Combines a deeper impact thud with a crisp high-frequency wood snap.
        this.PlayTone(CaptureBaseFreq, CaptureEndFreq, Zero, CaptureDurationSec, CaptureGain, 'triangle');
        this.PlayTone(CaptureSnapFreq, MoveBaseFreq, Zero, MoveDurationSec, MoveGain, 'sawtooth');
        this.Vibrate(VibrateCaptureMs);
    }

    // Plays an urgent two-tone check alert and double-pulse mobile vibration.
    PlayCheck() {
        // Triggers two ascending warning tones and an urgent haptic pattern.
        this.PlayTone(CheckFreqOne, CheckFreqOne, Zero, CheckDurationSec, CheckGain, 'triangle');
        this.PlayTone(CheckFreqTwo, CheckFreqTwo, CheckStepSec, CheckDurationSec, CheckGain, 'triangle');
        this.Vibrate(VibrateCheckPattern);
    }

    // Plays a muted friction double-bump for an illegal move drop.
    PlayIllegal() {
        // Triggers a low descending thud and short stuttered haptic buzz.
        this.PlayTone(IllegalFreqOne, IllegalFreqTwo, Zero, IllegalDurationSec, IllegalGain, 'sine');
        this.Vibrate(VibrateIllegalPattern);
    }

    // Plays an uplifting major arpeggio and celebratory triple-tap vibration on victory.
    PlayVictory() {
        // Steps through VictoryNotes with staggered harmonic chimes.
        for (let Index = Zero; Index < VictoryNotes.length; Index += One) {
            const Freq = VictoryNotes[Index];
            this.PlayTone(Freq, Freq, Index * ChordStepSec, ChordDurationSec, ChordGain, 'triangle');
        }
        this.Vibrate(VibrateVictoryPattern);
    }

    // Plays a gentle descending minor cadence and soft pulse on defeat.
    PlayDefeat() {
        // Steps through DefeatNotes for a calm closing cadence.
        for (let Index = Zero; Index < DefeatNotes.length; Index += One) {
            const Freq = DefeatNotes[Index];
            this.PlayTone(Freq, Freq, Index * ChordStepSec, ChordDurationSec, ChordGain, 'sine');
        }
        this.Vibrate(VibrateDefeatMs);
    }

    // Plays a balanced two-note harmonic chime and gentle pulse on a draw.
    PlayDraw() {
        // Steps through DrawNotes for a neutral draw cue.
        for (let Index = Zero; Index < DrawNotes.length; Index += One) {
            const Freq = DrawNotes[Index];
            this.PlayTone(Freq, Freq, Index * ChordStepSec, ChordDurationSec, ChordGain, 'sine');
        }
        this.Vibrate(VibrateDrawMs);
    }

    // Plays a subtle detent tap for move stepping or UI clicks.
    PlayUiTap() {
        // Triggers a soft high-frequency tick and light 10ms mobile pulse.
        this.PlayTone(UiTapFreq, MoveBaseFreq, Zero, UiTapDurationSec, UiTapGain, 'sine');
        this.Vibrate(VibrateTapMs);
    }
}
