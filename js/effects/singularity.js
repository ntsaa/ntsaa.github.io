// singularity.js
(function () {

    const singularityEffect = {

        animationId: null,
        canvas: null,
        ctx: null,
        singularities: [], 
        absorbedPool: [],  // Logic pool for captured particles
        
        // Performance & Memory
        particlePool: null,
        spriteCache: null,
        
        timeouts: [],
        resizeTimeout: null,

        running: false,
        w: 0,
        h: 0,
        DPR: window.EffectController.DPR,

        mouse: { x: null, y: null, radius: 85 }, 
        captureRadius: 12, 

        burstRatio: 0.9,   
        criticalRatio: 0.8, 
        dangerRatio: 0.7,   
        
        totalInitialCount: 0,
        burstCooldown: false,

        /* ================= START ================= */

        start() {
            if (this.running) return;
            this.running = true;

            this.canvas = document.getElementById('network');
            if (!this.canvas) return;
            this.ctx = this.canvas.getContext('2d');
            window.EffectController.resetCanvasContext(this.ctx);

            // 1. Initialize Sprite Cache (hues + black hole core)
            this.spriteCache = window.EffectController.getCache("singularity", () => this.initCache());

            // 2. Initialize Object Pool
            if (!this.particlePool) {
                this.particlePool = window.EffectController.createPool(() => ({}), 300);
            }

            this.resizeHandler = () => this.resize();
            this.mouseMoveHandler = e => { 
                if (window.EffectController.isUIElement(e.target)) {
                    this.mouse.x = null;
                } else {
                    this.mouse.x = e.clientX; 
                    this.mouse.y = e.clientY; 
                }
            };
            this.mouseLeaveHandler = () => { this.mouse.x = null; this.mouse.y = null; };
            
            this.touchStartHandler = e => { 
                if (e.touches.length > 0) { 
                    if (window.EffectController.isUIElement(e.target)) {
                        this.mouse.x = null;
                    } else {
                        this.mouse.x = e.touches[0].clientX; 
                        this.mouse.y = e.touches[0].clientY; 
                    }
                }
            };
            this.touchMoveHandler = e => { 
                if (e.touches.length > 0) { 
                    if (window.EffectController.isUIElement(e.target)) {
                        this.mouse.x = null;
                    } else {
                        this.mouse.x = e.touches[0].clientX; 
                        this.mouse.y = e.touches[0].clientY; 
                    }
                }
            };
            this.touchEndHandler = () => {
                if (this.absorbedPool.length > 0) this.triggerBurst();
                this.mouse.x = null; this.mouse.y = null;
            };

            this.clickHandler = e => {
                if (window.EffectController.isUIElement(e.target)) return;
                if (this.mouse.x === null || this.burstCooldown) return;
                if (this.absorbedPool.length > 0) this.triggerBurst();
            };

            window.addEventListener('resize', this.resizeHandler);
            window.addEventListener('mousemove', this.mouseMoveHandler);
            window.addEventListener('mouseleave', this.mouseLeaveHandler);
            window.addEventListener('click', this.clickHandler);
            
            window.addEventListener('touchstart', this.touchStartHandler, { passive: true });
            window.addEventListener('touchmove', this.touchMoveHandler, { passive: true });
            window.addEventListener('touchend', this.touchEndHandler, { passive: true });

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
            window.removeEventListener('mousemove', this.mouseMoveHandler);
            window.removeEventListener('mouseleave', this.mouseLeaveHandler);
            window.removeEventListener('click', this.clickHandler);
            window.removeEventListener('touchstart', this.touchStartHandler);
            window.removeEventListener('touchmove', this.touchMoveHandler);
            window.removeEventListener('touchend', this.touchEndHandler);
            
            this.timeouts.forEach(t => clearTimeout(t));
            this.timeouts = [];
            
            if (this.ctx) this.ctx.clearRect(0, 0, this.w, this.h);
            
            // Recycle all particles
            while (this.singularities.length) this.particlePool.recycle(this.singularities.pop());
            while (this.absorbedPool.length) this.particlePool.recycle(this.absorbedPool.pop());
            
            this.mouse.x = null;
            this.mouse.y = null;
            this.burstCooldown = false;
        },

        /* ================= CACHE ================= */

        initCache() {
            const cache = { particles: [], core: [] };
            const hues = [200, 30, 0]; // Blueish, Orange, Red
            hues.forEach(hue => {
                const canvas = document.createElement("canvas");
                canvas.width = 32; // Increased resolution for sharpness
                canvas.height = 32;
                const ctx = canvas.getContext("2d");
                const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
                // Sharper gradient: solid-ish center, fast fade at edge
                grad.addColorStop(0, `hsla(${hue}, 90%, 95%, 1)`);
                grad.addColorStop(0.2, `hsla(${hue}, 80%, 80%, 0.9)`);
                grad.addColorStop(0.5, `hsla(${hue}, 80%, 75%, 0.4)`);
                grad.addColorStop(1, `hsla(${hue}, 80%, 70%, 0)`);
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, 32, 32);
                cache.particles.push(canvas);
            });
            // ... (core cache remains same but uses better hues)

            // Cache for Black Hole core (various sizes/intensities)
            for (let i = 0; i < 3; i++) {
                const canvas = document.createElement("canvas");
                canvas.width = 128;
                canvas.height = 128;
                const ctx = canvas.getContext("2d");
                const hue = hues[i];
                const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
                grad.addColorStop(0, `hsla(${hue}, 100%, 95%, 0.95)`);
                grad.addColorStop(0.3, `hsla(${hue}, 100%, 80%, 0.6)`);
                grad.addColorStop(1, `hsla(${hue}, 100%, 70%, 0)`);
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, 128, 128);
                cache.core.push(canvas);
            }
            return cache;
        },

        /* ================= RESIZE ================= */

        resize(isInitial = false) {
            this.w = window.innerWidth;
            this.h = window.innerHeight;
            this.canvas.width = this.w * this.DPR;
            this.canvas.height = this.h * this.DPR;
            this.canvas.style.width = this.w + 'px';
            this.canvas.style.height = this.h + 'px';
            this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);

            const area = this.w * this.h;
            const targetCount = Math.max(40, Math.min(200, Math.floor(area / 10000)));

            if (isInitial) {
                this.totalInitialCount = targetCount;
                this.initSingularity();
                return;
            }

            this.totalInitialCount = targetCount;
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => this.refillStep(), 500); 
        },

        refillStep() {
            if (!this.running) return;
            const currentTotal = this.singularities.length + this.absorbedPool.length;
            if (currentTotal < this.totalInitialCount) {
                const toAdd = Math.min(3, this.totalInitialCount - currentTotal);
                for (let i = 0; i < toAdd; i++) {
                    this.singularities.push(this.spawnParticle(true));
                }
                this.resizeTimeout = setTimeout(() => this.refillStep(), 800);
            }
        },

        initSingularity() {
            while (this.singularities.length) this.particlePool.recycle(this.singularities.pop());
            while (this.absorbedPool.length) this.particlePool.recycle(this.absorbedPool.pop());
            for (let i = 0; i < this.totalInitialCount; i++) {
                this.singularities.push(this.spawnParticle(false));
            }
        },

        spawnParticle(fromEdge = true) {
            const p = this.particlePool.get();
            const speed = 0.5 + Math.random() * 0.5;
            
            if (fromEdge) {
                const side = Math.floor(Math.random() * 4);
                const offset = 50;
                if (side === 0) { p.x = -offset; p.y = Math.random() * this.h; p.vx = speed; p.vy = (Math.random()-0.5)*speed; } 
                else if (side === 1) { p.x = this.w + offset; p.y = Math.random() * this.h; p.vx = -speed; p.vy = (Math.random()-0.5)*speed; } 
                else if (side === 2) { p.x = Math.random() * this.w; p.y = -offset; p.vx = (Math.random()-0.5)*speed; p.vy = speed; } 
                else { p.x = Math.random() * this.w; p.y = this.h + offset; p.vx = (Math.random()-0.5)*speed; p.vy = -speed; } 
            } else {
                const angle = Math.random() * Math.PI * 2;
                p.x = Math.random() * this.w;
                p.y = Math.random() * this.h;
                p.vx = Math.cos(angle) * speed;
                p.vy = Math.sin(angle) * speed;
            }

            p.baseSpeed = speed;
            p.r = 1 + Math.random() * 1.5;
            p.isSuper = false;
            p.bursting = false;
            return p;
        },

        triggerBurst() {
            if (this.burstCooldown || this.absorbedPool.length === 0) return;
            this.burstCooldown = true;

            const bx = this.mouse.x !== null ? this.mouse.x : this.w / 2;
            const by = this.mouse.y !== null ? this.mouse.y : this.h / 2;

            const toRelease = [...this.absorbedPool];
            this.absorbedPool = [];

            toRelease.forEach(p => {
                const delay = Math.random() * 500;
                const t = setTimeout(() => {
                    if (!this.running) return;
                    const angle = Math.random() * Math.PI * 2;
                    p.isSuper = Math.random() < 0.3; 
                    const speed = p.isSuper ? (20 + Math.random() * 15) : (8 + Math.random() * 10);
                    p.x = bx; p.y = by;
                    p.vx = Math.cos(angle) * speed;
                    p.vy = Math.sin(angle) * speed;
                    p.bursting = true;
                    this.singularities.push(p);
                }, delay);
                this.timeouts.push(t);
            });

            const cooldownT = setTimeout(() => { this.burstCooldown = false; }, 1000);
            this.timeouts.push(cooldownT);
        },

        normalizeSpeed(p) {
            const speed = Math.hypot(p.vx, p.vy);
            if (!speed) return;
            const diff = p.baseSpeed - speed;
            p.vx += (p.vx / speed) * diff * 0.03;
            p.vy += (p.vy / speed) * diff * 0.03;
        },

        /* ================= ANIMATE ================= */

        animate(t) {
            if (!this.running) return;
            if (!window.EffectController.shouldRender(t)) {
                this.animationId = requestAnimationFrame((t) => this.animate(t));
                return;
            }

            this.ctx.clearRect(0, 0, this.w, this.h);

            const capturedCount = this.absorbedPool.length;
            const currentRatio = capturedCount / this.totalInitialCount;
            const isDanger = currentRatio >= this.dangerRatio;
            const isCritical = currentRatio >= this.criticalRatio;
            
            const stageIndex = isCritical ? 2 : (isDanger ? 1 : 0);
            const hue = (Date.now() / 60) % 360;
            const maxDist = this.w < 600 ? 45 : 100; // Tighter on mobile
            const maxDistSq = maxDist * maxDist;

            // DRAW LINES (Dynamic alpha based on distance for organic feel)
            for (let i = 0; i < this.singularities.length; i++) {
                const p = this.singularities[i];
                let connections = 0;
                for (let j = i + 1; j < this.singularities.length; j++) {
                    if (connections >= 6) break;
                    const p2 = this.singularities[j];
                    const dx = p.x - p2.x;
                    if (Math.abs(dx) < maxDist) {
                        const dy = p.y - p2.y;
                        const d2 = dx * dx + dy * dy;
                        if (d2 < maxDistSq) {
                            const dist = Math.sqrt(d2);
                            const alpha = (1 - dist / maxDist) * 0.35; // Bolder fade
                            
                            this.ctx.beginPath();
                            this.ctx.lineWidth = 0.8; // Thicker lines
                            this.ctx.strokeStyle = `hsla(${hue}, 80%, 70%, ${alpha})`;
                            this.ctx.moveTo(p.x, p.y);
                            this.ctx.lineTo(p2.x, p2.y);
                            this.ctx.stroke();
                            connections++;
                        }
                    }
                }
            }

            // UPDATE & DRAW PARTICLES
            for (let i = this.singularities.length - 1; i >= 0; i--) {
                const p = this.singularities[i];

                if (p.bursting) {
                    p.vx *= 0.98;
                    p.vy *= 0.98;
                    if (Math.hypot(p.vx, p.vy) < p.baseSpeed * 1.2) {
                        p.bursting = false;
                        p.isSuper = false;
                    }
                }

                if (this.mouse.x !== null && !p.bursting) {
                    const dx = this.mouse.x - p.x;
                    const dy = this.mouse.y - p.y;
                    const distSq = dx * dx + dy * dy;

                    if (distSq < this.mouse.radius * this.mouse.radius) {
                        const dist = Math.sqrt(distSq);
                        const pull = 1 - dist / this.mouse.radius;
                        const strength = 0.001 + Math.pow(pull, 3) * 0.008; 
                        p.vx += dx * strength;
                        p.vy += dy * strength;

                        if (dist < this.captureRadius) {
                            this.absorbedPool.push(this.singularities.splice(i, 1)[0]);
                            continue;
                        }
                    }
                }

                p.x += p.vx;
                p.y += p.vy;

                // Screen wrapping / removal
                if (p.x < -100 || p.x > this.w + 100 || p.y < -100 || p.y > this.h + 100) {
                    if ((this.singularities.length + this.absorbedPool.length) > this.totalInitialCount) {
                        this.particlePool.recycle(this.singularities.splice(i, 1)[0]);
                        continue;
                    }
                }
                
                if (p.x <= 0) { p.x = 0; p.vx = Math.abs(p.vx); }
                else if (p.x >= this.w) { p.x = this.w; p.vx = -Math.abs(p.vx); }
                if (p.y <= 0) { p.y = 0; p.vy = Math.abs(p.vy); }
                else if (p.y >= this.h) { p.y = this.h; p.vy = -Math.abs(p.vy); }

                this.normalizeSpeed(p);

                // Revert to sharp arc for particles
                const drawR = (p.bursting && p.isSuper) ? p.r * 0.8 : p.r;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, drawR, 0, Math.PI * 2);
                
                const coreHue = isCritical ? 0 : (isDanger ? 30 : hue);
                this.ctx.fillStyle = p.bursting 
                    ? `hsla(${coreHue}, 90%, 85%, 0.85)` 
                    : `hsla(${hue}, 80%, 75%, 0.7)`;
                this.ctx.fill();
            }

            if (currentRatio >= this.burstRatio) this.triggerBurst();

            // DRAW CORE
            if (capturedCount > 0 && this.mouse.x !== null) {
                let cx = this.mouse.x, cy = this.mouse.y;
                if (isDanger) {
                    const s = currentRatio * 3.5; 
                    cx += (Math.random() - 0.5) * s;
                    cy += (Math.random() - 0.5) * s;
                }
                const comp = 1 - (currentRatio * 0.45);
                const r = Math.min(16, (2 + Math.pow(capturedCount, 0.5) * 0.6) * comp);
                const pulse = Math.sin(t / 200) * 0.5;
                const gr = r * (2.5 + (isDanger ? pulse : 0));

                // Draw core layers from cache
                const coreImg = this.spriteCache.core[stageIndex];
                this.ctx.drawImage(coreImg, cx - gr, cy - gr, gr * 2, gr * 2);
                
                // Small inner bright core
                this.ctx.beginPath();
                this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
                this.ctx.fillStyle = `hsla(${isCritical ? 0 : (isDanger ? 30 : hue)}, 80%, 90%, 0.95)`;
                this.ctx.fill();
            }

            this.animationId = requestAnimationFrame((t) => this.animate(t));
        }
    };

    window.EffectController.register("singularity", singularityEffect);
})();
