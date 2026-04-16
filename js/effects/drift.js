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
        DPR: window.devicePixelRatio || 1,
        isMobile: false,
        initCount: 0,
        particleCache: null, 

        mouseRadius: 120,
        running: false,
        resizeTimeout: null,

        start() {
            if (this.running) return;
            this.running = true;

            this.canvas = document.getElementById('network');
            if (!this.canvas) return;

            this.ctx = this.canvas.getContext('2d');

            window.EffectController.resetCanvasContext(this.ctx);

            this.initCache();

            this.resizeHandler = () => this.resize();
            window.addEventListener('resize', this.resizeHandler);

            this.moveHandler = e => {
                if (window.EffectController.isUIElement(e.target)) {
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

            this.leaveHandler = () => { this.hasMouse = false; };

            window.addEventListener('mousemove', this.moveHandler);
            window.addEventListener('click', this.clickHandler);
            window.addEventListener('mouseleave', this.leaveHandler);
            
            // Hỗ trợ Touch với passive: true để vừa scroll vừa tương tác
            window.addEventListener('touchstart', this.moveHandler, { passive: true });
            window.addEventListener('touchmove', this.moveHandler, { passive: true });
            window.addEventListener('touchend', (e) => {
                this.clickHandler(e);
                this.hasMouse = false;
            }, { passive: true });

            this.resize(true);
            this.animate();
        },

        stop() {
            if (!this.running) return;
            this.running = false;

            cancelAnimationFrame(this.animationId);
            clearTimeout(this.resizeTimeout);

            window.removeEventListener('resize', this.resizeHandler);
            window.removeEventListener('mousemove', this.moveHandler);
            window.removeEventListener('click', this.clickHandler);
            window.removeEventListener('mouseleave', this.leaveHandler);
            window.removeEventListener('touchstart', this.moveHandler);
            window.removeEventListener('touchmove', this.moveHandler);
            window.removeEventListener('touchend', this.clickHandler);

            this.singularities = [];
            this.fragments = [];
            this.wells = [];

            if (this.ctx) this.ctx.clearRect(0, 0, this.w, this.h);
        },

        resize(isInitial = false) {
            this.w = window.innerWidth;
            this.h = window.innerHeight;
            this.isMobile = this.w < 600;

            this.canvas.style.width = this.w + 'px';
            this.canvas.style.height = this.h + 'px';

            this.canvas.width = this.w * this.DPR;
            this.canvas.height = this.h * this.DPR;

            this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);

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
                const toAdd = Math.min(3, this.initCount - currentTotal);
                for (let i = 0; i < toAdd; i++) {
                    this.singularities.push(this.spawnFromEdge());
                }
                this.resizeTimeout = setTimeout(() => this.refillStep(), 800);
            }
        },

        initCache() {
            this.particleCache = [];
            // Cache 60 frames màu sắc cho hạt
            for (let i = 0; i < 60; i++) {
                const size = 64; // Tăng độ phân giải cache để sắc nét hơn
                const pCanvas = document.createElement('canvas');
                pCanvas.width = size;
                pCanvas.height = size;
                const pCtx = pCanvas.getContext('2d');
                const hue = i * 6;
                const center = size / 2;
                
                // Gradient sắc nét hơn: đặc ở tâm và mờ nhẹ ở viền cực nhỏ
                const grad = pCtx.createRadialGradient(center, center, 0, center, center, center);
                grad.addColorStop(0, `hsla(${hue}, 90%, 75%, 0.8)`);
                grad.addColorStop(0.8, `hsla(${hue}, 80%, 70%, 0.7)`);
                grad.addColorStop(0.95, `hsla(${hue}, 80%, 70%, 0.1)`);
                grad.addColorStop(1, `hsla(${hue}, 80%, 70%, 0)`);
                
                pCtx.fillStyle = grad;
                pCtx.fillRect(0, 0, size, size);
                this.particleCache.push(pCanvas);
            }
        },

        createParticle() {
            const raw = Math.random() * 0.9 + 0.35;
            return {
                x: Math.random() * this.w,
                y: Math.random() * this.h,
                size: Math.max(raw, 0.65),
                speedX: (Math.random() - 0.5) * 1.2,
                speedY: (Math.random() - 0.5) * 1.2,
                hueIndex: Math.floor(Math.random() * 60),
                depth: Math.random()
            };
        },

        spawnFromEdge() {
            const side = Math.floor(Math.random() * 4);
            let x, y;

            if (side === 0) { x = 0; y = Math.random() * this.h; }
            else if (side === 1) { x = this.w; y = Math.random() * this.h; }
            else if (side === 2) { x = Math.random() * this.w; y = 0; }
            else { x = Math.random() * this.w; y = this.h; }

            const raw = Math.pow(Math.random(), 0.7) * 0.9 + 0.35;

            return {
                x, y,
                size: Math.max(raw, 0.65),
                speedX: (Math.random() - 0.5) * 1.2,
                speedY: (Math.random() - 0.5) * 1.2,
                hueIndex: Math.floor(Math.random() * 60),
                depth: Math.random()
            };
        },

        initSingularity() {
            const area = this.w * this.h;
            const density = this.isMobile ? 1 / 5000 : 1 / 3800;
            const count = Math.max(100, Math.min(600, Math.floor(area * density)));

            this.initCount = count;
            this.singularities = [];

            for (let i = 0; i < count; i++) {
                this.singularities.push(this.createParticle());
            }
        },

        createWell(x, y) {
            this.wells.push({ x, y, life: 320, radius: 140 });
        },

        updateWells() {
            for (let w of this.wells) {
                w.life--;
                if (w.life === 0) this.explodeNear(w.x, w.y, w.radius);
            }
            this.wells = this.wells.filter(w => w.life > 0);
        },

        explodeNear(x, y, radius) {
            const r2 = radius * radius;
            const survivors = [];

            for (let p of this.singularities) {
                const dx = p.x - x;
                const dy = p.y - y;
                const d2 = dx * dx + dy * dy;

                if (d2 < r2) {
                    const strength = 1.2 + p.size * 1.2;
                    const pieces = 3 + Math.floor(p.size * 2);

                    for (let i = 0; i < pieces; i++) {
                        const life = 20 + p.size * 10;
                        this.fragments.push({
                            x: p.x,
                            y: p.y,
                            vx: (Math.random() - 0.5) * strength,
                            vy: (Math.random() - 0.5) * strength,
                            life,
                            lifeMax: life,
                            size: p.size * (Math.random() * 0.6 + 0.4),
                            hueIndex: p.hueIndex
                        });
                    }
                } else survivors.push(p);
            }

            this.singularities = survivors;

            const missing = this.initCount - this.singularities.length;
            for (let i = 0; i < missing; i++) {
                this.singularities.push(this.spawnFromEdge());
            }
        },

        updateParticle(p) {
            p.speedX += (Math.random() - 0.5) * 0.05;
            p.speedY += (Math.random() - 0.5) * 0.05;

            const max = 1.2;
            p.speedX = Math.max(-max, Math.min(max, p.speedX));
            p.speedY = Math.max(-max, Math.min(max, p.speedY));

            let insideWell = false;

            for (let w of this.wells) {
                const dx = w.x - p.x;
                const dy = w.y - p.y;
                const d2 = dx * dx + dy * dy;

                if (d2 < w.radius * w.radius) {
                    insideWell = true;
                    const dist = Math.sqrt(d2) || 1;
                    const pull = 0.02 + (1 - dist / w.radius) * 0.05;
                    p.x += dx * pull;
                    p.y += dy * pull;
                }
            }

            if (this.hasMouse && !insideWell) {
                const dx = p.x - this.mouseX;
                const dy = p.y - this.mouseY;
                const r2 = this.mouseRadius * this.mouseRadius;
                const d2 = dx * dx + dy * dy;

                if (d2 < r2) {
                    const f = (r2 - d2) / r2;
                    p.x += dx * f * 0.55;
                    p.y += dy * f * 0.55;
                }
            }

            const depth = 0.6 + p.depth * 0.6;
            const sizeBoost = 1 + p.size * 0.045;

            p.x += p.speedX * depth * sizeBoost;
            p.y += p.speedY * depth * sizeBoost;

            const isOutside = p.x < -50 || p.x > this.w + 50 || p.y < -50 || p.y > this.h + 50;
            if (isOutside && this.singularities.length > this.initCount) {
                p.toRemove = true;
            } else {
                if (p.x < 0) p.x = this.w;
                if (p.x > this.w) p.x = 0;
                if (p.y < 0) p.y = this.h;
                if (p.y > this.h) p.y = 0;
            }
        },

        updateFragments() {
            for (let f of this.fragments) {
                f.x += f.vx;
                f.y += f.vy;
                f.life--;
            }
            this.fragments = this.fragments.filter(f => f.life > 0);
        },

        drawParticle(p) {
            const speed = Math.hypot(p.speedX, p.speedY);
            const stretch = 1 + (speed / (speed + 2.2)) * 0.18;
            const size = p.size * 1.2; // Tăng nhẹ 20% để hạt trông đầy đặn hơn

            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate(Math.atan2(p.speedY, p.speedX));
            this.ctx.drawImage(this.particleCache[p.hueIndex], -size * stretch, -size, size * stretch * 2, size * 2);
            this.ctx.restore();
        },

        drawFragments() {
            for (let f of this.fragments) {
                const a = f.life / f.lifeMax;
                this.ctx.globalAlpha = a;
                const size = f.size * 1.2; // Đồng bộ kích thước mảnh vỡ
                this.ctx.drawImage(this.particleCache[f.hueIndex || 0], f.x - size, f.y - size, size * 2, size * 2);
            }
            this.ctx.globalAlpha = 1;
        },

        animate() {
            if (!this.running) return;

            this.ctx.globalCompositeOperation = 'destination-out';
            const fade = this.isMobile ? 'rgba(0, 0, 0, 0.15)' : 'rgba(0, 0, 0, 0.1)';
            this.ctx.fillStyle = fade;
            this.ctx.fillRect(0, 0, this.w, this.h);
            this.ctx.globalCompositeOperation = 'source-over';

            for (let i = this.singularities.length - 1; i >= 0; i--) {
                const p = this.singularities[i];
                this.updateParticle(p);
                if (p.toRemove) {
                    this.singularities.splice(i, 1);
                    continue;
                }
                this.drawParticle(p);
            }

            this.updateWells();
            this.updateFragments();
            this.drawFragments();

            this.animationId = requestAnimationFrame(() => this.animate());
        }

    };

    window.EffectController.register("drift", driftEffect);

})();