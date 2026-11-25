// Defines physical constants for spring-mass-damper motion, gravity, and particle bursts.
const PhysicsStepMaxSec = 0.05;
const PhysicsMsPerSec = 1000;
const SpringStiffness = 290;
const SpringDamping = 21;
const SpringTiltFactor = 0.015;
const SpringMaxTiltDeg = 15;
const SpringSettlePos = 0.5;
const SpringSettleVel = 5;
const ParticleGravity = 650;
const ParticleDrag = 0.99;
const ParticleBounce = 0.55;
const CaptureParticleCount = 15;
const CheckParticleCount = 19;
const VictoryParticleCount = 55;
const MovePuffCount = 5;
const CaptureSpeedMin = 90;
const CaptureSpeedRange = 190;
const CheckSpeedMin = 130;
const CheckSpeedRange = 230;
const VictorySpeedMin = 250;
const VictorySpeedRange = 350;
const MovePuffSpeed = 75;
const ParticleSizeMin = 3;
const ParticleSizeRange = 5;
const ParticleLifeMin = 0.45;
const ParticleLifeRange = 0.45;
const VictoryLifeMin = 1.35;
const VictoryLifeRange = 0.95;
const ShockwaveMaxRadius = 85;
const ShockwaveDuration = 0.45;
const ShockwaveLineWidth = 3;
const FullCircleTurns = 6.29;
const HalfUnit = 0.5;
const SpinSpeedRange = 11;
const VictoryLaunchY = 0.85;
const VictorySpreadAngle = 1.15;
const VictoryUpwardOffset = 1.57;
const CapturePalette = ['#e5b545', '#059bfa', '#f5f3ef'];
const CheckPalette = ['#f55559', '#ff8565', '#f5f3ef'];
const VictoryPalette = ['#e5b545', '#059bfa', '#f5d979', '#45b5ff', '#f5f3ef'];
const MovePuffPalette = ['#e5b545', '#b5c5b9'];

// Runs a 2D spring-mass-damper and gravity-particle physics simulation for the board.
class PhysicsEngine {
    Initialize() {
        // Initializes particle, shockwave, and active spring-flight collections.
        this.Canvas = null;
        this.Context = null;
        this.Particles = [];
        this.Shockwaves = [];
        this.Springs = [];
        this.FrameId = null;
        this.LastTimeMs = Zero;
    }

    // Attaches the board overlay canvas used to render physical particles and shockwaves.
    AttachCanvas(CanvasElement) {
        // Stores the canvas reference, 2D context, and syncs backing resolution.
        this.Canvas = CanvasElement;
        if (CanvasElement && typeof CanvasElement.getContext === 'function') {
            this.Context = CanvasElement.getContext('2d');
            this.SyncCanvasSize();
        } else {
            this.Context = null;
        }
    }

    // Synchronizes the canvas pixel dimensions with its rendered CSS bounding box.
    SyncCanvasSize() {
        // Updates canvas width and height when attached to a live DOM layout.
        if (!this.Canvas || !this.Canvas.clientWidth || !this.Canvas.clientHeight) {
            return;
        }
        if (this.Canvas.width !== this.Canvas.clientWidth || this.Canvas.height !== this.Canvas.clientHeight) {
            this.Canvas.width = this.Canvas.clientWidth;
            this.Canvas.height = this.Canvas.clientHeight;
        }
    }

