// sakura.js
(function () {

  const sakuraEffect = {

    animationId: null,
    canvas: null,
    ctx: null,
    petals: [],
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
      this.initPetals();
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

      this.petals = [];
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

    createPetal(initial = false) {

      const depth = Math.random();
      const isSingle = Math.random() < 0.83;
      const petalCount = isSingle ? 1 : 5;

      const total = 5;
      const indices = petalCount === 1
        ? [Math.floor(Math.random() * total)]
        : [0, 1, 2, 3, 4];

      return {
        x: Math.random() * this.w,
        y: initial ? Math.random() * this.h : -30,
        depth,
        size: petalCount === 1
          ? 5 + depth * 8
          : 8 + depth * 12,
        speedY: 0.5 + depth * 1.3,
        swayAmp: 0.4 + depth * 1.4,
        swaySpeed: 0.01 + Math.random() * 0.02,
        angle: Math.random() * Math.PI * 2,
        rotation: Math.random() * Math.PI,
        rotationSpeed: petalCount === 1
          ? (Math.random() - 0.5) * 0.02
          : (Math.random() - 0.5) * 0.006,
        hue: 330 + Math.random() * 10,
        petalIndices: indices
      };
    },

    initPetals() {

      const count = window.innerWidth < 600 ? 25 : 45;
      this.petals = [];

      for (let i = 0; i < count; i++) {
        this.petals.push(this.createPetal(true));
      }
    },

    drawShape(p) {

      const totalPetals = 5;
      const r = p.size;

      for (let i of p.petalIndices) {

        const angle = (Math.PI * 2 / totalPetals) * i;

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

    animate() {

      this.ctx.clearRect(0, 0, this.w, this.h);

      for (let p of this.petals) {

        p.y += p.speedY;
        p.x += Math.sin(p.angle) * p.swayAmp;
        p.angle += p.swaySpeed;
        p.rotation += p.rotationSpeed;

        if (p.y > this.h + 40) {
          Object.assign(p, this.createPetal(false));
        }

        this.ctx.save();
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate(p.rotation);

        this.ctx.globalAlpha = 0.2 + p.depth * 0.3;

        const grad = this.ctx.createRadialGradient(0, 0, 1, 0, 0, p.size);
        grad.addColorStop(0, `hsla(${p.hue}, 80%, 92%, 1)`);
        grad.addColorStop(1, `hsla(${p.hue}, 70%, 75%, 0.9)`);

        this.ctx.fillStyle = grad;

        this.drawShape(p);

        this.ctx.restore();
      }

      this.animationId = requestAnimationFrame(() => this.animate());
    }

  };

  window.EffectController.register("sakura", sakuraEffect);

})();
