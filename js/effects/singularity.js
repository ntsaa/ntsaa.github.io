// singularity.js
(function () {

    const singularityEffect = {

        animationId: null,
        canvas: null,
        ctx: null,
        singularities: [], 
        absorbedPool: [],  
        
        particlePool: null,
        spriteCache: null,
        
        timeouts: [],
        resizeTimeout: null,
        running: false,
        w: 0,
        h: 0,
        DPR: window.EffectController.DPR,

        mouseRadius: 85,
        captureRadius: 12, 
        totalInitialCount: 0,
        burstCooldown: false,
        wasDown: false,

        /* ================= START ================= */

        start() {
            if (this.running) return;
            this.running = true;

            this.canvas = document.getElementById('network');
            if (!this.canvas) return;
            this.ctx = this.canvas.getContext('2d');
            window.EffectController.resetCanvasContext(this.ctx);

            this.spriteCache = window.EffectController.getCache("singularity", () => this.initCache());

            if (!this.particlePool) {
                this.particlePool = window.EffectController.createPool(() => ({}), (p) => { p.bursting = false; }, 300);
            }

            this.resizeHandler = () => this.resize();
            window.addEventListener('resize', this.resizeHandler);

            this.resize(true); 
            this.animate();
        },

        /* ================= STOP ================= */

        stop() {
            if (!this.running) return;
            this.running = false;
            cancelAnimationFrame(this.animationId);
            clearTimeout(this.resizeTimeout);
            window.removeEventListener('resize', this.resizeHandler);
            this.timeouts.forEach(t => clearTimeout(t));
            this.timeouts = [];
            if (this.ctx) this.ctx.clearRect(0, 0, this.w, this.h);
            while (this.singularities.length) this.particlePool.recycle(this.singularities.pop());
            while (this.absorbedPool.length) this.particlePool.recycle(this.absorbedPool.pop());
            this.burstCooldown = false;
        },

        initCache() {
            const cache = { particles: [], core: [] };
            const hues = [200, 30, 0]; 
            hues.forEach(hue => {
                const canvas = document.createElement("canvas");
                canvas.width = 16; canvas.height = 16;
                const ctx = canvas.getContext("2d");
                const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
                grad.addColorStop(0, `hsla(${hue}, 90%, 95%, 1)`);
                grad.addColorStop(0.4, `hsla(${hue}, 80%, 75%, 0.4)`);
                grad.addColorStop(1, `hsla(${hue}, 80%, 70%, 0)`);
                ctx.fillStyle = grad; ctx.fillRect(0, 0, 16, 16);
                cache.particles.push(canvas);
            });
            hues.forEach(hue => {
                const canvas = document.createElement("canvas");
                canvas.width = 64; canvas.height = 64;
                const ctx = canvas.getContext("2d");
                const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
                grad.addColorStop(0, `hsla(${hue}, 100%, 95%, 0.9)`);
                grad.addColorStop(0.3, `hsla(${hue}, 100%, 80%, 0.5)`);
                grad.addColorStop(1, `hsla(${hue}, 100%, 70%, 0)`);
                ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
                cache.core.push(canvas);
            });
            return cache;
        },

        resize(isInitial = false) {
            this.w = window.innerWidth; this.h = window.innerHeight;
            this.canvas.width = this.w * this.DPR; this.canvas.height = this.h * this.DPR;
            this.canvas.style.width = this.w + 'px'; this.canvas.style.height = this.h + 'px';
            this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);

            const area = this.w * this.h;
            this.totalInitialCount = Math.max(40, Math.min(200, Math.floor(area / 12000 * window.EffectController.performanceScale)));

            if (isInitial) { this.initSingularity(); return; }
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => this.refillStep(), 500); 
        },

        refillStep() {
            if (!this.running) return;
            const currentTotal = this.singularities.length + this.absorbedPool.length;
            if (currentTotal < this.totalInitialCount) {
                this.singularities.push(this.spawnParticle(true));
                this.resizeTimeout = setTimeout(() => this.refillStep(), 200);
            }
        },

        initSingularity() {
            while (this.singularities.length) this.particlePool.recycle(this.singularities.pop());
            while (this.absorbedPool.length) this.particlePool.recycle(this.absorbedPool.pop());
            for (let i = 0; i < this.totalInitialCount; i++) this.singularities.push(this.spawnParticle(false));
        },

        spawnParticle(fromEdge = true) {
            const p = this.particlePool.get();
            const speed = 0.4 + Math.random() * 0.4;
            if (fromEdge) {
                const side = (Math.random() * 4) | 0;
                if (side === 0) { p.x = -10; p.y = Math.random() * this.h; p.vx = speed; p.vy = (Math.random()-0.5)*speed; } 
                else if (side === 1) { p.x = this.w + 10; p.y = Math.random() * this.h; p.vx = -speed; p.vy = (Math.random()-0.5)*speed; } 
                else if (side === 2) { p.x = Math.random() * this.w; p.y = -10; p.vx = (Math.random()-0.5)*speed; p.vy = speed; } 
                else { p.x = Math.random() * this.w; p.y = this.h + 10; p.vx = (Math.random()-0.5)*speed; p.vy = -speed; } 
            } else {
                p.x = Math.random() * this.w; p.y = Math.random() * this.h;
                const a = Math.random() * Math.PI * 2;
                p.vx = Math.cos(a) * speed; p.vy = Math.sin(a) * speed;
            }
            p.baseSpeed = speed; p.size = 2.0 + Math.random() * 2.5; p.bursting = false;
            return p;
        },

        triggerBurst() {
            if (this.burstCooldown || this.absorbedPool.length === 0) return;
            this.burstCooldown = true;
            const interact = window.EffectController.interaction;
            const bx = interact.isValid ? interact.x : this.w / 2;
            const by = interact.isValid ? interact.y : this.h / 2;
            const toRelease = [...this.absorbedPool];
            this.absorbedPool = [];
            toRelease.forEach(p => {
                this.timeouts.push(setTimeout(() => {
                    if (!this.running) return;
                    const a = Math.random() * Math.PI * 2; const s = 10 + Math.random() * 12;
                    p.x = bx; p.y = by; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
                    p.bursting = true; this.singularities.push(p);
                }, Math.random() * 400));
            });
            this.timeouts.push(setTimeout(() => { this.burstCooldown = false; }, 800));
        },

        animate(t) {
            if (!this.running) return;
            if (window.EffectController.shouldRender(t)) {
                this.ctx.clearRect(0, 0, this.w, this.h);
                const interact = window.EffectController.interaction;
                const capturedCount = this.absorbedPool.length;
                const ratio = capturedCount / this.totalInitialCount;
                const stage = ratio >= 0.8 ? 2 : (ratio >= 0.6 ? 1 : 0);
                const hue = (t / 50) % 360;
                const maxDist = this.w < 600 ? 50 : 90;
                const maxDistSq = maxDist * maxDist;

                if (interact.isDown && !this.wasDown && !interact.isOverUI && capturedCount > 0) this.triggerBurst();
                this.wasDown = interact.isDown;

                this.ctx.lineWidth = 0.8;
                for (let i = 0; i < this.singularities.length; i++) {
                    const p1 = this.singularities[i]; let count = 0;
                    for (let j = i + 1; j < this.singularities.length; j++) {
                        if (count > 5) break;
                        const p2 = this.singularities[j];
                        const dx = p1.x - p2.x; const dy = p1.y - p2.y;
                        const d2 = dx*dx + dy*dy;
                        if (d2 < maxDistSq) {
                            const alpha = (1 - Math.sqrt(d2) / maxDist) * 0.4;
                            this.ctx.strokeStyle = `hsla(${hue}, 80%, 70%, ${alpha})`;
                            this.ctx.beginPath(); this.ctx.moveTo(p1.x, p1.y); this.ctx.lineTo(p2.x, p2.y); this.ctx.stroke();
                            count++;
                        }
                    }
                }

                const mR2 = this.mouseRadius * this.mouseRadius;
                for (let i = this.singularities.length - 1; i >= 0; i--) {
                    const p = this.singularities[i];
                    if (p.bursting) {
                        p.vx *= 0.96; p.vy *= 0.96;
                        if (Math.hypot(p.vx, p.vy) < p.baseSpeed * 1.5) p.bursting = false;
                    }
                    if (interact.isValid && !interact.isOverUI && !p.bursting) {
                        const dx = interact.x - p.x; const dy = interact.y - p.y;
                        const d2 = dx*dx + dy*dy;
                        if (d2 < mR2) {
                            const dist = Math.sqrt(d2);
                            const pull = (1 - dist / this.mouseRadius) * 0.15;
                            p.vx += dx * pull * 0.05; p.vy += dy * pull * 0.05;
                            if (dist < this.captureRadius) { this.absorbedPool.push(this.singularities.splice(i, 1)[0]); continue; }
                        }
                    }
                    p.x += p.vx; p.y += p.vy;
                    if (p.x < 0 || p.x > this.w) p.vx *= -1;
                    if (p.y < 0 || p.y > this.h) p.vy *= -1;
                    const s = Math.hypot(p.vx, p.vy) || 1; const diff = p.baseSpeed - s;
                    p.vx += (p.vx/s) * diff * 0.02; p.vy += (p.vy/s) * diff * 0.02;
                    window.EffectController.drawSprite(this.ctx, this.spriteCache.particles[stage], p.x, p.y, p.size, 0, 0.8);
                }

                if (ratio >= 0.9) this.triggerBurst();

                if (capturedCount > 0 && interact.isValid && !interact.isOverUI) {
                    const r = (2 + Math.sqrt(capturedCount) * 0.8);
                    const coreSize = r * (1 + Math.sin(t / 150) * 0.1) * 3;
                    window.EffectController.drawSprite(this.ctx, this.spriteCache.core[stage], interact.x, interact.y, coreSize, t * 0.001, 0.9);
                    this.ctx.fillStyle = `hsla(${stage === 2 ? 0 : (stage === 1 ? 30 : hue)}, 90%, 90%, 1)`;
                    this.ctx.beginPath(); this.ctx.arc(interact.x, interact.y, r, 0, Math.PI * 2); this.ctx.fill();
                }
            }
            this.animationId = requestAnimationFrame((t) => this.animate(t));
        }
    };

    window.EffectController.register("singularity", singularityEffect);
})();