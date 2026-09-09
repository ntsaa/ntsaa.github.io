// peach.js
(function () {

    const Peach = {

        animationId: null,
        canvas: null,
        ctx: null,
        petals: [],
        
        // Pools & Cache
        petalPool: null,
        spriteCache: null,

        resizeHandler: null,
        clickHandler: null,

        w: 0,
        h: 0,
        DPR: window.EffectController.DPR,

        minCount: 40,
        maxCount: 280,
        targetCount: 40,

        spawnAccumulator: 0,
        lastInteraction: 0,
        decayDelay: 1500,
        startTime: 0,
        resizeTimeout: null,

        /* ================= START ================= */

        start() {
            if (this.animationId) return;

            this.canvas = document.getElementById("network");
            if (!this.canvas) return;

            this.ctx = this.canvas.getContext("2d");
            window.EffectController.resetCanvasContext(this.ctx);

            // 1. Initialize Sprite Cache (6 variants of petals)
            this.spriteCache = window.EffectController.getCache("peach", () => this.initCache());

            // 2. Initialize Pool
            if (!this.petalPool) {
                this.petalPool = window.EffectController.createPool(() => ({}), null, 300);
            }

            this.resizeHandler = () => this.resize();
            window.addEventListener("resize", this.resizeHandler);

            this.clickHandler = (e) => this.handleClick(e);
            window.addEventListener("pointerdown", this.clickHandler, { passive: true });

            this.resize(true);
            this.startTime = performance.now();
            this.petals = [];
            this.targetCount = this.minCount;
            this.animate();
        },

        stop() {
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
                this.animationId = null;
            }
            clearTimeout(this.resizeTimeout);
            window.removeEventListener("resize", this.resizeHandler);
            window.removeEventListener("pointerdown", this.clickHandler);

            while (this.petals.length) this.petalPool.recycle(this.petals.pop());
            if (this.ctx) this.ctx.clearRect(0, 0, this.w, this.h);
        },

        /* ================= SPRITE CACHE ================= */

        initCache() {
            const cache = [];
            const types = [
                { h: 350, s: 85, l: 88 }, // Pastel Pink
                { h: 325, s: 90, l: 78 }, // Deep Pink
                { h: 15, s: 85, l: 75 },  // Coral/Peach
                { h: 345, s: 50, l: 92 }, // White Pink
                { h: 335, s: 95, l: 65 }  // Accent Pink
            ];

            types.forEach(t => {
                const canvas = document.createElement("canvas");
                const size = 32; 
                canvas.width = size * 2;
                canvas.height = size * 2;
                const ctx = canvas.getContext("2d");
                const r = size * 0.8;

                const grad = ctx.createRadialGradient(size, size, 1, size, size, r);
                grad.addColorStop(0, `hsla(${t.h}, ${t.s}%, ${t.l}%, 1)`);
                grad.addColorStop(1, `hsla(${t.h}, ${t.s - 5}%, ${t.l - 20}%, 0.9)`);
                ctx.fillStyle = grad;

                // Draw a single heart-like petal
                ctx.translate(size, size);
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.quadraticCurveTo(r * 0.85, -r * 0.65, 0, -r);
                ctx.quadraticCurveTo(-r * 0.85, -r * 0.65, 0, 0);
                ctx.fill();
                
                cache.push(canvas);
            });
            return cache;
        },

        /* ================= LOGIC ================= */

        resize(isInitial = false) {
            this.w = window.innerWidth;
            this.h = window.innerHeight;
            this.canvas.style.width = this.w + "px";
            this.canvas.style.height = this.h + "px";
            this.canvas.width = Math.floor(this.w * this.DPR);
            this.canvas.height = Math.floor(this.h * this.DPR);
            this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);

            if (isInitial) {
                this.recalculateLimits();
                return;
            }
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => this.recalculateLimits(), 500);
        },

        recalculateLimits() {
            const area = this.w * this.h;
            this.minCount = Math.max(20, Math.min(60, Math.floor(area / 40000)));
            this.maxCount = Math.max(50, Math.min(280, Math.floor(area / 10000)));
            this.targetCount = Math.max(this.minCount, Math.min(this.targetCount, this.maxCount));
        },

        spawnPetal(isBurst = false, parent = null) {
            if (this.petals.length >= this.maxCount) return;
            const p = this.petalPool.get();
            const depth = Math.random();
            
            if (isBurst && parent) {
                p.x = parent.x; p.y = parent.y;
                p.speedY = 1 + depth * 1.5;
                p.size = parent.size * 0.6;
                p.type = "burst";
            } else {
                p.x = Math.random() * this.w; p.y = -20;
                p.speedY = 0.7 + depth * 1.0;
                p.size = 6 + depth * 8;
                p.type = "fall";
            }

            p.depth = depth;
            p.swayAmp = 0.4 + depth * 1.2;
            p.swaySpeed = 0.01 + Math.random() * 0.02;
            p.angle = Math.random() * Math.PI * 2;
            p.rotation = Math.random() * Math.PI * 2;
            p.rotationSpeed = (Math.random() - 0.5) * 0.03;
            p.spriteIndex = (Math.random() * this.spriteCache.length) | 0;
            
            this.petals.push(p);
        },

        handleClick(e) {
            if (window.EffectController.isUIElement(e.target)) return;
            const mx = e.clientX; const my = e.clientY;
            let hit = false;

            for (let i = this.petals.length - 1; i >= 0; i--) {
                const p = this.petals[i];
                if (p.type !== "fall") continue;
                const dx = p.x - mx; const dy = p.y - my;
                if (dx * dx + dy * dy < (p.size * 2) ** 2) {
                    for (let j = 0; j < 5; j++) this.spawnPetal(true, p);
                    this.petalPool.recycle(this.petals.splice(i, 1)[0]);
                    this.targetCount = Math.min(this.targetCount + 30, this.maxCount);
                    this.lastInteraction = performance.now();
                    hit = true;
                    break;
                }
            }
            if (hit) this.spawnPetal();
        },

        animate(t) {
            if (window.EffectController.shouldRender(t)) {
                this.ctx.clearRect(0, 0, this.w, this.h);
                
                // Density regulation
                const now = performance.now();
                if (now - this.lastInteraction > this.decayDelay) {
                    this.targetCount = Math.max(this.minCount, this.targetCount - 0.5);
                }

                if (this.petals.length < this.targetCount) {
                    this.spawnAccumulator += 0.2;
                    while (this.spawnAccumulator >= 1) {
                        this.spawnPetal();
                        this.spawnAccumulator--;
                    }
                }

                // Update & Draw
                for (let i = this.petals.length - 1; i >= 0; i--) {
                    const p = this.petals[i];
                    p.y += p.speedY;
                    p.x += Math.sin(p.angle) * p.swayAmp;
                    p.angle += p.swaySpeed;
                    p.rotation += p.rotationSpeed;

                    if (p.y > this.h + 30) {
                        this.petalPool.recycle(this.petals.splice(i, 1)[0]);
                        continue;
                    }

                    const alpha = 0.4 + p.depth * 0.5;
                    const sprite = this.spriteCache[p.spriteIndex];
                    window.EffectController.drawSprite(this.ctx, sprite, p.x, p.y, p.size, p.rotation, alpha);
                }
            }
            this.animationId = requestAnimationFrame((t) => this.animate(t));
        }

    };

    window.EffectController.register("peach", Peach);

})();