    // Checks whether the user prefers reduced motion in their OS or browser settings.
    PrefersReducedMotion() {
        // Queries matchMedia safely when available in the browser environment.
        if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        }
        return false;
    }

    // Launches a spring-mass-damper flight animation on a DOM piece element from an offset.
    AnimateSpringPiece(Element, StartOffsetX, StartOffsetY) {
        // Skips spring motion if reduced motion is requested or element is missing.
        if (!Element || this.PrefersReducedMotion()) {
            return;
        }
        this.Springs.push({
            Element: Element,
            X: StartOffsetX,
            Y: StartOffsetY,
            Vx: Zero,
            Vy: Zero
        });
        Element.style.transform = `translate(${StartOffsetX}px, ${StartOffsetY}px)`;
        this.EnsureLoopRunning();
    }

    // Spawns a subtle physical landing puff at normalized board coordinates (0..1, 0..1).
    BurstMovePuff(NormX, NormY) {
        // Emits lightweight particles with gentle outward velocity on normal moves.
        if (!this.Canvas || this.PrefersReducedMotion()) {
            return;
        }
        this.SyncCanvasSize();
        const OriginX = NormX * this.Canvas.width;
        const OriginY = NormY * this.Canvas.height;
        this.SpawnRadialParticles(
            OriginX,
            OriginY,
            MovePuffCount,
            MovePuffSpeed * HalfUnit,
            MovePuffSpeed,
            MovePuffPalette,
            ParticleLifeMin * HalfUnit,
            ParticleLifeRange * HalfUnit,
            'circle'
        );
        this.EnsureLoopRunning();
    }

    // Spawns an energetic shard burst and shockwave at a capture square.
    BurstCapture(NormX, NormY) {
        // Emits bouncing rectangular shards and an expanding impact ring.
        if (!this.Canvas || this.PrefersReducedMotion()) {
            return;
        }
        this.SyncCanvasSize();
        const OriginX = NormX * this.Canvas.width;
        const OriginY = NormY * this.Canvas.height;
        this.SpawnRadialParticles(
            OriginX,
            OriginY,
            CaptureParticleCount,
            CaptureSpeedMin,
            CaptureSpeedRange,
            CapturePalette,
            ParticleLifeMin,
            ParticleLifeRange,
            'rect'
        );
        this.Shockwaves.push({
            X: OriginX,
            Y: OriginY,
            Radius: ParticleSizeMin,
            MaxRadius: ShockwaveMaxRadius,
            Life: Zero,
            MaxLife: ShockwaveDuration,
            Color: CapturePalette[Zero]
        });
        this.EnsureLoopRunning();
    }

    // Spawns a crimson shockwave and spark burst at a checked king's square.
    BurstCheck(NormX, NormY) {
        // Emits high-energy red sparks and an urgent shockwave ring.
        if (!this.Canvas || this.PrefersReducedMotion()) {
            return;
        }
        this.SyncCanvasSize();
        const OriginX = NormX * this.Canvas.width;
        const OriginY = NormY * this.Canvas.height;
        this.SpawnRadialParticles(
            OriginX,
            OriginY,
            CheckParticleCount,
            CheckSpeedMin,
            CheckSpeedRange,
            CheckPalette,
            ParticleLifeMin,
            ParticleLifeRange,
            'circle'
        );
        this.Shockwaves.push({
            X: OriginX,
            Y: OriginY,
            Radius: ParticleSizeMin,
            MaxRadius: ShockwaveMaxRadius,
            Life: Zero,
            MaxLife: ShockwaveDuration,
            Color: CheckPalette[Zero]
        });
        this.EnsureLoopRunning();
    }

    // Launches a celebratory gravity-and-bounce confetti fountain across the board.
    BurstVictory() {
        // Emits upward-fountain particles that spin, fall under gravity, and bounce.
        if (!this.Canvas || this.PrefersReducedMotion()) {
            return;
        }
        this.SyncCanvasSize();
        const CenterX = this.Canvas.width * HalfUnit;
        const LaunchY = this.Canvas.height * VictoryLaunchY;
        for (let Index = Zero; Index < VictoryParticleCount; Index += One) {
            const Spread = (Math.random() - HalfUnit) * VictorySpreadAngle;
            const Angle = -VictoryUpwardOffset + Spread;
            const Speed = VictorySpeedMin + Math.random() * VictorySpeedRange;
            const Color = VictoryPalette[Index % VictoryPalette.length];
            const Life = VictoryLifeMin + Math.random() * VictoryLifeRange;
            this.Particles.push({
                X: CenterX + (Math.random() - HalfUnit) * this.Canvas.width * HalfUnit,
                Y: LaunchY,
                Vx: Math.cos(Angle) * Speed,
                Vy: Math.sin(Angle) * Speed,
                Angle: Math.random() * FullCircleTurns,
                Spin: (Math.random() - HalfUnit) * SpinSpeedRange,
                Size: ParticleSizeMin + Math.random() * ParticleSizeRange,
                Life: Zero,
                MaxLife: Life,
                Color: Color,
                Shape: 'rect'
            });
        }
        this.EnsureLoopRunning();
    }

    // Appends radial burst particles around (OriginX, OriginY) with randomized velocities.
    SpawnRadialParticles(OriginX, OriginY, Count, MinSpeed, SpeedRange, Palette, MinLife, LifeRange, Shape) {
        // Creates Count physical particles distributed across 360 degrees.
        for (let Index = Zero; Index < Count; Index += One) {
            const Angle = Math.random() * FullCircleTurns;
            const Speed = MinSpeed + Math.random() * SpeedRange;
            const Color = Palette[Index % Palette.length];
            this.Particles.push({
                X: OriginX,
                Y: OriginY,
                Vx: Math.cos(Angle) * Speed,
                Vy: Math.sin(Angle) * Speed - MinSpeed * HalfUnit,
                Angle: Math.random() * FullCircleTurns,
                Spin: (Math.random() - HalfUnit) * SpinSpeedRange,
                Size: ParticleSizeMin + Math.random() * ParticleSizeRange,
                Life: Zero,
                MaxLife: MinLife + Math.random() * LifeRange,
                Color: Color,
                Shape: Shape
            });
        }
    }

    // Starts the requestAnimationFrame simulation loop if not already running.
    EnsureLoopRunning() {
        // Schedules StepFrame when requestAnimationFrame is available.
        if (this.FrameId !== null || typeof requestAnimationFrame !== 'function') {
            return;
        }
        this.LastTimeMs = Zero;
        this.FrameId = requestAnimationFrame((Timestamp) => this.StepFrame(Timestamp));
    }

    // Advances springs, particles, and shockwaves by one frame and draws to canvas.
    StepFrame(Timestamp) {
        // Computes clamped delta time in seconds for simulation stability.
        this.FrameId = null;
        const RawDt = this.LastTimeMs > Zero ? (Timestamp - this.LastTimeMs) / PhysicsMsPerSec : PhysicsStepMaxSec * HalfUnit;
        const Dt = Math.min(PhysicsStepMaxSec, Math.max(Zero, RawDt));
        this.LastTimeMs = Timestamp;

        // Integrates spring-mass-damper piece flights and particle physics.
        this.UpdateSprings(Dt);
        this.UpdateParticles(Dt);
        this.UpdateShockwaves(Dt);
        this.DrawOverlay();

        // Continues animating only while at least one physical entity remains active.
        if (this.Springs.length > Zero || this.Particles.length > Zero || this.Shockwaves.length > Zero) {
            this.FrameId = requestAnimationFrame((NextTime) => this.StepFrame(NextTime));
        }
    }

    // Integrates Hooke's law spring-damper dynamics for flying chess pieces.
    UpdateSprings(Dt) {
        // Steps each active spring and clears transform once settled at target (0, 0).
        const Remaining = [];
        for (let Index = Zero; Index < this.Springs.length; Index += One) {
            const Item = this.Springs[Index];
            if (!Item.Element || !Item.Element.isConnected) {
                continue;
            }
            const AccX = -SpringStiffness * Item.X - SpringDamping * Item.Vx;
            const AccY = -SpringStiffness * Item.Y - SpringDamping * Item.Vy;
            Item.Vx += AccX * Dt;
            Item.Vy += AccY * Dt;
            Item.X += Item.Vx * Dt;
            Item.Y += Item.Vy * Dt;
            const Settled = Math.abs(Item.X) < SpringSettlePos
                && Math.abs(Item.Y) < SpringSettlePos
                && Math.abs(Item.Vx) < SpringSettleVel
                && Math.abs(Item.Vy) < SpringSettleVel;
            if (Settled) {
                Item.Element.style.transform = '';
                continue;
            }
            const RawTilt = Item.Vx * SpringTiltFactor;
            const Tilt = Math.max(-SpringMaxTiltDeg, Math.min(SpringMaxTiltDeg, RawTilt));
            Item.Element.style.transform = `translate(${Item.X}px, ${Item.Y}px) rotate(${Tilt}deg)`;
            Remaining.push(Item);
        }
        this.Springs = Remaining;
    }

    // Integrates velocity, gravity, drag, and wall/floor bounces for active particles.
    UpdateParticles(Dt) {
        // Updates every particle and removes expired particles cleanly.
        const Width = this.Canvas ? this.Canvas.width : Zero;
        const Height = this.Canvas ? this.Canvas.height : Zero;
        const Remaining = [];
        for (let Index = Zero; Index < this.Particles.length; Index += One) {
            const Body = this.Particles[Index];
            Body.Life += Dt;
            if (Body.Life >= Body.MaxLife) {
                continue;
            }
            Body.Vy += ParticleGravity * Dt;
            Body.Vx *= ParticleDrag;
            Body.Vy *= ParticleDrag;
            Body.X += Body.Vx * Dt;
            Body.Y += Body.Vy * Dt;
            Body.Angle += Body.Spin * Dt;
            if (Height > Zero && Body.Y > Height - Body.Size) {
                Body.Y = Height - Body.Size;
                Body.Vy = -Math.abs(Body.Vy) * ParticleBounce;
            }
            if (Width > Zero && Body.X < Body.Size) {
                Body.X = Body.Size;
                Body.Vx = Math.abs(Body.Vx) * ParticleBounce;
            } else if (Width > Zero && Body.X > Width - Body.Size) {
                Body.X = Width - Body.Size;
                Body.Vx = -Math.abs(Body.Vx) * ParticleBounce;
            }
            Remaining.push(Body);
        }
        this.Particles = Remaining;
    }

    // Advances expanding shockwave rings and prunes completed ones.
    UpdateShockwaves(Dt) {
        // Interpolates shockwave radius over MaxLife.
        const Remaining = [];
        for (let Index = Zero; Index < this.Shockwaves.length; Index += One) {
            const Wave = this.Shockwaves[Index];
            Wave.Life += Dt;
            if (Wave.Life >= Wave.MaxLife) {
                continue;
            }
            const Progress = Wave.Life / Wave.MaxLife;
            Wave.Radius = Wave.MaxRadius * Progress;
            Remaining.push(Wave);
        }
        this.Shockwaves = Remaining;
    }

    // Clears and redraws all active particles and shockwaves on the board canvas.
    DrawOverlay() {
        // Skips drawing if no 2D canvas context is attached.
        if (!this.Context || !this.Canvas) {
            return;
        }
        const Ctx = this.Context;
        Ctx.clearRect(Zero, Zero, this.Canvas.width, this.Canvas.height);

        // Renders expanding impact shockwave rings.
        for (let Index = Zero; Index < this.Shockwaves.length; Index += One) {
            const Wave = this.Shockwaves[Index];
            const Alpha = Math.max(Zero, One - Wave.Life / Wave.MaxLife);
            Ctx.save();
            Ctx.globalAlpha = Alpha;
            Ctx.strokeStyle = Wave.Color;
            Ctx.lineWidth = ShockwaveLineWidth;
            Ctx.beginPath();
            Ctx.arc(Wave.X, Wave.Y, Wave.Radius, Zero, FullCircleTurns);
            Ctx.stroke();
            Ctx.restore();
        }

        // Renders rotating rectangular shards and circular sparks.
        for (let Index = Zero; Index < this.Particles.length; Index += One) {
            const Body = this.Particles[Index];
            const Alpha = Math.max(Zero, One - Body.Life / Body.MaxLife);
            Ctx.save();
            Ctx.globalAlpha = Alpha;
            Ctx.translate(Body.X, Body.Y);
            Ctx.rotate(Body.Angle);
            Ctx.fillStyle = Body.Color;
            if (Body.Shape === 'rect') {
                const Half = Body.Size * HalfUnit;
                Ctx.fillRect(-Half, -Half, Body.Size, Body.Size);
            } else {
                Ctx.beginPath();
                Ctx.arc(Zero, Zero, Body.Size * HalfUnit, Zero, FullCircleTurns);
                Ctx.fill();
            }
            Ctx.restore();
        }
    }

    // Stops all active animations and clears particles, shockwaves, and springs.
    Reset() {
        // Cancels requestAnimationFrame and empties all simulation lists.
        if (this.FrameId !== null && typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(this.FrameId);
            this.FrameId = null;
        }
        this.Particles = [];
        this.Shockwaves = [];
        this.Springs = [];
        if (this.Context && this.Canvas) {
            this.Context.clearRect(Zero, Zero, this.Canvas.width, this.Canvas.height);
        }
    }
}
