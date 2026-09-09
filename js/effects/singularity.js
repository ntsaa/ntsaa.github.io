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
        wasEsc: false,

        // Game State
        gameActive: false,
        runValid: false,
        startTime: 0,
        elapsedTime: 0,
        lastRecord: { score: 0, captured: 0, time: 0 },
        bestRecord: { score: 0, captured: 0, time: Infinity, percent: 0 },

        /* ================= START ================= */

        start() {
            if (this.running) return;
            this.running = true;

            // Load Best Record (New v2 metric: Capture Rate)
            const saved = localStorage.getItem('ntsaa_singularity_best_v2');
            if (saved) {
                this.bestRecord = JSON.parse(saved);
            } else {
                this.bestRecord = { score: 0, captured: 0, time: Infinity, percent: 0 };
            }

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
            
            // Reset game state on stop
            this.gameActive = false;
            this.runValid = false;
            this.burstCooldown = false;
        },

        initCache() {
            const cache = { particles: [], core: [] };
            for (let h = 0; h < 360; h += 30) {
                const pCanvas = document.createElement("canvas");
                pCanvas.width = 16; pCanvas.height = 16;
                const pCtx = pCanvas.getContext("2d");
                const pGrad = pCtx.createRadialGradient(8, 8, 0, 8, 8, 8);
                pGrad.addColorStop(0, `hsla(${h}, 100%, 95%, 1)`);
                pGrad.addColorStop(0.4, `hsla(${h}, 90%, 75%, 0.8)`); 
                pGrad.addColorStop(1, `hsla(${h}, 90%, 70%, 0)`);
                pCtx.fillStyle = pGrad; pCtx.fillRect(0, 0, 16, 16);
                cache.particles.push(pCanvas);

                const cCanvas = document.createElement("canvas");
                cCanvas.width = 64; cCanvas.height = 64;
                const cCtx = cCanvas.getContext("2d");
                const cGrad = cCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
                cGrad.addColorStop(0, `hsla(${h}, 100%, 95%, 0.9)`);
                cGrad.addColorStop(0.3, `hsla(${h}, 100%, 80%, 0.7)`);
                cGrad.addColorStop(1, `hsla(${h}, 100%, 70%, 0)`);
                cCtx.fillStyle = cGrad; cCtx.fillRect(0, 0, 64, 64);
                cache.core.push(cCanvas);
            }
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
            this.resizeTimeout = setTimeout(() => this.refillStep(), 1000); 
        },

        refillStep() {
            if (!this.running) return;
            while (this.singularities.length) this.particlePool.recycle(this.singularities.pop());
            while (this.absorbedPool.length) this.particlePool.recycle(this.absorbedPool.pop());
            this.timeouts.forEach(t => clearTimeout(t));
            this.timeouts = [];
            this.burstCooldown = false;
            this.runValid = false;
            this.gameActive = false;
            for (let i = 0; i < this.totalInitialCount; i++) {
                this.singularities.push(this.spawnParticle(false));
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
                const hue = (t / 50) % 360;
                const hueIndex = Math.floor(hue / 30) % 12;
                const maxDist = this.w < 600 ? 50 : 90;
                const maxDistSq = maxDist * maxDist;

                const isClicked = (interact.isDown && !this.wasDown && !interact.isOverUI);
                const isEscPressed = (interact.isEsc && !this.wasEsc);
                
                if (isClicked && capturedCount > 0) this.triggerBurst();
                this.wasDown = interact.isDown;
                this.wasEsc = interact.isEsc;

                this.ctx.lineWidth = 1.0;
                for (let i = 0; i < this.singularities.length; i++) {
                    const p1 = this.singularities[i]; let count = 0;
                    for (let j = i + 1; j < this.singularities.length; j++) {
                        if (count > 6) break;
                        const p2 = this.singularities[j];
                        const dx = p1.x - p2.x; const dy = p1.y - p2.y;
                        const d2 = dx*dx + dy*dy;
                        if (d2 < maxDistSq) {
                            const dist = Math.sqrt(d2);
                            const alpha = (1 - dist / maxDist) * 0.6;
                            this.ctx.strokeStyle = `hsla(${hue}, 90%, 75%, ${alpha})`;
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
                    window.EffectController.drawSprite(this.ctx, this.spriteCache.particles[hueIndex], p.x, p.y, p.size, 0, 1.0);
                }

                if (ratio >= 1.0) this.triggerBurst();

                if (capturedCount > 0 && interact.isValid && !interact.isOverUI) {
                    const r = (2 + Math.sqrt(capturedCount) * 0.8);
                    const coreSize = r * (1 + Math.sin(t / 150) * 0.1) * 3;
                    window.EffectController.drawSprite(this.ctx, this.spriteCache.core[hueIndex], interact.x, interact.y, coreSize, t * 0.001, 1.0);
                    this.ctx.fillStyle = `hsla(${hue}, 100%, 95%, 1)`;
                    this.ctx.beginPath(); this.ctx.arc(interact.x, interact.y, r, 0, Math.PI * 2); this.ctx.fill();
                }

                const isUIHidden = !window.EffectController.contentVisible;
                if (isUIHidden) {
                    if (isEscPressed) this.refillStep();

                    if (!this.gameActive) {
                        this.gameActive = true; this.runValid = true; this.startTime = t; this.elapsedTime = 0;
                    }

                    const currentPercent = Math.round((capturedCount / this.totalInitialCount) * 100);
                    let currentScore = 0;

                    if (this.runValid) {
                        const nowElapsed = (t - this.startTime) / 1000;
                        if (nowElapsed <= 999) {
                            this.elapsedTime = nowElapsed;
                            currentScore = capturedCount / (this.elapsedTime || 1);
                        } else { this.elapsedTime = 999; }
                    }

                    if (ratio >= 1.0 && this.runValid && this.elapsedTime > 0.5) {
                        const finalScore = this.totalInitialCount / (this.elapsedTime || 1);
                        this.lastRecord = { score: finalScore };
                        if (finalScore > this.bestRecord.score) {
                            this.bestRecord = { score: finalScore, captured: this.totalInitialCount, time: this.elapsedTime };
                            localStorage.setItem('ntsaa_singularity_best_v2', JSON.stringify(this.bestRecord));
                        }
                        this.startTime = t; this.elapsedTime = 0;
                    }

                    if (interact.isR && interact.rDownTime > 0) {
                        if (t - interact.rDownTime > 2000) {
                            this.bestRecord = { score: 0, captured: 0, time: Infinity, percent: 0 };
                            this.lastRecord = { score: 0 };
                            localStorage.removeItem('ntsaa_singularity_best_v2');
                            interact.rDownTime = 0; 
                        }
                    }

                    const displayTime = this.elapsedTime >= 999 ? "999.00s+" : this.elapsedTime.toFixed(2) + "s";
                    const currentStats = `${capturedCount}/${this.totalInitialCount} (${currentPercent}%) [${displayTime}]`;
                    
                    const lastResultDisplay = this.lastRecord.score > 0 ? ` | ⚡ ${this.lastRecord.score.toFixed(2)} pts/s` : "";
                    
                    const noneLabel = window.getTranslation('none');
                    const bestDisplay = this.bestRecord.score > 0 
                        ? `🏆 ${this.bestRecord.score.toFixed(2)} pts/s` 
                        : `🏆 ${noneLabel}`;
                    
                    window.EffectController.updateStats(`${currentStats}${lastResultDisplay} | ${bestDisplay}`);
                } else {
                    this.gameActive = false; this.runValid = false;
                    const percent = Math.round((capturedCount / this.totalInitialCount) * 100);
                    window.EffectController.updateStats(`${capturedCount} / ${this.totalInitialCount} (${percent}%)`);
                }
            }
            this.animationId = requestAnimationFrame((t) => this.animate(t));
        }
    };

    window.EffectController.register("singularity", singularityEffect);
})();