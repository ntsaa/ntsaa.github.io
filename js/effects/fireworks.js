// fireworks.js
(function () {

    const fireworksEffect = {

        animationId: null,
        canvas: null,
        ctx: null,

        w: 0,
        h: 0,
        DPR: window.EffectController.DPR,

        rockets: [],
        particles: [],
        
        particlePool: null,
        rocketPool: null,
        particleCache: null,

        resizeHandler: null,
        resizeTimeout: null,
        
        MAX_PARTICLES: 1000,
        MAX_ROCKETS: 80,
        MAX_ACTIVE_ROCKETS: 12,

        lastProcessedClick: 0,
        hasShotAtCurrentMousePos: false,
        wasDown: false,

        /* ================= START ================= */

        start() {
            if (this.animationId) return;

            this.canvas = document.getElementById("network");
            if (!this.canvas) return;

            this.ctx = this.canvas.getContext("2d");
            window.EffectController.resetCanvasContext(this.ctx);

            this.particleCache = window.EffectController.getCache("fireworks", () => this.initCache());

            if (!this.particlePool) {
                this.particlePool = window.EffectController.createPool(() => ({}), null, 1200);
                this.rocketPool = window.EffectController.createPool(() => ({}), null, 50);
            }

            this.resizeHandler = () => this.resize();
            window.addEventListener("resize", this.resizeHandler);

            this.resize(true);
            this.animate();
        },

        stop() {
            if (this.animationId) { cancelAnimationFrame(this.animationId); this.animationId = null; }
            clearTimeout(this.resizeTimeout);
            window.removeEventListener("resize", this.resizeHandler);
            while (this.rockets.length) this.rocketPool.recycle(this.rockets.pop());
            while (this.particles.length) this.particlePool.recycle(this.particles.pop());
            if (this.ctx) this.ctx.clearRect(0, 0, this.w, this.h);
        },

        initCache() {
            const cache = [];
            for (let i = 0; i < 360; i += 2) {
                const canvas = document.createElement("canvas");
                canvas.width = 16; canvas.height = 16;
                const ctx = canvas.getContext("2d");
                const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
                grad.addColorStop(0, `hsl(${i}, 100%, 65%)`);
                grad.addColorStop(1, "transparent");
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, 16, 16);
                cache[i] = canvas;
                if (i + 1 < 360) cache[i+1] = canvas;
            }
            return cache;
        },

        resize(isInitial = false) {
            this.w = window.innerWidth; this.h = window.innerHeight;
            this.canvas.style.width = this.w + 'px'; this.canvas.style.height = this.h + 'px';
            this.canvas.width = Math.floor(this.w * this.DPR); this.canvas.height = Math.floor(this.h * this.DPR);
            this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);

            if (isInitial) { this.recalculateLimits(); return; }
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => this.recalculateLimits(), 500);
        },

        recalculateLimits() {
            const area = this.w * this.h;
            const perf = window.EffectController.performanceScale;
            this.MAX_PARTICLES = Math.max(200, Math.min(1000, Math.floor(area / 2000 * perf)));
            this.MAX_ROCKETS = Math.max(15, Math.min(80, Math.floor(area / 25000 * perf)));
        },

        spawnParticle(x, y, vx, vy, hue, decay = 0.01, size = 4) {
            if (this.particles.length >= this.MAX_PARTICLES) return;
            const p = this.particlePool.get();
            p.x = x; p.y = y; p.vx = vx; p.vy = vy;
            p.hue = (hue | 0) % 360; p.alpha = 1; p.decay = decay; p.size = size;
            this.particles.push(p);
        },

        explode(x, y, type) {
            const hue = (Math.random() * 360) | 0;
            const count = 80 * window.EffectController.performanceScale;
            for (let i = 0; i < count; i++) {
                const a = Math.random() * Math.PI * 2;
                const s = Math.random() * 4 + 2;
                this.spawnParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, type === 1 ? 0 : hue);
            }
        },

        spawnRocket(targetX, targetY) {
            if (this.rockets.length >= this.MAX_ACTIVE_ROCKETS) return;
            const r = this.rocketPool.get();
            r.x = this.w / 2 + (Math.random() - 0.5) * 200; r.y = this.h;
            r.prevX = r.x; r.prevY = r.y;
            const gravity = 0.015;
            const dy = targetY - this.h;
            r.vy = -Math.sqrt(-2 * gravity * dy);
            r.vx = (targetX - r.x) / (-r.vy / gravity);
            r.gravity = gravity; r.exploded = false; r.trailHue = (Math.random() * 360) | 0;
            this.rockets.push(r);
        },

        control(now) {
            const interact = window.EffectController.interaction;
            if (this.rockets.length >= this.MAX_ACTIVE_ROCKETS) return;

            // Handle Click/Touch via Controller
            if (interact.isDown && !this.wasDown && !interact.isOverUI) {
                this.spawnRocket(interact.x, interact.y);
                this.lastProcessedClick = now;
            }
            this.wasDown = interact.isDown;

            // Auto spawn
            if ((now - this.lastProcessedClick) > (400 + Math.random() * 1000)) {
                if (interact.isValid && !interact.isOverUI) {
                    this.spawnRocket(interact.x, interact.y);
                } else {
                    this.spawnRocket(Math.random() * this.w, Math.random() * this.h * 0.5);
                }
                this.lastProcessedClick = now;
            }
        },

        animate(t) {
            if (window.EffectController.shouldRender(t)) {
                this.control(t);
                this.ctx.globalCompositeOperation = "destination-out";
                this.ctx.fillStyle = "rgba(0, 0, 0, 0.2)"; this.ctx.fillRect(0, 0, this.w, this.h);
                this.ctx.globalCompositeOperation = "lighter";

                for (let i = this.rockets.length - 1; i >= 0; i--) {
                    const r = this.rockets[i];
                    r.prevX = r.x; r.prevY = r.y; r.vy += r.gravity; r.x += r.vx; r.y += r.vy;
                    this.ctx.strokeStyle = `hsla(${r.trailHue}, 100%, 70%, 0.5)`;
                    this.ctx.lineWidth = 1.5; this.ctx.beginPath();
                    this.ctx.moveTo(r.prevX, r.prevY); this.ctx.lineTo(r.x, r.y); this.ctx.stroke();
                    if (r.vy >= 0) { this.explode(r.x, r.y, Math.random() < 0.2 ? 1 : 0); this.rocketPool.recycle(this.rockets.splice(i, 1)[0]); }
                }

                for (let i = this.particles.length - 1; i >= 0; i--) {
                    const p = this.particles[i];
                    p.vy += 0.02; p.x += p.vx; p.y += p.vy; p.alpha -= p.decay;
                    if (p.alpha <= 0) { this.particlePool.recycle(this.particles.splice(i, 1)[0]); } 
                    else {
                        const sprite = this.particleCache[p.hue];
                        window.EffectController.drawSprite(this.ctx, sprite, p.x, p.y, p.size, 0, p.alpha);
                    }
                }
            }
            this.animationId = requestAnimationFrame((t) => this.animate(t));
        }
    };

    window.EffectController.register("fireworks", fireworksEffect);

})();