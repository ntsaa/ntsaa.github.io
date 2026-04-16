// starfield.js
(function () {

  const starfieldEffect = {

    animationId: null,
    canvas: null,
    ctx: null,
    resizeHandler: null,
    mouseHandler: null,
    shootingTimeout: null,
    warpStartHandler: null,
    warpEndHandler: null,

    stars: [],
    shootingStars: [],

    w: 0,
    h: 0,
    DPR: window.EffectController.DPR,
    running: false,
    resizeTimeout: null,

    mouseX: 0,
    mouseY: 0,
    isWarping: false,
    
    // Performance & Scaling
    starPool: null,
    spriteCache: null,
    sensitivity: 0.0005,

    colors: [
      '255,99,132', '54,162,235', '255,206,86',
      '75,192,192', '153,102,255', '255,159,64'
    ],

    /* ================= START ================= */

    start() {
      if (this.running) return;
      this.running = true;

      this.canvas = document.getElementById('network');
      if (!this.canvas) return;

      this.ctx = this.canvas.getContext('2d');
      window.EffectController.resetCanvasContext(this.ctx);

      // 1. Initialize Sprite Cache (once)
      this.spriteCache = window.EffectController.getCache("starfield", () => this.initSpriteCache());

      // 2. Initialize Object Pool
      if (!this.starPool) {
        this.starPool = window.EffectController.createPool(() => ({}), 600);
      }

      this.resizeHandler = () => this.resize();
      window.addEventListener('resize', this.resizeHandler);

      this.mouseHandler = (e) => {
        const target = e.target;
        if (window.EffectController.isUIElement(target)) {
          this.mouseX = 0;
          this.mouseY = 0;
        } else {
          const isTouch = e.type.startsWith('touch');
          const clientX = isTouch ? e.touches[0].clientX : e.clientX;
          const clientY = isTouch ? e.touches[0].clientY : e.clientY;
          this.mouseX = clientX - this.w / 2;
          this.mouseY = clientY - this.h / 2;
        }
      };

      this.warpStartHandler = (e) => {
        if (window.EffectController.isUIElement(e.target)) return;
        this.isWarping = true;
        this.mouseHandler(e); // Update position immediately on touch/click
      };
      this.warpEndHandler = () => {
        this.isWarping = false;
      };

      document.addEventListener('mousemove', this.mouseHandler);
      document.addEventListener('mousedown', this.warpStartHandler);
      document.addEventListener('mouseup', this.warpEndHandler);
      
      document.addEventListener('touchstart', this.warpStartHandler, { passive: true });
      document.addEventListener('touchmove', this.mouseHandler, { passive: true });
      document.addEventListener('touchend', this.warpEndHandler, { passive: true });

      this.resize(true);
      this.spawnShootingStar();
      this.animate();
    },

    /* ================= STOP ================= */

    stop() {
      if (!this.running) return;
      this.running = false;

      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }

      clearTimeout(this.resizeTimeout);
      if (this.shootingTimeout) clearTimeout(this.shootingTimeout);

      window.removeEventListener('resize', this.resizeHandler);
      document.removeEventListener('mousemove', this.mouseHandler);
      document.removeEventListener('mousedown', this.warpStartHandler);
      document.removeEventListener('mouseup', this.warpEndHandler);
      document.removeEventListener('touchstart', this.warpStartHandler);
      document.removeEventListener('touchmove', this.mouseHandler);
      document.removeEventListener('touchend', this.warpEndHandler);

      // Recycle stars
      while (this.stars.length) this.starPool.recycle(this.stars.pop());
      this.shootingStars = [];
      this.isWarping = false;

      if (this.ctx) this.ctx.clearRect(0, 0, this.w, this.h);
    },

    /* ================= SPRITE CACHE ================= */

    initSpriteCache() {
      const cache = [];
      this.colors.forEach(colorStr => {
        const size = 64; 
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const center = size / 2;
        
        const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
        gradient.addColorStop(0, `rgba(${colorStr}, 1)`);
        gradient.addColorStop(0.75, `rgba(${colorStr}, 0.9)`);
        gradient.addColorStop(0.9, `rgba(${colorStr}, 0.2)`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        cache.push(canvas);
      });
      return cache;
    },

    /* ================= LOGIC ================= */

    resize(isInitial = false) {
      this.w = window.innerWidth;
      this.h = window.innerHeight;

      this.canvas.style.width = this.w + 'px';
      this.canvas.style.height = this.h + 'px';
      this.canvas.width = Math.floor(this.w * this.DPR);
      this.canvas.height = Math.floor(this.h * this.DPR);
      this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);

      // Scale sensitivity based on width: Narrower screen = Higher sensitivity
      // Desktop (1200+) = 0.0005, Mobile (360) = ~0.0016
      this.sensitivity = Math.max(0.0005, 0.6 / this.w);

      if (isInitial) {
        this.initStars();
        return;
      }

      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => this.refillStep(), 500);
    },

    getLayersConfig() {
      return [
        { count: this.w < 600 ? 60 : 120, speed: 6, size: this.w < 600 ? [1.2, 2.5] : [2.5, 4.5] },
        { count: this.w < 600 ? 90 : 180, speed: 3, size: this.w < 600 ? [0.7, 1.4] : [1.4, 2.4] },
        { count: this.w < 600 ? 120 : 240, speed: 1.5, size: this.w < 600 ? [0.4, 1.0] : [0.8, 1.8] }
      ];
    },

    createStar(layer, layerIndex, atDistance = false) {
      const s = this.starPool.get();
      s.x = Math.random() * this.w;
      s.y = Math.random() * this.h;
      s.z = atDistance ? this.w : Math.random() * this.w;
      s.radius = layer.size[0] + Math.random() * (layer.size[1] - layer.size[0]);
      s.colorIndex = (Math.random() * this.colors.length) | 0;
      s.alpha = Math.random() * 0.5 + 0.5;
      s.layer = layer;
      s.layerIndex = layerIndex;
      s.alphaChange = Math.random() * 0.02 + 0.005;
      return s;
    },

    initStars() {
      while (this.stars.length) this.starPool.recycle(this.stars.pop());
      const layersConfig = this.getLayersConfig();
      layersConfig.forEach((layer, index) => {
        for (let i = 0; i < layer.count; i++) {
          this.stars.push(this.createStar(layer, index));
        }
      });
    },

    refillStep() {
      if (!this.running) return;
      const layersConfig = this.getLayersConfig();
      let added = false;

      layersConfig.forEach((layer, index) => {
        const currentCount = this.stars.filter(s => s.layerIndex === index).length;
        if (currentCount < layer.count) {
          const toAdd = Math.min(5, layer.count - currentCount);
          for (let i = 0; i < toAdd; i++) {
            this.stars.push(this.createStar(layer, index, true));
          }
          added = true;
        }
      });
      if (added) this.resizeTimeout = setTimeout(() => this.refillStep(), 100);
    },

    spawnShootingStar() {
      if (!this.running) return;
      const star = {
        x: Math.random() * this.w,
        y: Math.random() * this.h / 2,
        length: this.w < 600 ? (5 + Math.random() * 10) : (10 + Math.random() * 20),
        speed: this.w < 600 ? (8 + Math.random() * 5) : (15 + Math.random() * 10),
        colorIndex: (Math.random() * this.colors.length) | 0,
        alpha: 1
      };
      this.shootingStars.push(star);
      this.shootingTimeout = setTimeout(() => this.spawnShootingStar(), Math.random() * 4000 + 3000);
    },

    updateStars() {
      const warpMult = this.isWarping ? 5 : 1;
      const driftMult = this.isWarping ? 1.5 : 1; // Extra drift during warp

      for (let i = this.stars.length - 1; i >= 0; i--) {
        const star = this.stars[i];
        star.z -= star.layer.speed * warpMult;

        if (star.z <= 0) {
          star.x = Math.random() * this.w;
          star.y = Math.random() * this.h;
          star.z = this.w;
        }

        // Apply scaled sensitivity
        star.x += this.mouseX * this.sensitivity * star.layer.speed * warpMult * driftMult;
        star.y += this.mouseY * this.sensitivity * star.layer.speed * warpMult * driftMult;

        star.alpha += star.alphaChange;
        if (star.alpha > 1 || star.alpha < 0.2) star.alphaChange *= -1;
      }

      for (let i = this.shootingStars.length - 1; i >= 0; i--) {
        const s = this.shootingStars[i];
        s.x += s.speed * warpMult;
        s.y += (s.speed / 3) * warpMult;
        s.alpha -= 0.02 * warpMult;
        if (s.alpha <= 0) this.shootingStars.splice(i, 1);
      }
    },

    drawStars() {
      const fadeAlpha = this.isWarping ? 0.15 : 0.35;
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.fillStyle = `rgba(0, 0, 0, ${fadeAlpha})`;
      this.ctx.fillRect(0, 0, this.w, this.h);
      this.ctx.globalCompositeOperation = 'source-over';

      this.stars.forEach(star => {
        const k = 500 / star.z;
        const x = (star.x - this.w / 2) * k + this.w / 2;
        const y = (star.y - this.h / 2) * k + this.h / 2;
        let size = star.radius * k * 0.55; 

        this.ctx.globalAlpha = star.alpha;
        if (this.isWarping) {
            const stretch = 1 + (k * 0.05);
            const angle = Math.atan2(y - this.h / 2, x - this.w / 2);
            this.ctx.save();
            this.ctx.translate(x, y);
            this.ctx.rotate(angle);
            this.ctx.drawImage(this.spriteCache[star.colorIndex], -size*stretch, -size, size * stretch * 2, size * 2);
            this.ctx.restore();
        } else {
            this.ctx.drawImage(this.spriteCache[star.colorIndex], x - size, y - size, size * 2, size * 2);
        }
      });
      
      this.ctx.globalAlpha = 1;
      this.shootingStars.forEach(s => {
        this.ctx.beginPath();
        this.ctx.moveTo(s.x, s.y);
        this.ctx.lineTo(s.x - s.length, s.y - s.length / 3);
        this.ctx.strokeStyle = `rgba(${this.colors[s.colorIndex]},${s.alpha})`;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
      });
    },

    animate(t) {
      if (window.EffectController.shouldRender(t)) {
        this.updateStars();
        this.drawStars();
      }
      this.animationId = requestAnimationFrame((t) => this.animate(t));
    }
  };

  window.EffectController.register("starfield", starfieldEffect);

})();
