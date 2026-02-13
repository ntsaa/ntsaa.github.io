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

        mouseRadius: 120,
        running: false,

        start() {
            if (this.running) return;
            this.running = true;

            this.canvas = document.getElementById('network');
            if (!this.canvas) return;

            this.ctx = this.canvas.getContext('2d');

            this.resizeHandler = () => this.resize();
            window.addEventListener('resize', this.resizeHandler);

            this.moveHandler = e => {
                this.mouseX = e.clientX;
                this.mouseY = e.clientY;
                this.hasMouse = true;
            };

            this.clickHandler = e => this.createWell(e.clientX, e.clientY);

            window.addEventListener('mousemove', this.moveHandler);
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
            window.removeEventListener('mousemove', this.moveHandler);
            window.removeEventListener('click', this.clickHandler);

            this.singularities = [];
            this.fragments = [];
            this.wells = [];

            if (this.ctx) this.ctx.clearRect(0, 0, this.w, this.h);
        },

        resize() {
            this.canvas.style.width = innerWidth + 'px';
            this.canvas.style.height = innerHeight + 'px';

            this.canvas.width = innerWidth * this.DPR;
            this.canvas.height = innerHeight * this.DPR;

            this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);

            this.w = innerWidth;
            this.h = innerHeight;
            this.isMobile = this.w < 600;
        },

        // ⭐ size tuned: nhỏ hơn bản mới, lớn hơn bản cũ
        createParticle() {
            const raw = Math.random() * 1.2 + 0.35;

            return {
                x: Math.random() * this.w,
                y: Math.random() * this.h,
                size: Math.max(raw, 0.65),
                speedX: (Math.random() - 0.5) * 1.2,
                speedY: (Math.random() - 0.5) * 1.2,
                hueOffset: Math.random() * 360,
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

            const raw = Math.pow(Math.random(), 0.7) * 1.2 + 0.35;

            return {
                x, y,
                size: Math.max(raw, 0.65),
                speedX: (Math.random() - 0.5) * 1.2,
                speedY: (Math.random() - 0.5) * 1.2,
                hueOffset: Math.random() * 360,
                depth: Math.random()
            };
        },

        // ⭐ mật độ động theo màn hình
        initSingularity() {

            const area = this.w * this.h;
            const density = this.isMobile ? 1 / 4200 : 1 / 3200;
            const count = Math.min(900, Math.floor(area * density));

            this.initCount = count;
            this.singularities = [];

            for (let i = 0; i < count; i++) {
                this.singularities.push(this.createParticle());
            }
        },

        createWell(x, y) {
            // ⭐ vortex hút
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
                            hue: (Date.now() / 50 + p.hueOffset) % 360
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

            // ⭐ lực hút vortex (ưu tiên cao nhất)
            for (let w of this.wells) {
                const dx = w.x - p.x;
                const dy = w.y - p.y;
                const d2 = dx * dx + dy * dy;

                if (d2 < w.radius * w.radius) {
                    insideWell = true;

                    const dist = Math.sqrt(d2) || 1;

                    // hút mạnh dần về tâm
                    const pull = 0.02 + (1 - dist / w.radius) * 0.05;

                    p.x += dx * pull;
                    p.y += dy * pull;
                }
            }

            // ⭐ đẩy chuột chỉ khi không nằm trong vùng hút
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

            // giảm boost → tránh đuôi dài
            const sizeBoost = 1 + p.size * 0.045;

            p.x += p.speedX * depth * sizeBoost;
            p.y += p.speedY * depth * sizeBoost;

            if (p.x < 0) p.x = this.w;
            if (p.x > this.w) p.x = 0;
            if (p.y < 0) p.y = this.h;
            if (p.y > this.h) p.y = 0;
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

            const hue = (Date.now() / 50 + p.hueOffset) % 360;
            const color = `hsla(${hue},80%,70%,0.7)`;

            this.ctx.fillStyle = color;
            this.ctx.shadowBlur = p.size * 1.8;
            this.ctx.shadowColor = color;

            const speed = Math.hypot(p.speedX, p.speedY);

            // đuôi mềm như bản cũ
            const stretch = 1 + (speed / (speed + 2.2)) * 0.18;

            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate(Math.atan2(p.speedY, p.speedX));

            this.ctx.beginPath();
            this.ctx.ellipse(0, 0, p.size * stretch, p.size, 0, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.restore();
            this.ctx.shadowBlur = 0;
        },

        drawFragments() {
            for (let f of this.fragments) {
                const a = f.life / f.lifeMax;
                this.ctx.fillStyle = `hsla(${f.hue},80%,70%,${a})`;
                this.ctx.beginPath();
                this.ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
                this.ctx.fill();
            }
        },

        animate() {

            if (!this.running) return;

            // trail mềm như bản cũ
            const fade = this.isMobile ? 0.09 : 0.055;

            this.ctx.fillStyle = `rgba(0,0,0,${fade})`;
            this.ctx.fillRect(0, 0, this.w, this.h);

            for (let p of this.singularities) {
                this.updateParticle(p);
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