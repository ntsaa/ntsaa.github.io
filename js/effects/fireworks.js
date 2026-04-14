// fireworks.js
(function () {

    const fireworksEffect = {

        animationId: null,
        canvas: null,
        ctx: null,

        w: 0,
        h: 0,
        DPR: window.devicePixelRatio || 1,

        rockets: [],
        particles: [],

        resizeHandler: null,
        moveHandler: null,
        clickHandler: null,

        MAX_PARTICLES: 1000,
        MAX_ROCKETS: 80,

        clickQueue: [],
        lastClickTime: 0,
        lastMoveShot: 0,
        lastRandomShot: 0,
        lastMoveTime: 0,
        lastProcessedClick: 0,

        RANDOM_INTERVAL: 900,
        MOVE_INTERVAL: 2000,
        CLICK_SPAM_THRESHOLD: 400,
        MAX_ACTIVE_ROCKETS: 5,

        mouseX: 0,
        mouseY: 0,

        isMobile: false,
        countMult: 1,
        spreadMult: 1,

        /* ================= START ================= */

        start() {
            if (this.animationId) return;

            this.canvas = document.getElementById("network");
            if (!this.canvas) return;

            this.ctx = this.canvas.getContext("2d");
            
            // Reset trạng thái Canvas về mặc định thông qua Controller chung
            window.EffectController.resetCanvasContext(this.ctx);
            
            this.ctx.globalCompositeOperation = "lighter";

            this.resizeHandler = () => this.resize();
            window.addEventListener("resize", this.resizeHandler);

            this.moveHandler = (e) => this.onMove(e);
            this.clickHandler = (e) => this.onClick(e);

            document.addEventListener("mousemove", this.moveHandler);
            document.addEventListener("click", this.clickHandler);

            this.resize();
            this.animate();
        },

        /* ================= STOP ================= */

        stop() {

            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
                this.animationId = null;
            }

            if (this.resizeHandler) {
                window.removeEventListener("resize", this.resizeHandler);
                this.resizeHandler = null;
            }

            if (this.moveHandler) {
                document.removeEventListener("mousemove", this.moveHandler);
                this.moveHandler = null;
            }

            if (this.clickHandler) {
                document.removeEventListener("click", this.clickHandler);
                this.clickHandler = null;
            }

            this.ctx.globalCompositeOperation = "source-over";
            this.ctx.globalAlpha = 1;
            this.ctx.clearRect(0, 0, this.w, this.h);

            this.rockets = [];
            this.particles = [];
            this.clickQueue = [];
        },

        /* ================= RESIZE ================= */

        resize() {

            this.canvas.style.width = window.innerWidth + "px";
            this.canvas.style.height = window.innerHeight + "px";

            this.canvas.width = Math.floor(window.innerWidth * this.DPR);
            this.canvas.height = Math.floor(window.innerHeight * this.DPR);

            this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);

            this.w = window.innerWidth;
            this.h = window.innerHeight;

            const area = this.w * this.h;
            this.isMobile = this.w < 600;

            // 1. MAX_PARTICLES: 400 (Mobile) -> 1000 (Desktop)
            this.MAX_PARTICLES = Math.max(400, Math.min(1000, Math.floor(area / 2000)));
            
            // 2. MAX_ROCKETS: 30 (Mobile) -> 80 (Desktop)
            this.MAX_ROCKETS = Math.max(30, Math.min(80, Math.floor(area / 25000)));
            
            // 3. countMult (Mật độ hạt mỗi vụ nổ): 0.6 -> 1.0
            this.countMult = Math.max(0.6, Math.min(1.0, area / 2000000));

            // 4. spreadMult (Độ tỏa rộng): 0.5 (Mobile) -> 1.2 (Màn hình lớn)
            this.spreadMult = Math.max(0.5, Math.min(1.2, area / 2000000));
            
            // 5. Khoảng cách bắn tự động: 1600ms (Mobile) -> 900ms (Desktop)
            this.RANDOM_INTERVAL = Math.max(900, Math.min(1600, 2000000 / area * 400));

            this.mouseX = this.w / 2;
            this.mouseY = this.h / 2;
        },

        /* ================= COLORS ================= */

        randomColor() {
            return `hsl(${Math.random() * 360},100%,60%)`;
        },

        monoVariant(h) {
            return `hsl(${h + (Math.random() - 0.5) * 30},100%,60%)`;
        },

        /* ================= PARTICLE ================= */

        createParticle(x, y, vx, vy, color, decay = 0.009, size = 4, split = false) {
            return { x, y, vx, vy, alpha: 1, decay, color, size, split };
        },

        updateParticle(p) {

            p.vy += 0.018;
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= p.decay;

            if (p.split === "phase2" && p.alpha < 0.55) {

                p.split = false;

                // Số lượng tia phụ cũng scale theo tỷ lệ vụ nổ
                const rays = Math.floor((this.isMobile ? 8 : 14) * this.countMult);
                const spread = 2.4 * this.spreadMult;

                for (let i = 0; i < rays; i++) {

                    const angle = (Math.PI * 2 / rays) * i;
                    const speed = spread + Math.random() * 0.8;

                    this.particles.push(this.createParticle(
                        p.x,
                        p.y,
                        Math.cos(angle) * speed,
                        Math.sin(angle) * speed,
                        this.randomColor(),
                        0.008,
                        3
                    ));
                }
            }
        },

        drawParticle(p) {

            if (p.alpha <= 0) return;

            const g = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
            g.addColorStop(0, p.color);
            g.addColorStop(1, "transparent");

            this.ctx.globalAlpha = p.alpha;
            this.ctx.fillStyle = g;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalAlpha = 1;
        },

        /* ================= ROCKET ================= */

        createRocket(type, targetX, targetY) {

            const x = this.w / 2 + (Math.random() - 0.5) * 200;
            const y = this.h;

            const gravity = 0.015;

            const dy = targetY - y;

            // tính vy để đỉnh quỹ đạo đúng tại targetY
            const vy = -Math.sqrt(-2 * gravity * dy);

            // thời gian bay tới đỉnh
            const timeToPeak = -vy / gravity;

            const dx = targetX - x;

            const vx = dx / timeToPeak;

            return {
                x,
                y,
                vx,
                vy,
                ax: (Math.random() - 0.5) * 0.01, // cong nhẹ nhưng không phá target
                gravity,
                targetY,
                type,
                exploded: false,
                trailColor: this.randomColor()
            };
        },

        updateRocket(r) {

            r.prevX = r.x;
            r.prevY = r.y;

            r.vx += r.ax * 0.1; // cong nhẹ thôi
            r.vy += r.gravity;

            r.x += r.vx;
            r.y += r.vy;

            // nổ khi bắt đầu rơi (tức là đúng targetY)
            if (!r.exploded && r.vy >= 0) {
                r.exploded = true;
                this.explode(r.x, r.y, r.type);
            }
        },

        drawRocket(r) {
            this.ctx.strokeStyle = r.trailColor;
            this.ctx.lineWidth = 1;

            this.ctx.beginPath();
            this.ctx.moveTo(r.prevX, r.prevY);
            this.ctx.lineTo(r.x, r.y);
            this.ctx.stroke();
        },

        /* ================= EXPLOSION (9 TYPES) ================= */

        explode(x, y, type) {

            const countMult = this.countMult;
            const spreadMult = this.spreadMult;

            switch (type) {

                case 0: for (let i = 0; i < 100 * countMult; i++) this.particles.push(this.createParticle(x, y, Math.cos(Math.random() * Math.PI * 2) * (Math.random() * 4 + 2) * spreadMult, Math.sin(Math.random() * Math.PI * 2) * (Math.random() * 4 + 2) * spreadMult, this.randomColor())); break;

                case 1: for (let i = 0; i < 120 * countMult; i++) this.particles.push(this.createParticle(x, y, Math.cos(Math.random() * Math.PI * 2) * (Math.random() * 3 + 1.5) * 1.2 * spreadMult, Math.sin(Math.random() * Math.PI * 2) * (Math.random() * 3 + 1.5) * 0.8 * spreadMult, this.monoVariant(0), 0.008, 4)); break;

                case 2: {
                    const total = 100 * countMult;
                    for (let i = 0; i < total; i++) { 
                        const a = (Math.PI * 2 / total) * i; 
                        const s = (2.5 + Math.random() * 2) * spreadMult; 
                        this.particles.push(this.createParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, this.monoVariant(200), 0.012, 3 + Math.random() * 2)); 
                    }
                } break;

                case 3: {
                    const total = 120 * countMult;
                    for (let i = 0; i < total; i++) { 
                        const a = (Math.PI * 2 / total) * i; 
                        const s = (3 + Math.sin(i * 0.4) * 2 + Math.random()) * spreadMult; 
                        this.particles.push(this.createParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, this.randomColor(), 0.016, 3)); 
                    }
                } break;

                case 4: for (let i = 0; i < 6; i++) { const base = i * (Math.PI * 2 / 6); for (let j = 0; j < 30 * countMult; j++) { const s = (j * 0.25 + Math.random()) * spreadMult; this.particles.push(this.createParticle(x, y, Math.cos(base + (Math.random() - 0.5) * 0.2) * s, Math.sin(base + (Math.random() - 0.5) * 0.2) * s, this.monoVariant(40), 0.012, 4)); } } break;

                case 5: for (let i = 0; i < 150 * countMult; i++) { const a = i * 0.18; const s = (i * 0.035) * spreadMult; this.particles.push(this.createParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, this.monoVariant(300), 0.012, 3 + Math.random() * 2)); } break;

                case 6: for (let i = 0; i < 140 * countMult; i++) this.particles.push(this.createParticle(x, y, Math.cos(Math.random() * Math.PI * 2) * (Math.random() * 4 + 2) * spreadMult, Math.sin(Math.random() * Math.PI * 2) * (Math.random() * 4 + 2) * spreadMult, this.monoVariant(50), 0.006, 5)); break;

                case 7: const hue = Math.random() * 360; for (let i = 0; i < 60 * countMult; i++) { const a = Math.random() * Math.PI * 2; const s = (Math.random() * 2 + 1.5) * spreadMult; this.particles.push(this.createParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, this.monoVariant(hue), 0.007, 3.8, "phase2")); } break;

                case 8: {
                    const total = 100 * countMult;
                    for (let i = 0; i < total; i++) { 
                        const t = (Math.PI * 2 / total) * i; 
                        const s = 0.2 * spreadMult; 
                        this.particles.push(this.createParticle(x, y, s * 16 * Math.pow(Math.sin(t), 3), -s * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)), this.monoVariant(0))); 
                    }
                } break;
            }
        },

        /* ================= CONTROL ================= */

        spawnRocket(x, y) {
            if (this.rockets.length > this.MAX_ROCKETS) return;
            if (this.particles.length > this.MAX_PARTICLES) return;
            this.rockets.push(this.createRocket(Math.floor(Math.random() * 9), x, y));
        },

        onMove(e) {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
            this.lastMoveTime = performance.now();
            this.hasShotAtCurrentMousePos = false; // Đánh dấu là chưa bắn tại vị trí mới này
        },

        onClick(e) {
            this.clickQueue.push({ x: e.clientX, y: e.clientY });
            this.lastClickTime = performance.now();
        },

        control(now) {

            // Luật sắt: Bất kể là click hay tự động, không bao giờ quá 5 quả đang bay
            if (this.rockets.length >= this.MAX_ACTIVE_ROCKETS) return;

            // 1. CHẾ ĐỘ ƯU TIÊN: Xử lý Hàng đợi Click (User)
            if (this.clickQueue.length > 0) {
                if ((now - this.lastProcessedClick) > 150) {
                    const p = this.clickQueue.shift();
                    this.spawnRocket(p.x, p.y);
                    this.lastProcessedClick = now;
                }
                return;
            }

            // 2. CHẾ ĐỘ TỰ ĐỘNG
            const autoDelay = 150 + Math.random() * 1350;

            if ((now - this.lastProcessedClick) > autoDelay) {

                // Kiểm tra xem chuột đang di chuyển hay vừa mới dừng
                const isMoving = (now - this.lastMoveTime) < 500;

                // Nếu đang di chuyển HOẶC chưa kịp bắn "phát súng cuối cùng" vào điểm dừng
                if (isMoving || !this.hasShotAtCurrentMousePos) {
                    this.spawnRocket(this.mouseX, this.mouseY);
                    this.hasShotAtCurrentMousePos = true; // Đánh dấu đã bắn xong tại điểm này
                    this.lastProcessedClick = now;
                } 
                // Nếu chuột đã đứng im lâu rồi -> Bắn ngẫu nhiên khắp màn hình
                else {
                    this.spawnRocket(Math.random() * this.w, Math.random() * this.h * 0.6);
                    this.lastProcessedClick = now;
                }
            }
        },

        /* ================= ANIMATE ================= */

        animate(now = 0) {

            this.control(now);

            this.ctx.globalCompositeOperation = "destination-out";
            this.ctx.fillStyle = "rgba(0,0,0,0.08)";
            this.ctx.fillRect(0, 0, this.w, this.h);

            this.ctx.globalCompositeOperation = "lighter";

            for (let i = this.rockets.length - 1; i >= 0; i--) {
                const r = this.rockets[i];
                this.updateRocket(r);
                this.drawRocket(r);
                if (r.exploded) this.rockets.splice(i, 1);
            }

            for (let i = this.particles.length - 1; i >= 0; i--) {
                const p = this.particles[i];
                this.updateParticle(p);
                this.drawParticle(p);
                if (p.alpha <= 0) this.particles.splice(i, 1);
            }

            this.animationId = requestAnimationFrame((t) => this.animate(t));
        }

    };

    window.EffectController.register("fireworks", fireworksEffect);

})();