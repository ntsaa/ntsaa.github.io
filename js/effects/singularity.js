// singularity.js
(function () {

    const singularityEffect = {

        animationId: null,
        canvas: null,
        ctx: null,
        singularities: [], 
        absorbedPool: [],  
        timeouts: [],
        resizeTimeout: null,

        running: false,
        w: 0,
        h: 0,
        DPR: window.devicePixelRatio || 1,

        mouse: { x: null, y: null, radius: 85 }, 
        captureRadius: 12, 

        burstRatio: 0.9,   
        criticalRatio: 0.8, 
        dangerRatio: 0.7,   
        
        totalInitialCount: 0,
        burstCooldown: false,

        start() {
            if (this.running) return;
            this.running = true;

            this.canvas = document.getElementById('network');
            if (!this.canvas) return;
            this.ctx = this.canvas.getContext('2d');

            window.EffectController.resetCanvasContext(this.ctx);

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
                if (e.cancelable) e.preventDefault();
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
            window.addEventListener('touchstart', this.touchStartHandler, { passive: false });
            window.addEventListener('touchmove', this.touchMoveHandler, { passive: false });
            window.addEventListener('touchend', this.touchEndHandler);

            this.resize(true); 
            this.animate();
        },

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
            this.ctx.clearRect(0, 0, this.w, this.h);
            this.singularities = [];
            this.absorbedPool = [];
            this.mouse.x = null;
            this.mouse.y = null;
            this.burstCooldown = false;
        },

        resize(isInitial = false) {
            this.w = innerWidth;
            this.h = innerHeight;
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
                    this.singularities.push(this.spawnFromEdge());
                }
                this.resizeTimeout = setTimeout(() => this.refillStep(), 800);
            }
        },

        initSingularity() {
            this.singularities = [];
            this.absorbedPool = [];
            for (let i = 0; i < this.totalInitialCount; i++) {
                this.singularities.push(this.createParticle());
            }
        },

        createParticle() {
            const baseSpeed = 0.5 + Math.random() * 0.5;
            const angle = Math.random() * Math.PI * 2;
            const r = 1 + Math.random() * 1.5;
            return {
                x: Math.random() * this.w,
                y: Math.random() * this.h,
                vx: Math.cos(angle) * baseSpeed,
                vy: Math.sin(angle) * baseSpeed,
                baseSpeed, r, 
                isSuper: false,
                bursting: false
            };
        },

        spawnFromEdge() {
            const side = Math.floor(Math.random() * 4);
            let x, y, vx, vy;
            const speed = 0.5 + Math.random() * 0.5;
            const offset = 50;

            if (side === 0) { x = -offset; y = Math.random() * this.h; vx = speed; vy = (Math.random()-0.5)*speed; } 
            else if (side === 1) { x = this.w + offset; y = Math.random() * this.h; vx = -speed; vy = (Math.random()-0.5)*speed; } 
            else if (side === 2) { x = Math.random() * this.w; y = -offset; vx = (Math.random()-0.5)*speed; vy = speed; } 
            else { x = Math.random() * this.w; y = this.h + offset; vx = (Math.random()-0.5)*speed; vy = -speed; } 

            return {
                x, y, vx, vy,
                baseSpeed: speed,
                r: 1 + Math.random() * 1.5,
                isSuper: false,
                bursting: false
            };
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
                    const angle = Math.random() * Math.PI * 2;
                    
                    p.isSuper = Math.random() < 0.3; // 30% hạt siêu thanh
                    const speed = p.isSuper ? (20 + Math.random() * 15) : (8 + Math.random() * 10);
                    
                    p.x = bx; p.y = by;
                    p.vx = Math.cos(angle) * speed;
                    p.vy = Math.sin(angle) * speed;
                    p.bursting = true;
                    this.singularities.push(p);
                }, delay);
                this.timeouts.push(t);
            });

            this.timeouts.push(setTimeout(() => { this.burstCooldown = false; }, 1000));
        },

        normalizeSpeed(p) {
            const speed = Math.hypot(p.vx, p.vy);
            if (!speed) return;
            const diff = p.baseSpeed - speed;
            p.vx += (p.vx / speed) * diff * 0.03;
            p.vy += (p.vy / speed) * diff * 0.03;
        },

        animate() {
            if (!this.running) return;
            this.ctx.clearRect(0, 0, this.w, this.h);

            const now = Date.now();
            const hue = (now / 60) % 360;
            const maxDist = this.w < 600 ? 60 : 100;

            const capturedCount = this.absorbedPool.length;
            const currentRatio = capturedCount / this.totalInitialCount;
            const isDanger = currentRatio >= this.dangerRatio;
            const isCritical = currentRatio >= this.criticalRatio;

            let coreHue = hue;
            let coreSat = 80;
            if (isCritical) { coreHue = 0; coreSat = 100; } 
            else if (isDanger) { coreHue = 30; coreSat = 95; } 

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
                            this.absorbedPool.push(p);
                            this.singularities.splice(i, 1);
                            continue;
                        }
                    }
                }

                p.x += p.vx;
                p.y += p.vy;

                const isOutside = p.x < -100 || p.x > this.w + 100 || p.y < -100 || p.y > this.h + 100;
                if (isOutside && (this.singularities.length + this.absorbedPool.length) > this.totalInitialCount) {
                    this.singularities.splice(i, 1);
                    continue;
                }

                if (p.x <= 0) { p.x = 0; p.vx = Math.abs(p.vx); }
                else if (p.x >= this.w) { p.x = this.w; p.vx = -Math.abs(p.vx); }
                if (p.y <= 0) { p.y = 0; p.vy = Math.abs(p.vy); }
                else if (p.y >= this.h) { p.y = this.h; p.vy = -Math.abs(p.vy); }

                this.normalizeSpeed(p);

                // Vẽ hạt: Hạt siêu thanh (bursting & isSuper) nhìn sẽ nhỏ và sắc hơn
                const drawR = (p.bursting && p.isSuper) ? p.r * 0.8 : p.r;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, drawR, 0, Math.PI * 2);
                this.ctx.fillStyle = p.bursting 
                    ? `hsla(${coreHue}, ${coreSat}%, 85%, 0.85)` 
                    : `hsla(${hue}, 80%, 75%, 0.7)`;
                this.ctx.fill();
            }

            // --- Tối ưu: Gom nhóm lệnh vẽ đường nối và giới hạn liên kết (6) ---
            this.ctx.beginPath();
            this.ctx.lineWidth = 0.6;
            this.ctx.strokeStyle = `hsla(${hue}, 80%, 70%, 0.15)`;
            
            const maxDistSq = maxDist * maxDist;
            for (let i = 0; i < this.singularities.length; i++) {
                const p = this.singularities[i];
                let connections = 0;
                for (let j = i + 1; j < this.singularities.length; j++) {
                    if (connections >= 6) break; // Giới hạn 6 liên kết để tránh rối mắt và lag khi tụ lại

                    const p2 = this.singularities[j];
                    const dx = p.x - p2.x;
                    const dy = p.y - p2.y;
                    const d2 = dx * dx + dy * dy;

                    if (d2 < maxDistSq) {
                        this.ctx.moveTo(p.x, p.y);
                        this.ctx.lineTo(p2.x, p2.y);
                        connections++;
                    }
                }
            }
            this.ctx.stroke();
            // ----------------------------------------------------------

            if (currentRatio >= this.burstRatio) this.triggerBurst();

            if (capturedCount > 0 && this.mouse.x !== null) {
                let cx = this.mouse.x, cy = this.mouse.y;
                if (isDanger) {
                    const s = currentRatio * 3.5; 
                    cx += (Math.random() - 0.5) * s;
                    cy += (Math.random() - 0.5) * s;
                }
                const comp = 1 - (currentRatio * 0.45);
                const r = Math.min(16, (2 + Math.pow(capturedCount, 0.5) * 0.6) * comp);
                const pulse = Math.sin(now / 200) * 0.5;
                const gr = r * (2.5 + (isDanger ? pulse : 0));

                const grad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, gr);
                grad.addColorStop(0, `hsla(${coreHue}, ${coreSat}%, 85%, 0.95)`);
                grad.addColorStop(0.4, `hsla(${coreHue}, ${coreSat}%, 70%, 0.6)`);
                grad.addColorStop(1, `hsla(${coreHue}, ${coreSat}%, 70%, 0)`);

                this.ctx.fillStyle = grad;
                this.ctx.beginPath();
                this.ctx.arc(cx, cy, gr, 0, Math.PI * 2);
                this.ctx.fill();

                this.ctx.beginPath();
                this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
                this.ctx.fillStyle = `hsla(${coreHue}, ${coreSat}%, 90%, 0.95)`;
                this.ctx.fill();
            }

            this.animationId = requestAnimationFrame(() => this.animate());
        }
    };

    window.EffectController.register("singularity", singularityEffect);
})();
