// particles.js
(function () {

  const particlesEffect = {

    animationId: null,
    canvas: null,
    ctx: null,
    particles: [],
    resizeHandler: null,
    mouseMoveHandler: null,
    mouseLeaveHandler: null,
    w: 0,
    h: 0,
    DPR: window.devicePixelRatio || 1,
    mouse: { x: null, y: null, radius: 150 },

    start() {

      this.canvas = document.getElementById('network');
      if (!this.canvas) return;

      this.ctx = this.canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = true;

      // reset state
      this.ctx.globalCompositeOperation = "source-over";
      this.ctx.globalAlpha = 1;
      this.ctx.shadowBlur = 0;
      this.ctx.filter = "none";

      this.resizeHandler = () => this.resize();
      window.addEventListener('resize', this.resizeHandler);

      this.mouseMoveHandler = (e) => {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
      };

      this.mouseLeaveHandler = () => {
        this.mouse.x = null;
        this.mouse.y = null;
      };

      window.addEventListener('mousemove', this.mouseMoveHandler);
      window.addEventListener('mouseleave', this.mouseLeaveHandler);

      this.resize();
      this.initParticles();
      this.animate();
    },

    stop() {

      cancelAnimationFrame(this.animationId);

      if (this.resizeHandler) {
        window.removeEventListener('resize', this.resizeHandler);
      }

      if (this.mouseMoveHandler) {
        window.removeEventListener('mousemove', this.mouseMoveHandler);
      }

      if (this.mouseLeaveHandler) {
        window.removeEventListener('mouseleave', this.mouseLeaveHandler);
      }

      if (this.ctx) {
        this.ctx.clearRect(0, 0, this.w, this.h);
      }

      this.particles = [];
      this.mouse.x = null;
      this.mouse.y = null;
    },

    resize() {

      this.canvas.style.width = window.innerWidth + 'px';
      this.canvas.style.height = window.innerHeight + 'px';

      this.canvas.width = Math.floor(window.innerWidth * this.DPR);
      this.canvas.height = Math.floor(window.innerHeight * this.DPR);

      this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);

      this.w = window.innerWidth;
      this.h = window.innerHeight;
    },

    initParticles() {

      const count = window.innerWidth < 600 ? 80 : 190;
      this.particles = [];

      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: Math.random() * this.w,
          y: Math.random() * this.h,
          vx: (Math.random() - 0.5) * 0.9,
          vy: (Math.random() - 0.5) * 0.9,
          r: 1 + Math.random() * 1.2
        });
      }
    },

    animate() {

      this.ctx.clearRect(0, 0, this.w, this.h);

      const hue = (Date.now() / 50) % 360;
      const maxDist = window.innerWidth < 600 ? 70 : 110;

      // update + draw particles
      for (const p of this.particles) {

        p.x += p.vx;
        p.y += p.vy;

        if (p.x <= 0 || p.x >= this.w) p.vx *= -1;
        if (p.y <= 0 || p.y >= this.h) p.vy *= -1;

        if (this.mouse.x !== null) {

          const dx = p.x - this.mouse.x;
          const dy = p.y - this.mouse.y;
          const dist = Math.hypot(dx, dy);

          if (dist < this.mouse.radius && dist > 0.001) {

            const ang = Math.atan2(dy, dx);
            const push = (this.mouse.radius - dist) / this.mouse.radius;

            p.vx += Math.cos(ang) * push * 0.1;
            p.vy += Math.sin(ang) * push * 0.1;
          }
        }

        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        this.ctx.fillStyle = `hsla(${hue}, 80%, 70%, 0.5)`;
        this.ctx.fill();
      }

      // draw connections
      for (let i = 0; i < this.particles.length; i++) {
        for (let j = i + 1; j < this.particles.length; j++) {

          const a = this.particles[i];
          const b = this.particles[j];

          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.hypot(dx, dy);

          if (d < maxDist) {

            const alpha = (1 - d / maxDist) * 0.3;

            this.ctx.beginPath();
            this.ctx.moveTo(a.x, a.y);
            this.ctx.lineTo(b.x, b.y);
            this.ctx.strokeStyle = `hsla(${hue}, 80%, 70%, ${alpha})`;
            this.ctx.lineWidth = 0.8;
            this.ctx.stroke();
          }
        }
      }

      this.animationId = requestAnimationFrame(() => this.animate());
    }

  };

  window.EffectController.register("particles", particlesEffect);

})();
