// drift.js
(function () {

    const driftEffect = {

        animationId: null,
        canvas: null,
        ctx: null,

        singularities: [],
        fragments: [],
        wells: [],

        resizeHandler: null,
        w: 0,
        h: 0,
        DPR: window.EffectController.DPR,
        isMobile: false,
        initCount: 0,
        
        particleCache: null, 
        particlePool: null,
        fragmentPool: null,
        wellPool: null,

        mouseRadius: 120,
        wellBaseRadius: 140,
        
        running: false,
        wasDown: false,
        resizeTimeout: null,

        /* ================= START ================= */

        start() {
            if (this.running) return;
            this.running = true;

            this.canvas = document.getElementById('network');
            if (!this.canvas) return;

            this.ctx = this.canvas.getContext('2d');
            window.EffectController.resetCanvasContext(this.ctx);

            this.particleCache = window.EffectController.getCache("drift", () => this.initCache());

            if (!this.particlePool) {
                this.particlePool = window.EffectController.createPool(() => ({}), null, 600);
                this.fragmentPool = window.EffectController.createPool(() => ({}), null, 400);
                this.wellPool = window.EffectController.createPool(() => ({}), null, 10);
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
            
            while (this.singularities.length) this.particlePool.recycle(this.singularities.pop());
            while (this.fragments.length) this.fragmentPool.recycle(this.fragments.pop());
            while (this.wells.length) this.wellPool.recycle(this.wells.pop());

            if (this.ctx) this.ctx.clearRect(0, 0, this.w, this.h);
        },

        initCache() {
            const cache = [];
            for (let i = 0; i < 40; i++) {
                const s = 32;
                const canvas = document.createElement('canvas');
                canvas.width = s * 2; canvas.height = s * 2;
                const ctx = canvas.getContext('2d');
                const hue = i * 9;
                const grad = ctx.createRadialGradient(s, s, 0, s, s, s);
                grad.addColorStop(0, `hsla(${hue}, 90%, 75%, 0.8)`);
                grad.addColorStop(1, `hsla(${hue}, 80%, 70%, 0)`);
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, s * 2, s * 2);
                cache.push(canvas);
            }
            return cache;
        },

        resize(isInitial = false) {
            this.w = window.innerWidth; this.h = window.innerHeight;
            this.isMobile = this.w < 600;
            this.canvas.style.width = this.w + 'px'; this.canvas.style.height = this.h + 'px';
            this.canvas.width = this.w * this.DPR; this.canvas.height = this.h * this.DPR;
            this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);

            const scale = Math.max(0.5, Math.min(1.0, this.w / 1200));
            this.mouseRadius = 120 * scale;
            this.wellBaseRadius = 140 * scale;
            
            const perf = window.EffectController.performanceScale;
            this.initCount = Math.max(80, Math.min(600, Math.floor((this.w * this.h) / (this.isMobile ? 5000 : 3800) * perf)));

            if (isInitial) {
                for (let i = 0; i < this.initCount; i++) this.singularities.push(this.spawnParticle(false));
                return;
            }
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => this.refillStep(), 500);
        },

        refillStep() {
            if (!this.running) return;
            let current = this.singularities.length;
            if (current < this.initCount) {
                for (let i = 0; i < 5; i++) this.singularities.push(this.spawnParticle(true));
                this.resizeTimeout = setTimeout(() => this.refillStep(), 100);
            }
        },

        spawnParticle(fromEdge = true) {
            const p = this.particlePool.get();
            if (fromEdge) {
                const side = (Math.random() * 4) | 0;
                if (side === 0) { p.x = 0; p.y = Math.random() * this.h; }
                else if (side === 1) { p.x = this.w; p.y = Math.random() * this.h; }
                else if (side === 2) { p.x = Math.random() * this.w; p.y = 0; }
                else { p.x = Math.random() * this.w; p.y = this.h; }
            } else {
                p.x = Math.random() * this.w; p.y = Math.random() * this.h;
            }
            p.size = 0.6 + Math.random() * 0.8;
            p.vx = (Math.random() - 0.5) * 1.5;
            p.vy = (Math.random() - 0.5) * 1.5;
            p.hueIndex = (Math.random() * 40) | 0;
            p.depth = 0.5 + Math.random() * 0.5;
            return p;
        },

        createWell(x, y) {
            const w = this.wellPool.get();
            w.x = x; w.y = y; w.life = 300; w.rSq = this.wellBaseRadius * this.wellBaseRadius;
            this.wells.push(w);
        },

        explodeNear(x, y, radius) {
            const r2 = radius * radius;
            for (let i = this.singularities.length - 1; i >= 0; i--) {
                const p = this.singularities[i];
                const dx = p.x - x; const dy = p.y - y;
                if (dx * dx + dy * dy < r2) {
                    for (let j = 0; j < 4; j++) {
                        const f = this.fragmentPool.get();
                        f.x = p.x; f.y = p.y;
                        f.vx = (Math.random() - 0.5) * 4; f.vy = (Math.random() - 0.5) * 4;
                        f.life = f.maxLife = 20 + Math.random() * 20;
                        f.size = p.size * 0.8; f.hueIndex = p.hueIndex;
                        this.fragments.push(f);
                    }
                    this.particlePool.recycle(this.singularities.splice(i, 1)[0]);
                }
            }
        },

        animate(t) {
            if (!this.running) return;
            if (window.EffectController.shouldRender(t)) {
                this.ctx.globalCompositeOperation = 'destination-out';
                this.ctx.fillStyle = `rgba(0, 0, 0, ${this.isMobile ? 0.15 : 0.1})`;
                this.ctx.fillRect(0, 0, this.w, this.h);
                this.ctx.globalCompositeOperation = 'lighter';

                const interact = window.EffectController.interaction;
                const mR2 = this.mouseRadius * this.mouseRadius;

                if (interact.isDown && !this.wasDown && !interact.isOverUI) this.createWell(interact.x, interact.y);
                this.wasDown = interact.isDown;
                
                // Wells (Gravity Pull)
                for (let i = this.wells.length - 1; i >= 0; i--) {
                    const w = this.wells[i];
                    w.life--;
                    if (w.life <= 0) {
                        this.explodeNear(w.x, w.y, this.wellBaseRadius);
                        this.wellPool.recycle(this.wells.splice(i, 1)[0]);
                    }
                }

                // Singularities
                for (let i = this.singularities.length - 1; i >= 0; i--) {
                    const p = this.singularities[i];
                    
                    // Natural Brownian drift
                    p.vx = Math.max(-1.5, Math.min(1.5, p.vx + (Math.random() - 0.5) * 0.08));
                    p.vy = Math.max(-1.5, Math.min(1.5, p.vy + (Math.random() - 0.5) * 0.08));
                    
                    let insideWell = false;
                    for (const w of this.wells) {
                        const dx = w.x - p.x; const dy = w.y - p.y;
                        const d2 = dx * dx + dy * dy;
                        if (d2 < w.rSq) {
                            const dist = Math.sqrt(d2) || 1;
                            const pull = 0.02 + (1 - dist / this.wellBaseRadius) * 0.06;
                            p.x += dx * pull; p.y += dy * pull;
                            insideWell = true; break;
                        }
                    }

                    // Mouse Repulsion (Position-based for snappiness)
                    if (interact.isValid && !interact.isOverUI && !insideWell) {
                        const dx = p.x - interact.x; const dy = p.y - interact.y;
                        const d2 = dx * dx + dy * dy;
                        if (d2 < mR2) {
                            const f = (mR2 - d2) / mR2;
                            p.x += dx * f * 0.5;
                            p.y += dy * f * 0.5;
                        }
                    }

                    p.x += p.vx * p.depth; p.y += p.vy * p.depth;
                    
                    // Wrap-around
                    if (p.x < -50) p.x = this.w + 50; else if (p.x > this.w + 50) p.x = -50;
                    if (p.y < -50) p.y = this.h + 50; else if (p.y > this.h + 50) p.y = -50;

                    const rotation = Math.atan2(p.vy, p.vx);
                    window.EffectController.drawSprite(this.ctx, this.particleCache[p.hueIndex], p.x, p.y, p.size * 1.5, rotation, 0.8);
                }

                // Fragments
                for (let i = this.fragments.length - 1; i >= 0; i--) {
                    const f = this.fragments[i];
                    f.x += f.vx; f.y += f.vy; f.life--;
                    if (f.life <= 0) {
                        this.fragmentPool.recycle(this.fragments.splice(i, 1)[0]);
                        continue;
                    }
                    window.EffectController.drawSprite(this.ctx, this.particleCache[f.hueIndex], f.x, f.y, f.size, 0, f.life / f.maxLife);
                }
            }
            this.animationId = requestAnimationFrame((t) => this.animate(t));
        }
    };

    window.EffectController.register("drift", driftEffect);
})();