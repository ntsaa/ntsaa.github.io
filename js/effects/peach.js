// peach.js
(function () {

    const Peach = {

        animationId: null,
        canvas: null,
        ctx: null,
        petals: [],
        resizeHandler: null,
        clickHandler: null,

        w: 0,
        h: 0,
        DPR: window.devicePixelRatio || 1,

        minCount: 40,
        maxCount: 280,
        targetCount: 40,

        spawnRate: 0,
        spawnAccumulator: 0,
        rampSpeed: 12,

        lastFrameTime: 0,
        lastInteraction: 0,
        decayDelay: 1500,
        decaySpeed: 12,
        startTime: 0,

        /* ======================= */

        start() {

            if (this.animationId) return;

            this.canvas = document.getElementById("network");
            if (!this.canvas) return;

            this.ctx = this.canvas.getContext("2d");
            this.ctx.imageSmoothingEnabled = true;

            this.resizeHandler = () => this.resize();
            window.addEventListener("resize", this.resizeHandler);

            this.clickHandler = (e) => this.handleClick(e);
            window.addEventListener("pointerdown", this.clickHandler, { passive: true });

            this.resize();
            this.startTime = performance.now();

            this.petals = [];
            this.spawnRate = 0;
            this.spawnAccumulator = 0;
            this.targetCount = this.minCount;
            this.lastFrameTime = performance.now();

            this.animate();
        },

        stop() {

            cancelAnimationFrame(this.animationId);

            if (this.resizeHandler)
                window.removeEventListener("resize", this.resizeHandler);

            if (this.clickHandler)
                window.removeEventListener("pointerdown", this.clickHandler);

            if (this.ctx)
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            this.petals = [];
            this.animationId = null;
        },

        resize() {

            this.canvas.style.width = window.innerWidth + "px";
            this.canvas.style.height = window.innerHeight + "px";

            this.canvas.width = Math.floor(window.innerWidth * this.DPR);
            this.canvas.height = Math.floor(window.innerHeight * this.DPR);

            this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);

            this.w = window.innerWidth;
            this.h = window.innerHeight;
        },

        /* ======================= */

        createFallPetal() {

            const depth = Math.random();
            const total = 5;
            const isSingle = Math.random() < 0.8;

            const indices = isSingle
                ? [Math.floor(Math.random() * total)]
                : [0, 1, 2, 3, 4];

            let hue, sat = 90, light = 80;

            const r = Math.random();

            if (r < 0.35) {
                // 🌸 pastel hồng phấn
                hue = 345 + Math.random() * 10;
                sat = 85;
                light = 88 + Math.random() * 4;
            }
            else if (r < 0.65) {
                // 🌺 hồng tím hiện tại
                hue = 320 + Math.random() * 15;
                sat = 90;
                light = 78 + Math.random() * 4;
            }
            else if (r < 0.85) {
                // 🍑 cam đào / coral
                hue = 10 + Math.random() * 10;
                sat = 85;
                light = 75 + Math.random() * 5;
            }
            else if (r < 0.95) {
                // 🌷 trắng hồng
                hue = 340 + Math.random() * 15;
                sat = 50;
                light = 92 + Math.random() * 3;
            }
            else {
                // 🌸 hồng đậm accent (ít)
                hue = 330 + Math.random() * 10;
                sat = 95;
                light = 65 + Math.random() * 5;
            }

            const size = isSingle
                ? 5 + depth * 6
                : 8 + depth * 8;

            return {
                type: "fall",
                x: Math.random() * this.w,
                y: -30,
                depth,
                size,
                speedY: 0.6 + depth * 1.2,
                swayAmp: 0.5 + depth * 1.4,
                swaySpeed: 0.01 + Math.random() * 0.02,
                angle: Math.random() * Math.PI * 2,
                rotation: Math.random() * Math.PI,
                rotationSpeed: (Math.random() - 0.5) * 0.02,
                hue,
                sat,
                light,
                petalIndices: indices
            };
        },

        createBurstPiece(parent) {

            const depth = Math.random();
            const index = Math.floor(Math.random() * 5);

            return {
                type: "burst",
                x: parent.x,
                y: parent.y,
                depth,
                size: parent.size * 0.55,
                speedY: 1 + depth * 1.6,
                swayAmp: 1 + depth * 2,
                swaySpeed: 0.02 + Math.random() * 0.03,
                angle: Math.random() * Math.PI * 2,
                rotation: Math.random() * Math.PI,
                rotationSpeed: (Math.random() - 0.5) * 0.04,
                hue: parent.hue,
                sat: parent.sat,
                light: parent.light,
                petalIndices: [index]
            };
        },

        /* ======================= */

        handleClick(e) {

            const rect = this.canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;

            let hit = false;

            for (let i = this.petals.length - 1; i >= 0; i--) {

                const p = this.petals[i];

                if (p.type !== "fall") continue;
                if (p.petalIndices.length !== 5) continue;

                const dx = p.x - mx;
                const dy = p.y - my;

                if (dx * dx + dy * dy < (p.size * 1.4) ** 2) {

                    const pieces = 4 + Math.floor(Math.random() * 5);

                    for (let j = 0; j < pieces; j++) {
                        this.petals.push(this.createBurstPiece(p));
                    }

                    Object.assign(p, this.createFallPetal());

                    this.targetCount = Math.min(this.targetCount + 40, this.maxCount);
                    this.lastInteraction = performance.now();

                    hit = true;
                    break;
                }
            }

            // nếu click trúng → spawn thêm nhẹ để phản hồi tốt khi spam click
            if (hit && this.petals.length < this.maxCount) {
                this.petals.push(this.createFallPetal());
            }
        },

        regulateDensity(dt) {
            const elapsed = (performance.now() - this.startTime) / 1000;
            const introFactor = Math.min(elapsed / 3, 1);
            const now = performance.now();

            if (now - this.lastInteraction > this.decayDelay) {
                this.targetCount = Math.max(
                    this.minCount,
                    this.targetCount - this.decaySpeed * dt
                );
            }

            const fallingCount =
                this.petals.filter(p => p.type === "fall").length;

            const diff = this.targetCount - fallingCount;

            if (diff > 0) {
                this.spawnRate += this.rampSpeed * dt;
                this.spawnRate = Math.min(this.spawnRate, diff * 0.8);
            } else {
                this.spawnRate = 0;
            }

            this.spawnAccumulator += this.spawnRate * dt * introFactor;

            while (this.spawnAccumulator >= 1) {
                this.petals.push(this.createFallPetal());
                this.spawnAccumulator--;
            }
        },

        /* ======================= */

        drawShape(p) {

            const total = 5;
            const r = p.size;

            for (let i of p.petalIndices) {

                const angle = (Math.PI * 2 / total) * i;

                this.ctx.save();
                this.ctx.rotate(angle);

                this.ctx.beginPath();
                this.ctx.moveTo(0, 0);
                this.ctx.quadraticCurveTo(r * 0.85, -r * 0.65, 0, -r);
                this.ctx.quadraticCurveTo(-r * 0.85, -r * 0.65, 0, 0);
                this.ctx.closePath();
                this.ctx.fill();

                this.ctx.restore();
            }
        },

        /* ======================= */

        animate() {

            const now = performance.now();
            const dt = (now - this.lastFrameTime) / 1000;
            this.lastFrameTime = now;

            this.ctx.clearRect(0, 0, this.w, this.h);

            this.regulateDensity(dt);

            for (let i = this.petals.length - 1; i >= 0; i--) {

                const p = this.petals[i];

                p.y += p.speedY;
                p.x += Math.sin(p.angle) * p.swayAmp;
                p.angle += p.swaySpeed;
                p.rotation += p.rotationSpeed;

                if (p.y > this.h + 40) {
                    this.petals.splice(i, 1);
                    continue;
                }

                this.ctx.globalAlpha = 0.3 + p.depth * 0.4;

                this.ctx.save();
                this.ctx.translate(p.x, p.y);
                this.ctx.rotate(p.rotation);

                const grad = this.ctx.createRadialGradient(0, 0, 1, 0, 0, p.size);
                grad.addColorStop(0, `hsla(${p.hue}, ${p.sat}%, ${p.light}%, 1)`);
                grad.addColorStop(1, `hsla(${p.hue}, ${p.sat - 5}%, ${p.light - 25}%, 0.95)`);

                this.ctx.fillStyle = grad;
                this.drawShape(p);

                this.ctx.restore();
            }

            this.animationId = requestAnimationFrame(() => this.animate());
        }

    };

    window.EffectController.register("peach", Peach);

})();