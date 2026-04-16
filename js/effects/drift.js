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
        moveHandler: null,
        clickHandler: null,

        mouseX: 0,
        mouseY: 0,
        hasMouse: false,

        w: 0,
        h: 0,
        DPR: window.EffectController.DPR,
        isMobile: false,
        initCount: 0,
        
        // Performance & Scaling
        particleCache: null, 
        particlePool: null,
        fragmentPool: null,
        wellPool: null,

        mouseRadius: 120,
        wellBaseRadius: 140,
        
        running: false,
        resizeTimeout: null,

        /* ================= START ================= */

        start() {
            if (this.running) return;
            this.running = true;

            this.canvas = document.getElementById('network');
            if (!this.canvas) return;

            this.ctx = this.canvas.getContext('2d');
            window.EffectController.resetCanvasContext(this.ctx);

            // 1. Initialize Sprite Cache (once)
            this.particleCache = window.EffectController.getCache("drift", () => this.initCache());

            // 2. Initialize Object Pools
            if (!this.particlePool) {
                this.particlePool = window.EffectController.createPool(() => ({}), 600);
                this.fragmentPool = window.EffectController.createPool(() => ({}), 400);
                this.wellPool = window.EffectController.createPool(() => ({}), 10);
            }

            this.resizeHandler = () => this.resize();
            window.addEventListener('resize', this.resizeHandler);

            this.moveHandler = e => {
                const target = e.target;
                if (window.EffectController.isUIElement(target)) {
                    this.hasMouse = false;
                } else {
                    const isTouch = e.type.startsWith('touch');
                    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
                    const clientY = isTouch ? e.touches[0].clientY : e.clientY;
                    this.mouseX = clientX;
                    this.mouseY = clientY;
                    this.hasMouse = true;
                }
            };

            this.clickHandler = e => {
                if (window.EffectController.isUIElement(e.target)) return;
                const isTouch = e.type.startsWith('touch');
                const clientX = isTouch ? (e.changedTouches ? e.changedTouches[0].clientX : e.touches[0].clientX) : e.clientX;
                const clientY = isTouch ? (e.changedTouches ? e.changedTouches[0].clientY : e.touches[0].clientY) : e.clientY;
                this.createWell(clientX, clientY);
            };

            window.addEventListener('mousemove', this.moveHandler);
            window.addEventListener('click', this.clickHandler);
            window.addEventListener('mouseleave', () => { this.hasMouse = false; });
            
            window.addEventListener('touchstart', this.moveHandler, { passive: true });
            window.addEventListener('touchmove', this.moveHandler, { passive: true });
            window.addEventListener('touchend', (e) => {
                this.clickHandler(e);
                this.hasMouse = false;
            }, { passive: true });

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
            window.removeEventListener('mousemove', this.moveHandler);
            window.removeEventListener('click', this.clickHandler);
            
            // Recycle objects back to pools
            while (this.singularities.length) this.particlePool.recycle(this.singularities.pop());
            while (this.fragments.length) this.fragmentPool.recycle(this.fragments.pop());
            while (this.wells.length) this.wellPool.recycle(this.wells.pop());

            if (this.ctx) this.ctx.clearRect(0, 0, this.w, this.h);
        },

        /* ================= SPRITE CACHE ================= */

        initCache() {
            const cache = [];
            // Cache 60 hue variations
            for (let i = 0; i < 60; i++) {
                const size = 32; // Standard internal size
                const pCanvas = document.createElement('canvas');
                pCanvas.width = size * 2;
                pCanvas.height = size * 2;
                const pCtx = pCanvas.getContext('2d');
                const hue = i * 6;
                const center = size;
                
                const grad = pCtx.createRadialGradient(center, center, 0, center, center, size);
                grad.addColorStop(0, `hsla(${hue}, 90%, 75%, 0.8)`);
                grad.addColorStop(0.8, `hsla(${hue}, 80%, 70%, 0.7)`);
                grad.addColorStop(1, `hsla(${hue}, 80%, 70%, 0)`);
                
                pCtx.fillStyle = grad;
                pCtx.fillRect(0, 0, size * 2, size * 2);
                cache.push(pCanvas);
            }
            return cache;
        },

        /* ================= LOGIC ================= */

        resize(isInitial = false) {
            this.w = window.innerWidth;
            this.h = window.innerHeight;
            this.isMobile = this.w < 600;

            this.canvas.style.width = this.w + 'px';
            this.canvas.style.height = this.h + 'px';
            this.canvas.width = this.w * this.DPR;
            this.canvas.height = this.h * this.DPR;
            this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);

            // Scaling Interaction Radii based on screen width
            // Base width is 1200px. Scale down but cap at 0.5 to keep it usable.
            const scale = Math.max(0.5, Math.min(1.0, this.w / 1200));
            this.mouseRadius = 120 * scale;
            this.wellBaseRadius = 140 * scale;

            const area = this.w * this.h;
            const density = this.isMobile ? 1 / 5000 : 1 / 3800;
            this.initCount = Math.max(100, Math.min(600, Math.floor(area * density)));

            if (isInitial) {
                this.initSingularity();
                return;
            }

            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => this.refillStep(), 500);
        },

        refillStep() {
            if (!this.running) return;
            const currentTotal = this.singularities.length;
            if (currentTotal < this.initCount) {
                const toAdd = Math.min(5, this.initCount - currentTotal);
                for (let i = 0; i < toAdd; i++) {
                    this.singularities.push(this.spawnParticle(true));
                }
                this.resizeTimeout = setTimeout(() => this.refillStep(), 100);
            }
        },

        initSingularity() {
            // Clear existing and refill
            while (this.singularities.length) this.particlePool.recycle(this.singularities.pop());
            for (let i = 0; i < this.initCount; i++) {
                this.singularities.push(this.spawnParticle(false));
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
                p.x = Math.random() * this.w;
                p.y = Math.random() * this.h;
            }

            const raw = Math.pow(Math.random(), 0.7) * 0.9 + 0.35;
            p.size = Math.max(raw, 0.65);
            p.speedX = (Math.random() - 0.5) * 1.2;
            p.speedY = (Math.random() - 0.5) * 1.2;
            p.hueIndex = (Math.random() * 60) | 0;
            p.depth = Math.random();
            p.toRemove = false;
            return p;
        },

        createWell(x, y) {
            const w = this.wellPool.get();
            w.x = x;
            w.y = y;
            w.life = 320;
            w.radius = this.wellBaseRadius;
            this.wells.push(w);
        },

        explodeNear(x, y, radius) {
            const r2 = radius * radius;
            for (let i = this.singularities.length - 1; i >= 0; i--) {
                const p = this.singularities[i];
                const dx = p.x - x;
                const dy = p.y - y;
                const d2 = dx * dx + dy * dy;

                if (d2 < r2) {
                    const pieces = (3 + p.size * 2) | 0;
                    for (let j = 0; j < pieces; j++) {
                        const f = this.fragmentPool.get();
                        f.x = p.x; f.y = p.y;
                        f.vx = (Math.random() - 0.5) * (1.2 + p.size * 1.2);
                        f.vy = (Math.random() - 0.5) * (1.2 + p.size * 1.2);
                        f.lifeMax = f.life = (20 + p.size * 10) | 0;
                        f.size = p.size * (Math.random() * 0.6 + 0.4);
                        f.hueIndex = p.hueIndex;
                        this.fragments.push(f);
                    }
                    this.particlePool.recycle(this.singularities.splice(i, 1)[0]);
                }
            }
            // Refill
            while (this.singularities.length < this.initCount) {
                this.singularities.push(this.spawnParticle(true));
            }
        },

        updateAndDraw(t) {
            // Wells - Pre-calculate squared radius for performance
            for (let i = this.wells.length - 1; i >= 0; i--) {
                const w = this.wells[i];
                w.life--;
                if (w.life <= 0) {
                    this.explodeNear(w.x, w.y, w.radius);
                    this.wellPool.recycle(this.wells.splice(i, 1)[0]);
                } else {
                    w.rSq = w.radius * w.radius; // Cache squared radius
                }
            }

            // Singularities
            const mR2 = this.mouseRadius * this.mouseRadius;
            const dpr = this.DPR;

            for (let i = this.singularities.length - 1; i >= 0; i--) {
                const p = this.singularities[i];
                
                // Brownian motion-ish
                p.speedX = Math.max(-1.2, Math.min(1.2, p.speedX + (Math.random() - 0.5) * 0.05));
                p.speedY = Math.max(-1.2, Math.min(1.2, p.speedY + (Math.random() - 0.5) * 0.05));

                let insideWell = false;
                for (let j = 0; j < this.wells.length; j++) {
                    const w = this.wells[j];
                    const dx = w.x - p.x;
                    const dy = w.y - p.y;
                    const d2 = dx * dx + dy * dy;
                    if (d2 < w.rSq) {
                        insideWell = true;
                        const dist = Math.sqrt(d2) || 1;
                        const pull = 0.02 + (1 - dist / w.radius) * 0.05;
                        p.x += dx * pull;
                        p.y += dy * pull;
                        break;
                    }
                }

                if (this.hasMouse && !insideWell) {
                    const dx = p.x - this.mouseX;
                    const dy = p.y - this.mouseY;
                    const d2 = dx * dx + dy * dy;
                    if (d2 < mR2) {
                        const f = (mR2 - d2) / mR2;
                        p.x += dx * f * 0.55;
                        p.y += dy * f * 0.55;
                    }
                }

                const depthMult = 0.6 + p.depth * 0.6;
                p.x += p.speedX * depthMult;
                p.y += p.speedY * depthMult;

                // Wrap or remove
                if (p.x < -50 || p.x > this.w + 50 || p.y < -50 || p.y > this.h + 50) {
                    if (this.singularities.length > this.initCount) {
                        this.particlePool.recycle(this.singularities.splice(i, 1)[0]);
                        continue;
                    }
                    if (p.x < -50) p.x = this.w; else if (p.x > this.w + 50) p.x = 0;
                    if (p.y < -50) p.y = this.h; else if (p.y > this.h + 50) p.y = 0;
                }

                // Draw using Cache with optimized transform (no save/restore)
                const size = p.size * 1.2;
                const speed = Math.hypot(p.speedX, p.speedY) || 0.001;
                const stretch = 1 + speed * 0.05;
                
                // Vector-based rotation matrix components
                const cos = (p.speedX / speed) * stretch;
                const sin = (p.speedY / speed) * stretch;

                // Use setTransform instead of save/translate/rotate/restore
                // Matrix: [ dpr*cos, dpr*sin, -dpr*(sin/stretch), dpr*(cos/stretch), dpr*x, dpr*y ]
                // Note: We need to account for stretch in the perpendicular axis to maintain aspect
                this.ctx.setTransform(dpr * cos, dpr * sin, -dpr * (sin / stretch), dpr * (cos / stretch), dpr * p.x, dpr * p.y);
                this.ctx.drawImage(this.particleCache[p.hueIndex], -size, -size, size * 2, size * 2);
            }

            // Reset transform for fragments
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            // Fragments
            for (let i = this.fragments.length - 1; i >= 0; i--) {
                const f = this.fragments[i];
                f.x += f.vx;
                f.y += f.vy;
                f.life--;
                if (f.life <= 0) {
                    this.fragmentPool.recycle(this.fragments.splice(i, 1)[0]);
                    continue;
                }
                const alpha = f.life / f.lifeMax;
                this.ctx.globalAlpha = alpha;
                const size = f.size * 1.2;
                this.ctx.drawImage(this.particleCache[f.hueIndex], f.x - size, f.y - size, size * 2, size * 2);
            }
            this.ctx.globalAlpha = 1;
        },

        animate(t) {
            if (!this.running) return;
            if (window.EffectController.shouldRender(t)) {
                this.ctx.globalCompositeOperation = 'destination-out';
                this.ctx.fillStyle = this.isMobile ? 'rgba(0, 0, 0, 0.15)' : 'rgba(0, 0, 0, 0.1)';
                this.ctx.fillRect(0, 0, this.w, this.h);
                this.ctx.globalCompositeOperation = 'source-over';
                this.updateAndDraw(t);
            }
            this.animationId = requestAnimationFrame((t) => this.animate(t));
        }

    };

    window.EffectController.register("drift", driftEffect);

})();
