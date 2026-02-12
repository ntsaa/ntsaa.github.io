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

    MAX_PARTICLES: 2000,
    MAX_ROCKETS: 80,

    clickQueue: [],
    lastClickTime: 0,
    lastMoveShot: 0,
    lastRandomShot: 0,
    lastMoveTime: 0,

    RANDOM_INTERVAL: 900,
    MOVE_INTERVAL: 2000,
    CLICK_SPAM_THRESHOLD: 400,

    mouseX: 0,
    mouseY: 0,

    /* ================= START ================= */

    start() {
      if (this.animationId) return;

      this.canvas = document.getElementById("network");
      if (!this.canvas) return;

      this.ctx = this.canvas.getContext("2d");
      this.ctx.imageSmoothingEnabled = true;
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
        this.animationId = null;   // bắt buộc reset
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

      this.mouseX = this.w / 2;
      this.mouseY = this.h / 2;
    },

    /* ================= COLORS ================= */

    randomColor() {
      return `hsl(${Math.random() * 360},100%,60%)`;
    },

    monoVariant(h) {
      const shift = (Math.random() - 0.5) * 30;
      return `hsl(${h + shift},100%,60%)`;
    },

    /* ================= PARTICLE ================= */

    createParticle(x, y, vx, vy, color, decay = 0.015, size = 4, split = false) {
      return { x, y, vx, vy, alpha: 1, decay, color, size, split };
    },

    updateParticle(p) {

      p.vy += 0.03;
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;

      if (p.split && p.alpha < 0.5) {
        p.split = false;
        for (let i = 0; i < 4; i++) {
          const angle = i * (Math.PI / 2);
          this.particles.push(
            this.createParticle(
              p.x,
              p.y,
              Math.cos(angle) * 2,
              Math.sin(angle) * 2,
              p.color,
              0.02,
              2
            )
          );
        }
      }
    },

    drawParticle(p) {

      if (p.alpha <= 0) return;

      const g = this.ctx.createRadialGradient(
        p.x, p.y, 0,
        p.x, p.y, p.size
      );

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

      const dx = targetX - x;
      const dy = targetY - y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const speed = 10;

      return {
        x,
        y,
        vx: (dx / dist) * speed,
        vy: (dy / dist) * speed,
        targetY,
        type,
        exploded: false,
        trailColor: this.randomColor()
      };
    },

    updateRocket(r) {

      r.x += r.vx;
      r.y += r.vy;

      if (
        (r.vy <= 0 && r.y <= r.targetY) ||
        Math.abs(r.y - r.targetY) < 6
      ) {
        if (!r.exploded) {
          r.exploded = true;
          this.explode(r.x, r.y, r.type);
        }
      }
    },

    drawRocket(r) {

      this.ctx.fillStyle = r.trailColor;
      this.ctx.beginPath();
      this.ctx.arc(r.x, r.y, 1.5, 0, Math.PI * 2);
      this.ctx.fill();
    },

    /* ================= EXPLOSION (9 TYPES) ================= */

    explode(x, y, type) {

      switch (type) {

        case 0:
          for (let i = 0; i < 100; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = Math.random() * 4 + 2;
            this.particles.push(
              this.createParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, this.randomColor())
            );
          }
          break;

        case 1:
          for (let i = 0; i < 120; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = Math.random() * 3 + 1.5;
            this.particles.push(
              this.createParticle(
                x, y,
                Math.cos(a) * s * 1.2,
                Math.sin(a) * s * 0.8,
                this.monoVariant(0),
                0.008,
                4
              )
            );
          }
          break;

        case 2:
          for (let i = 0; i < 80; i++) {
            const a = (Math.PI * 2 / 80) * i;
            this.particles.push(
              this.createParticle(x, y, Math.cos(a) * 3.5, Math.sin(a) * 3.5, this.monoVariant(180), 0.02, 3)
            );
          }
          break;

        case 3:
          for (let i = 0; i < 100; i++) {
            const a = (Math.PI * 2 / 100) * i;
            const s = (i % 2 === 0) ? 3 : 5;
            this.particles.push(
              this.createParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, this.randomColor(), 0.018, 3)
            );
          }
          break;

        case 4:
          for (let i = 0; i < 5; i++) {
            const base = i * (Math.PI * 2 / 5);
            for (let j = 0; j < 25; j++) {
              this.particles.push(
                this.createParticle(
                  x, y,
                  Math.cos(base) * j * 0.2,
                  Math.sin(base) * j * 0.2,
                  this.monoVariant(30)
                )
              );
            }
          }
          break;

        case 5:
          for (let i = 0; i < 120; i++) {
            const a = i * 0.15;
            const s = i * 0.03;
            this.particles.push(
              this.createParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, this.monoVariant(300))
            );
          }
          break;

        case 6:
          for (let i = 0; i < 130; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = Math.random() * 3 + 2;
            this.particles.push(
              this.createParticle(
                x, y,
                Math.cos(a) * s,
                Math.sin(a) * s - 2,
                this.monoVariant(50),
                0.007,
                5
              )
            );
          }
          break;

        case 7:
          for (let i = 0; i < 60; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = Math.random() * 4 + 2;
            this.particles.push(
              this.createParticle(
                x, y,
                Math.cos(a) * s,
                Math.sin(a) * s,
                this.randomColor(),
                0.015,
                4,
                true
              )
            );
          }
          break;

        case 8:
          for (let i = 0; i < 100; i++) {
            const t = Math.PI * 2 * i / 100;
            const scale = 0.2;
            const vx = scale * 16 * Math.pow(Math.sin(t), 3);
            const vy = -scale * (
              13 * Math.cos(t)
              - 5 * Math.cos(2 * t)
              - 2 * Math.cos(3 * t)
              - Math.cos(4 * t)
            );
            this.particles.push(
              this.createParticle(x, y, vx, vy, this.monoVariant(0))
            );
          }
          break;
      }
    },

    /* ================= CONTROL ================= */

    spawnRocket(x, y) {
      if (this.rockets.length > this.MAX_ROCKETS) return;
      if (this.particles.length > this.MAX_PARTICLES) return;
      const type = Math.floor(Math.random() * 9);
      this.rockets.push(this.createRocket(type, x, y));
    },

    onMove(e) {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.lastMoveTime = performance.now();
    },

    onClick(e) {
      this.clickQueue.push({ x: e.clientX, y: e.clientY });
      this.lastClickTime = performance.now();
    },

    control(now) {

      const clickSpam = (now - this.lastClickTime) < this.CLICK_SPAM_THRESHOLD;

      if (this.clickQueue.length > 0) {
        const p = this.clickQueue.shift();
        this.spawnRocket(p.x, p.y);
        return;
      }

      if (now - this.lastMoveShot > this.MOVE_INTERVAL &&
          (now - this.lastMoveTime) < 3000) {
        this.spawnRocket(this.mouseX, this.mouseY);
        this.lastMoveShot = now;
      }

      if (!clickSpam && now - this.lastRandomShot > this.RANDOM_INTERVAL) {
        const rx = Math.random() * this.w;
        const ry = Math.random() * this.h * 0.6;
        this.spawnRocket(rx, ry);
        this.lastRandomShot = now;
      }
    },

    /* ================= ANIMATE ================= */

    animate(now = 0) {

      this.control(now);

      this.ctx.globalCompositeOperation = "destination-out";
      this.ctx.fillStyle = "rgba(0,0,0,0.15)";
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
