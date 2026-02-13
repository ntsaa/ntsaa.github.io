// singularity.js
(function () {

    const singularityEffect = {

        animationId: null,
        canvas: null,
        ctx: null,
        singularities: [],
        timeouts: [],

        resizeHandler: null,
        mouseMoveHandler: null,
        mouseLeaveHandler: null,
        clickHandler: null,

        running: false,

        w: 0,
        h: 0,
        DPR: window.devicePixelRatio || 1,

        mouse: { x: null, y: null, radius: 110 },

        captureRadius: 18,

        burstThreshold: 100,
        burstCooldown: false,

        start() {

            if (this.running) return;
            this.running = true;

            this.canvas = document.getElementById('network');
            if (!this.canvas) return;

            this.ctx = this.canvas.getContext('2d');

            this.resizeHandler = () => this.resize();

            this.mouseMoveHandler = e => {
                this.mouse.x = e.clientX;
                this.mouse.y = e.clientY;
            };

            this.mouseLeaveHandler = () => {
                this.mouse.x = null;
                this.mouse.y = null;
            };

            this.clickHandler = () => {
                if (this.mouse.x === null || this.burstCooldown) return;
                if (this.singularities.some(p => p.captured)) {
                    this.triggerBurst();
                }
            };

            window.addEventListener('resize', this.resizeHandler);
            window.addEventListener('mousemove', this.mouseMoveHandler);
            window.addEventListener('mouseleave', this.mouseLeaveHandler);
            window.addEventListener('click', this.clickHandler);

            this.resize();
            this.initSingularity();
            this.animate();
        },

        stop() {

            if (!this.running) return;
            this.running = false;

            cancelAnimationFrame(this.animationId);

            window.removeEventListener('resize', this.resizeHandler);
            window.removeEventListener('mousemove', this.mouseMoveHandler);
            window.removeEventListener('mouseleave', this.mouseLeaveHandler);
            window.removeEventListener('click', this.clickHandler);

            this.timeouts.forEach(t => clearTimeout(t));
            this.timeouts = [];

            this.ctx.clearRect(0, 0, this.w, this.h);

            this.singularities = [];
            this.mouse.x = null;
            this.mouse.y = null;
            this.burstCooldown = false;
        },

        resize() {
            this.canvas.width = innerWidth * this.DPR;
            this.canvas.height = innerHeight * this.DPR;
            this.canvas.style.width = innerWidth + 'px';
            this.canvas.style.height = innerHeight + 'px';

            this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);

            this.w = innerWidth;
            this.h = innerHeight;
        },

        initSingularity() {

            const count = innerWidth < 600 ? 80 : 190;
            this.singularities = [];

            for (let i = 0; i < count; i++) {
                this.singularities.push(this.createParticle());
            }
        },

        createParticle() {

            const baseSpeed = 0.6 + Math.random() * 0.4;
            const angle = Math.random() * Math.PI * 2;

            return {
                x: Math.random() * this.w,
                y: Math.random() * this.h,
                vx: Math.cos(angle) * baseSpeed,
                vy: Math.sin(angle) * baseSpeed,
                baseSpeed,
                r: 1 + Math.random() * 1.2,
                captured: false,
                immuneUntil: 0,
                bursting: false
            };
        },

        triggerBurst() {

            if (this.burstCooldown) return;

            const captured = this.singularities.filter(p => p.captured);
            if (!captured.length) return;

            this.burstCooldown = true;

            captured.forEach(p => {

                const delay = Math.random() * 800;

                const t = setTimeout(() => {

                    const angle = Math.random() * Math.PI * 2;
                    const speed = 8 + Math.random() * 6;

                    p.vx = Math.cos(angle) * speed;
                    p.vy = Math.sin(angle) * speed;

                    p.captured = false;
                    p.bursting = true;
                    p.immuneUntil = Date.now() + 5000;

                }, delay);

                this.timeouts.push(t);
            });

            this.timeouts.push(setTimeout(() => {
                this.burstCooldown = false;
            }, 1200));
        },

        normalizeSpeed(p) {

            const speed = Math.hypot(p.vx, p.vy);
            if (!speed) return;

            const diff = p.baseSpeed - speed;

            p.vx += (p.vx / speed) * diff * 0.02;
            p.vy += (p.vy / speed) * diff * 0.02;
        },

        animate() {

            if (!this.running) return;

            this.ctx.clearRect(0, 0, this.w, this.h);

            const hue = (Date.now() / 60) % 360;
            const maxDist = innerWidth < 600 ? 70 : 110;

            let capturedCount = 0;

            for (const p of this.singularities) {

                if (p.bursting) {
                    p.vx *= 0.986;
                    p.vy *= 0.986;
                    if (Math.hypot(p.vx, p.vy) < p.baseSpeed * 1.2) {
                        p.bursting = false;
                    }
                }

                if (
                    this.mouse.x !== null &&
                    !p.captured &&
                    !p.bursting &&
                    Date.now() > p.immuneUntil &&
                    !this.burstCooldown
                ) {
                    const dx = this.mouse.x - p.x;
                    const dy = this.mouse.y - p.y;
                    const dist = Math.hypot(dx, dy);

                    if (dist < this.mouse.radius) {

                        const pull = 1 - dist / this.mouse.radius;
                        const strength = 0.001 + Math.pow(pull, 3) * 0.009;

                        p.vx += dx * strength;
                        p.vy += dy * strength;

                        if (dist < this.captureRadius) {
                            p.captured = true;
                            p.x = this.mouse.x;
                            p.y = this.mouse.y;
                            p.vx = 0;
                            p.vy = 0;
                        }
                    }
                }

                if (p.captured) {
                    capturedCount++;
                    p.x = this.mouse.x;
                    p.y = this.mouse.y;
                } else {
                    p.x += p.vx;
                    p.y += p.vy;
                }

                if (!p.captured && !p.bursting) {
                    this.normalizeSpeed(p);
                }

                if (p.x <= 0 || p.x >= this.w) p.vx *= -1;
                if (p.y <= 0 || p.y >= this.h) p.vy *= -1;

                // chỉ vẽ particle khi chưa bị hút
                if (!p.captured) {
                    this.ctx.beginPath();
                    this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                    this.ctx.fillStyle = `hsla(${hue},80%,70%,0.6)`;
                    this.ctx.fill();
                }
            }

            if (capturedCount >= this.burstThreshold && !this.burstCooldown) {
                this.triggerBurst();
            }

            // ===== ENERGY CORE =====
            if (capturedCount > 0 && this.mouse.x !== null) {

                const coreRadius = Math.min(14, 2 + Math.pow(capturedCount, 0.5) * 0.45);
                const glowRadius = coreRadius * 2.3;

                const gradient = this.ctx.createRadialGradient(
                    this.mouse.x, this.mouse.y, 0,
                    this.mouse.x, this.mouse.y, glowRadius
                );

                gradient.addColorStop(0, `hsla(${hue},80%,80%,0.95)`);
                gradient.addColorStop(0.4, `hsla(${hue},80%,70%,0.55)`);
                gradient.addColorStop(1, `hsla(${hue},80%,70%,0)`);

                this.ctx.fillStyle = gradient;
                this.ctx.beginPath();
                this.ctx.arc(this.mouse.x, this.mouse.y, glowRadius, 0, Math.PI * 2);
                this.ctx.fill();

                // lõi sáng trung tâm
                this.ctx.beginPath();
                this.ctx.arc(this.mouse.x, this.mouse.y, coreRadius, 0, Math.PI * 2);
                this.ctx.fillStyle = `hsla(${hue},90%,85%,0.95)`;
                this.ctx.fill();
            }

            // connections
            for (let i = 0; i < this.singularities.length; i++) {
                for (let j = i + 1; j < this.singularities.length; j++) {

                    const a = this.singularities[i];
                    const b = this.singularities[j];
                    const d = Math.hypot(a.x - b.x, a.y - b.y);

                    if (d < maxDist) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(a.x, a.y);
                        this.ctx.lineTo(b.x, b.y);
                        this.ctx.strokeStyle = `hsla(${hue},80%,70%,${(1 - d / maxDist) * 0.25})`;
                        this.ctx.lineWidth = 0.8;
                        this.ctx.stroke();
                    }
                }
            }

            this.animationId = requestAnimationFrame(() => this.animate());
        }

    };

    window.EffectController.register("singularity", singularityEffect);

})();