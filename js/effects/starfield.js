// starfield.js
(function () {

  const starfieldEffect = {

    animationId: null,
    canvas: null,
    ctx: null,
    resizeHandler: null,
    shootingTimeout: null,

    stars: [],
    shootingStars: [],

    w: 0,
    h: 0,
    DPR: window.EffectController.DPR,
    running: false,
    resizeTimeout: null,

    vX: 0,
    vY: 0,
    
    starPool: null,
    shootingPool: null,
    spriteCache: null,

    colors: [
      '255,99,132',   // Pink
      '54,162,235',   // Blue
      '255,206,86',   // Yellow
      '75,192,192',   // Teal
      '153,102,255',  // Purple
      '255,159,64'    // Orange
    ],

    /* ================= START ================= */

    start() {
      if (this.running) return;
      this.running = true;

      this.canvas = document.getElementById('network');
      if (!this.canvas) return;

      this.ctx = this.canvas.getContext('2d');
      window.EffectController.resetCanvasContext(this.ctx);

      this.spriteCache = window.EffectController.getCache("starfield", () => this.initSpriteCache());

      if (!this.starPool) this.starPool = window.EffectController.createPool(() => ({}), null, 600);
      if (!this.shootingPool) this.shootingPool = window.EffectController.createPool(() => ({}), null, 10);

      this.resizeHandler = () => this.resize();
      window.addEventListener('resize', this.resizeHandler);

      this.resize(true);
      this.vX = this.w / 2; this.vY = this.h / 2;
      this.spawnShootingStar();
      this.animate();
    },

    /* ================= STOP ================= */

    stop() {
      if (!this.running) return;
      this.running = false;
      cancelAnimationFrame(this.animationId);
      clearTimeout(this.resizeTimeout);
      clearTimeout(this.shootingTimeout);
      window.removeEventListener('resize', this.resizeHandler);
      while (this.stars.length) this.starPool.recycle(this.stars.pop());
      while (this.shootingStars.length) this.shootingPool.recycle(this.shootingStars.pop());
      if (this.ctx) this.ctx.clearRect(0, 0, this.w, this.h);
    },

    initSpriteCache() {
      const cache = [];
      this.colors.forEach(colorStr => {
        const size = 48; // Tăng độ phân giải sprite
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        const c = size / 2;
        const grad = ctx.createRadialGradient(c, c, 0, c, c, c * 0.8);
        grad.addColorStop(0, `rgba(${colorStr}, 1)`);
        grad.addColorStop(0.3, `rgba(${colorStr}, 0.7)`); // Hào quang rộng hơn chút
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        cache.push(canvas);
      });
      return cache;
    },

    resize(isInitial = false) {
      this.w = window.innerWidth; this.h = window.innerHeight;
      this.canvas.style.width = this.w + 'px'; this.canvas.style.height = this.h + 'px';
      this.canvas.width = Math.floor(this.w * this.DPR); this.canvas.height = Math.floor(this.h * this.DPR);
      this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
      if (isInitial) this.initStars();
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => this.refillStep(), 500);
    },

    getLayersConfig() {
      const mobile = this.w < 600;
      const perf = window.EffectController.performanceScale;
      return [
        { count: (mobile ? 60 : 120) * perf, speed: 5, size: [2.5, 4.5] }, // To hơn
        { count: (mobile ? 90 : 180) * perf, speed: 2.5, size: [1.5, 3.0] }, // To hơn
        { count: (mobile ? 120 : 240) * perf, speed: 1.2, size: [1.0, 1.8] }  // To hơn
      ];
    },

    createStar(layer, layerIndex, atDistance = false) {
      const s = this.starPool.get();
      s.x = Math.random() * this.w; s.y = Math.random() * this.h;
      s.z = atDistance ? this.w : Math.random() * this.w;
      s.size = layer.size[0] + Math.random() * (layer.size[1] - layer.size[0]);
      s.colorIndex = (Math.random() * this.colors.length) | 0;
      s.alpha = 0.5 + Math.random() * 0.5;
      s.layerIndex = layerIndex;
      s.speed = layer.speed;
      return s;
    },

    initStars() {
      while (this.stars.length) this.starPool.recycle(this.stars.pop());
      this.getLayersConfig().forEach((layer, index) => {
        for (let i = 0; i < layer.count; i++) this.stars.push(this.createStar(layer, index));
      });
    },

    refillStep() {
      if (!this.running) return;
      this.getLayersConfig().forEach((layer, index) => {
        let current = this.stars.filter(s => s.layerIndex === index).length;
        while (current < layer.count) {
          this.stars.push(this.createStar(layer, index, true));
          current++;
        }
      });
    },

    spawnShootingStar() {
      if (!this.running) return;
      const s = this.shootingPool.get();
      s.x = Math.random() * this.w; s.y = Math.random() * this.h / 2;
      s.len = 10 + Math.random() * 15;
      s.speed = 12 + Math.random() * 10;
      s.hue = (Math.random() * 360) | 0;
      s.alpha = 1;
      this.shootingStars.push(s);
      this.shootingTimeout = setTimeout(() => this.spawnShootingStar(), 2000 + Math.random() * 4000);
    },

    animate(t) {
      if (!this.running) return;
      if (window.EffectController.shouldRender(t)) {
        const interact = window.EffectController.interaction;
        const warp = interact.isDown && !interact.isOverUI;
        const warpMult = warp ? 6 : 1;
        const dpr = this.DPR;

        const mx = interact.isValid ? (interact.x - this.w/2) : 0;
        const my = interact.isValid ? (interact.y - this.h/2) : 0;
        const targetVX = this.w / 2 - Math.max(-50, Math.min(50, mx));
        const targetVY = this.h / 2 - Math.max(-50, Math.min(50, my));
        this.vX += (targetVX - this.vX) * 0.05;
        this.vY += (targetVY - this.vY) * 0.05;

        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.fillStyle = `rgba(0, 0, 0, ${warp ? 0.2 : 0.4})`;
        this.ctx.fillRect(0, 0, this.w, this.h);
        this.ctx.globalCompositeOperation = 'lighter';

        for (let i = this.stars.length - 1; i >= 0; i--) {
            const s = this.stars[i];
            s.z -= s.speed * warpMult;
            if (s.z <= 0) {
              s.x = Math.random() * this.w; s.y = Math.random() * this.h; s.z = this.w;
            }
            
            const k = 650 / s.z; // Perspective factor tăng lên chút
            const px = (s.x - this.vX) * k + this.vX;
            const py = (s.y - this.vY) * k + this.vY;
            const size = s.size * k * 0.85; // Tăng size hiển thị cuối cùng

            if (warp) {
                const dx = px - this.vX; const dy = py - this.vY;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const stretch = 1 + (k * 0.1); // Kéo dài hơn khi warp
                const cos = dx / dist; const sin = dy / dist;
                this.ctx.setTransform(dpr * cos * stretch, dpr * sin * stretch, -dpr * sin, dpr * cos, dpr * px, dpr * py);
            } else {
                this.ctx.setTransform(dpr, 0, 0, dpr, dpr * px, dpr * py);
            }
            
            this.ctx.globalAlpha = s.alpha;
            this.ctx.drawImage(this.spriteCache[s.colorIndex], -size, -size, size * 2, size * 2);
        }

        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.ctx.globalAlpha = 1;

        for (let i = this.shootingStars.length - 1; i >= 0; i--) {
            const s = this.shootingStars[i];
            s.x += s.speed * warpMult; s.y += (s.speed / 4) * warpMult; s.alpha -= 0.015 * warpMult;
            if (s.alpha <= 0) {
                this.shootingPool.recycle(this.shootingStars.splice(i, 1)[0]);
                continue;
            }
            this.ctx.strokeStyle = `hsla(${s.hue}, 100%, 80%, ${s.alpha})`;
            this.ctx.lineWidth = 2.0; // Vệt sao băng dày hơn chút
            this.ctx.beginPath();
            this.ctx.moveTo(s.x, s.y);
            this.ctx.lineTo(s.x - s.len, s.y - s.len / 4);
            this.ctx.stroke();
        }
      }
      this.animationId = requestAnimationFrame((t) => this.animate(t));
    }
  };

  window.EffectController.register("starfield", starfieldEffect);

})();