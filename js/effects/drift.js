// driftEffect.js
(function () {

    const driftEffect = {

        animationId: null,
        canvas: null,
        ctx: null,

        particles: [],
        pulses: [],

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

        start() {
            if (this.animationId) return;

            this.canvas = document.getElementById('network');
            if (!this.canvas) return;

            this.ctx = this.canvas.getContext('2d');
            this.ctx.imageSmoothingEnabled = true;

            this.resizeHandler = () => this.resize();
            window.addEventListener('resize', this.resizeHandler);

            this.moveHandler = e => {
                this.mouseX = e.clientX;
                this.mouseY = e.clientY;
                this.hasMouse = true;
            };

            this.clickHandler = e => {
                this.pulses.push({
                    x: e.clientX,
                    y: e.clientY,
                    radius: 0,
                    max: 160
                });
            };

            window.addEventListener('mousemove', this.moveHandler);
            window.addEventListener('click', this.clickHandler);

            this.resize();
            this.initParticles();
            this.animate();
        },

        stop() {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;

            window.removeEventListener('resize', this.resizeHandler);
            window.removeEventListener('mousemove', this.moveHandler);
            window.removeEventListener('click', this.clickHandler);

            this.particles = [];
            this.pulses = [];

            if (this.ctx) this.ctx.clearRect(0, 0, this.w, this.h);
        },

        resize() {
            this.canvas.style.width = window.innerWidth + 'px';
            this.canvas.style.height = window.innerHeight + 'px';

            this.canvas.width = Math.floor(window.innerWidth * this.DPR);
            this.canvas.height = Math.floor(window.innerHeight * this.DPR);

            this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);

            this.w = window.innerWidth;
            this.h = window.innerHeight;
            this.isMobile = this.w < 600;
        },

        createParticle() {
            return {
                x: Math.random() * this.w,
                y: Math.random() * this.h,
                size: Math.random() * 1.2 + 0.3,
                speedX: (Math.random() - 0.5) * 1.4,
                speedY: (Math.random() - 0.5) * 1.4,
                hueOffset: Math.random() * 360,
                depth: Math.random()
            };
        },

        initParticles() {
            const area = this.w * this.h;
            const count = Math.min(420, Math.floor(area / 3500));
            this.particles = [];

            for (let i = 0; i < count; i++) {
                this.particles.push(this.createParticle());
            }
        },

        updateParticle(p) {

            // drift organic nhẹ (không làm đơ)
            p.speedX += (Math.random() - 0.5) * 0.05;
            p.speedY += (Math.random() - 0.5) * 0.05;

            // giới hạn tốc độ
            const max = 1.4;
            if (p.speedX > max) p.speedX = max;
            if (p.speedX < -max) p.speedX = -max;
            if (p.speedY > max) p.speedY = max;
            if (p.speedY < -max) p.speedY = -max;

            // parallax depth
            const depthFactor = 0.6 + p.depth * 0.6;
            p.x += p.speedX * depthFactor;
            p.y += p.speedY * depthFactor;

            // repel chuột (không sqrt)
            if (this.hasMouse) {
                const dx = p.x - this.mouseX;
                const dy = p.y - this.mouseY;
                const dist2 = dx * dx + dy * dy;

                if (dist2 < 14400) {
                    const force = (14400 - dist2) / 14400;
                    p.x += dx * force * 0.55;
                    p.y += dy * force * 0.55;
                }
            }

            // wrap screen
            if (p.x < 0) p.x = this.w;
            if (p.x > this.w) p.x = 0;
            if (p.y < 0) p.y = this.h;
            if (p.y > this.h) p.y = 0;
        },

        updatePulses() {
            for (let pulse of this.pulses) {
                pulse.radius += 6;

                for (let p of this.particles) {
                    const dx = p.x - pulse.x;
                    const dy = p.y - pulse.y;
                    const dist2 = dx * dx + dy * dy;

                    if (dist2 < pulse.radius * pulse.radius &&
                        dist2 > (pulse.radius - 25) * (pulse.radius - 25)) {

                        const dist = Math.sqrt(dist2) || 1;
                        p.x += dx / dist * 8;
                        p.y += dy / dist * 8;
                    }
                }
            }

            this.pulses = this.pulses.filter(p => p.radius < p.max);
        },

        drawPulses() {
            for (let pulse of this.pulses) {
                const alpha = 1 - pulse.radius / pulse.max;

                this.ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.35})`;
                this.ctx.lineWidth = 2;

                this.ctx.beginPath();
                this.ctx.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2);
                this.ctx.stroke();
            }
        },

        drawParticle(p) {

            let light = 70;
            let alpha = 0.5;

            if (this.hasMouse) {
                const dx = p.x - this.mouseX;
                const dy = p.y - this.mouseY;
                const dist2 = dx * dx + dy * dy;

                if (dist2 < 8100) {
                    light = 92;
                    alpha = 0.9;
                }
            }

            const hue = (Date.now() / 50 + p.hueOffset) % 360;
            const color = `hsla(${hue}, 80%, ${light}%, ${alpha})`;

            this.ctx.fillStyle = color;

            if (!this.isMobile) {
                this.ctx.shadowBlur = p.size * 2;
                this.ctx.shadowColor = color;
            }

            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.shadowBlur = 0;
        },

        animate() {

            this.ctx.fillStyle = this.isMobile
                ? 'rgba(0,0,0,0.08)'
                : 'rgba(0,0,0,0.05)';

            this.ctx.fillRect(0, 0, this.w, this.h);

            for (let p of this.particles) {
                this.updateParticle(p);
                this.drawParticle(p);
            }

            this.updatePulses();
            this.drawPulses();

            this.animationId = requestAnimationFrame(() => this.animate());
        }

    };

    window.EffectController.register("drift", driftEffect);

})();