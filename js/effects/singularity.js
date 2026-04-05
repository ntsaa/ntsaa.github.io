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
        touchStartHandler: null,
        touchMoveHandler: null,
        touchEndHandler: null,

        running: false,

        w: 0,
        h: 0,
        DPR: window.devicePixelRatio || 1,

        mouse: { x: null, y: null, radius: 110 },

        captureRadius: 18,

        burstRatio: 0.75, // 75% hạt bị hút thì nổ
        dangerRatio: 0.7, // 70% là bắt đầu rung lắc
        burstThreshold: 0,
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

            this.touchStartHandler = e => {
                if (e.touches.length > 0) {
                    this.mouse.x = e.touches[0].clientX;
                    this.mouse.y = e.touches[0].clientY;
                }
            };

            this.touchMoveHandler = e => {
                if (e.touches.length > 0) {
                    this.mouse.x = e.touches[0].clientX;
                    this.mouse.y = e.touches[0].clientY;
                }
                // Ngăn scroll khi đang nghịch hiệu ứng
                if (e.cancelable) e.preventDefault();
            };

            this.touchEndHandler = () => {
                // Nếu đang hút hạt, nhả tay ra là kích nổ luôn (Release to Burst)
                if (this.singularities.some(p => p.captured)) {
                    this.triggerBurst();
                }
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
            
            // Hỗ trợ Mobile
            window.addEventListener('touchstart', this.touchStartHandler, { passive: false });
            window.addEventListener('touchmove', this.touchMoveHandler, { passive: false });
            window.addEventListener('touchend', this.touchEndHandler);

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
            
            window.removeEventListener('touchstart', this.touchStartHandler);
            window.removeEventListener('touchmove', this.touchMoveHandler);
            window.removeEventListener('touchend', this.touchEndHandler);

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
            
            // Re-init particles on significant resize to maintain density
            if (this.singularities.length > 0) this.initSingularity();
        },

        initSingularity() {

            const isMobile = this.w < 600;
            const count = isMobile ? 60 : 160; 
            this.singularities = [];

            for (let i = 0; i < count; i++) {
                this.singularities.push(this.createParticle());
            }

            this.burstThreshold = Math.floor(count * this.burstRatio);
        },

        createParticle() {

            const baseSpeed = 0.5 + Math.random() * 0.5;
            const angle = Math.random() * Math.PI * 2;

            return {
                x: Math.random() * this.w,
                y: Math.random() * this.h,
                vx: Math.cos(angle) * baseSpeed,
                vy: Math.sin(angle) * baseSpeed,
                baseSpeed,
                r: 1 + Math.random() * 1.5,
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

                const delay = Math.random() * 600;

                const t = setTimeout(() => {

                    const angle = Math.random() * Math.PI * 2;
                    const speed = 7 + Math.random() * 8;

                    p.vx = Math.cos(angle) * speed;
                    p.vy = Math.sin(angle) * speed;

                    p.captured = false;
                    p.bursting = true;
                    p.immuneUntil = Date.now() + 3000;

                }, delay);

                this.timeouts.push(t);
            });

            this.timeouts.push(setTimeout(() => {
                this.burstCooldown = false;
            }, 1000));
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

            let capturedCount = 0;

            for (let i = 0; i < this.singularities.length; i++) {
                const p = this.singularities[i];

                if (p.bursting) {
                    p.vx *= 0.982;
                    p.vy *= 0.982;
                    if (Math.hypot(p.vx, p.vy) < p.baseSpeed * 1.2) {
                        p.bursting = false;
                    }
                }

                if (
                    this.mouse.x !== null &&
                    !p.captured &&
                    !p.bursting &&
                    now > p.immuneUntil &&
                    !this.burstCooldown
                ) {
                    const dx = this.mouse.x - p.x;
                    const dy = this.mouse.y - p.y;
                    const distSq = dx * dx + dy * dy;
                    const mouseRadiusSq = this.mouse.radius * this.mouse.radius;

                    if (distSq < mouseRadiusSq) {
                        const dist = Math.sqrt(distSq);
                        const pull = 1 - dist / this.mouse.radius;
                        const strength = 0.001 + Math.pow(pull, 3) * 0.01;

                        p.vx += dx * strength;
                        p.vy += dy * strength;

                        if (dist < this.captureRadius) {
                            p.captured = true;
                            p.vx = 0; p.vy = 0;
                        }
                    }
                }

                if (p.captured) {
                    capturedCount++;
                    // FIX: Chỉ gán nếu mouse khác null để tránh làm hạt bay ra ngoài vũ trụ
                    if (this.mouse.x !== null) {
                        p.x = this.mouse.x;
                        p.y = this.mouse.y;
                    }
                } else {
                    p.x += p.vx;
                    p.y += p.vy;

                    if (p.x <= 0 || p.x >= this.w) p.vx *= -1;
                    if (p.y <= 0 || p.y >= this.h) p.vy *= -1;

                    this.normalizeSpeed(p);

                    this.ctx.beginPath();
                    this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                    this.ctx.fillStyle = `hsla(${hue}, 80%, 75%, 0.7)`;
                    this.ctx.fill();
                }

                if (!p.captured) {
                    for (let j = i + 1; j < this.singularities.length; j++) {
                        const p2 = this.singularities[j];
                        if (p2.captured) continue;

                        const dx = p.x - p2.x;
                        const dy = p.y - p2.y;
                        const distSq = dx * dx + dy * dy;
                        if (distSq < maxDist * maxDist) {
                            const dist = Math.sqrt(distSq);
                            this.ctx.beginPath();
                            this.ctx.moveTo(p.x, p.y);
                            this.ctx.lineTo(p2.x, p2.y);
                            this.ctx.strokeStyle = `hsla(${hue}, 80%, 70%, ${(1 - dist / maxDist) * 0.25})`;
                            this.ctx.lineWidth = 0.6;
                            this.ctx.stroke();
                        }
                    }
                }
            }

            if (capturedCount >= this.burstThreshold && !this.burstCooldown) {
                this.triggerBurst();
            }

            if (capturedCount > 0 && this.mouse.x !== null) {
                
                const isDanger = capturedCount >= (this.singularities.length * this.dangerRatio);
                
                let coreX = this.mouse.x;
                let coreY = this.mouse.y;

                if (isDanger && !this.burstCooldown) {
                    const shakeIntensity = (capturedCount / this.singularities.length) * 5;
                    coreX += (Math.random() - 0.5) * shakeIntensity;
                    coreY += (Math.random() - 0.5) * shakeIntensity;
                }

                const coreRadius = Math.min(16, 2 + Math.pow(capturedCount, 0.5) * 0.5);
                const glowRadius = coreRadius * (2.5 + (isDanger ? Math.sin(now / 50) * 0.5 : 0));

                const coreHue = isDanger ? 0 : hue; 
                const coreSat = isDanger ? 100 : 80;

                const gradient = this.ctx.createRadialGradient(
                    coreX, coreY, 0,
                    coreX, coreY, glowRadius
                );

                gradient.addColorStop(0, `hsla(${coreHue}, ${coreSat}%, 80%, 0.95)`);
                gradient.addColorStop(0.4, `hsla(${coreHue}, ${coreSat}%, 70%, 0.6)`);
                gradient.addColorStop(1, `hsla(${coreHue}, ${coreSat}%, 70%, 0)`);

                this.ctx.fillStyle = gradient;
                this.ctx.beginPath();
                this.ctx.arc(coreX, coreY, glowRadius, 0, Math.PI * 2);
                this.ctx.fill();

                this.ctx.beginPath();
                this.ctx.arc(coreX, coreY, coreRadius, 0, Math.PI * 2);
                this.ctx.fillStyle = `hsla(${coreHue}, ${coreSat}%, 90%, 0.95)`;
                this.ctx.fill();
            }

            this.animationId = requestAnimationFrame(() => this.animate());
        }

    };

    window.EffectController.register("singularity", singularityEffect);

})();
