// ld-effect.js
(function () {

  const driftEffect = {

    animationId: null,
    canvas: null,
    ctx: null,
    particles: [],
    resizeHandler: null,
    w: 0,
    h: 0,
    DPR: window.devicePixelRatio || 1,

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

      this.resize();
      this.initParticles();
      this.animate();
    },

    stop() {

      cancelAnimationFrame(this.animationId);

      if (this.resizeHandler) {
        window.removeEventListener('resize', this.resizeHandler);
      }

      if (this.ctx) {
        this.ctx.clearRect(0, 0, this.w, this.h);
      }

      this.particles = [];
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

    createParticle() {

      return {
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        size: Math.random() * 1.2 + 0.3,
        speedX: (Math.random() - 0.5) * 1.5,
        speedY: (Math.random() - 0.5) * 1.5,
        hueOffset: Math.random() * 360
      };
    },

    initParticles() {

      const count = window.innerWidth < 600 ? 150 : 500;
      this.particles = [];

      for (let i = 0; i < count; i++) {
        this.particles.push(this.createParticle());
      }
    },

    updateParticle(p) {

      p.x += p.speedX;
      p.y += p.speedY;

      // wrap screen
      if (p.x < 0) p.x = this.w;
      if (p.x > this.w) p.x = 0;
      if (p.y < 0) p.y = this.h;
      if (p.y > this.h) p.y = 0;
    },

    drawParticle(p) {

      const hue = (Date.now() / 50 + p.hueOffset) % 360;
      const color = `hsla(${hue}, 80%, 70%, 0.5)`;

      this.ctx.fillStyle = color;
      this.ctx.shadowBlur = window.innerWidth < 600 ? p.size : p.size * 2;
      this.ctx.shadowColor = color;

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.shadowBlur = 0;
    },

    animate() {

      // trail background
      this.ctx.fillStyle =
        window.innerWidth < 600
          ? 'rgba(0,0,0,0.08)'
          : 'rgba(0,0,0,0.05)';

      this.ctx.fillRect(0, 0, this.w, this.h);

      for (let p of this.particles) {
        this.updateParticle(p);
        this.drawParticle(p);
      }

      this.animationId = requestAnimationFrame(() => this.animate());
    }

  };

  window.EffectController.register("drift", driftEffect);

})();
