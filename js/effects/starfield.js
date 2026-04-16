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
    vX: 0,
    vY: 0,
    isWarping: false,
    
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

      if (!this.starPool) this.starPool = window.EffectController.createPool(() => ({}), 600);
      if (!this.shootingPool) this.shootingPool = window.EffectController.createPool(() => ({}), 10);

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
        this.mouseHandler(e);
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
      this.vX = this.w / 2;
      this.vY = this.h / 2;
      
      this.spawnShootingStar();
      this.animate();
    },

    /* ================= STOP ================= */

    stop() {
      if (!this.running) return;
      this.running = false;

      if (this.animationId) cancelAnimationFrame(this.animationId);
      clearTimeout(this.resizeTimeout);
      if (this.shootingTimeout) clearTimeout(this.shootingTimeout);

      window.removeEventListener('resize', this.resizeHandler);
      document.removeEventListener('mousemove', this.mouseHandler);
      document.removeEventListener('mousedown', this.warpStartHandler);
      document.removeEventListener('mouseup', this.warpEndHandler);
      document.removeEventListener('touchstart', this.warpStartHandler);
      document.removeEventListener('touchmove', this.mouseHandler);
      document.removeEventListener('touchend', this.warpEndHandler);

      while (this.stars.length) this.starPool.recycle(this.stars.pop());
      while (this.shootingStars.length) this.shootingPool.recycle(this.shootingStars.pop());
      
      this.isWarping = false;
      if (this.ctx) this.ctx.clearRect(0, 0, this.w, this.h);
    },

    initSpriteCache() {
      const cache = [];
      this.colors.forEach(colorStr => {
        const size = 48;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const center = size / 2;
        const gradient = ctx.createRadialGradient(center, center, 0, center, center, center * 0.8);
        gradient.addColorStop(0, `rgba(${colorStr}, 1)`);
        gradient.addColorStop(0.3, `rgba(${colorStr}, 0.8)`);
        gradient.addColorStop(0.6, `rgba(${colorStr}, 0.2)`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        cache.push(canvas);
      });
      return cache;
    },

    resize(isInitial = false) {
      this.w = window.innerWidth;
      this.h = window.innerHeight;
      this.canvas.style.width = this.w + 'px';
      this.canvas.style.height = this.h + 'px';
      this.canvas.width = Math.floor(this.w * this.DPR);
      this.canvas.height = Math.floor(this.h * this.DPR);
      this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
      if (isInitial) this.initStars();
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => this.refillStep(), 500);
    },

    getLayersConfig() {
      const mobile = this.w < 600;
      return [
        { count: mobile ? 60 : 120, speed: 6, size: mobile ? [1.2, 2.2] : [1.8, 3.5] },
        { count: mobile ? 90 : 180, speed: 3, size: mobile ? [0.8, 1.4] : [1.2, 2.2] },
        { count: mobile ? 120 : 240, speed: 1.5, size: mobile ? [0.5, 1.0] : [0.8, 1.6] }
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
      this.getLayersConfig().forEach((layer, index) => {
        for (let i = 0; i < layer.count; i++) this.stars.push(this.createStar(layer, index));
      });
    },

    refillStep() {
      if (!this.running) return;
      let added = false;
      this.getLayersConfig().forEach((layer, index) => {
        let currentCount = 0;
        for (let i = 0; i < this.stars.length; i++) if (this.stars[i].layerIndex === index) currentCount++;
        if (currentCount < layer.count) {
          const toAdd = Math.min(5, layer.count - currentCount);
          for (let i = 0; i < toAdd; i++) this.stars.push(this.createStar(layer, index, true));
          added = true;
        }
      });
      if (added) this.resizeTimeout = setTimeout(() => this.refillStep(), 100);
    },

    spawnShootingStar() {
      if (!this.running) return;
      const s = this.shootingPool.get();
      s.x = Math.random() * this.w;
      s.y = Math.random() * this.h / 2;
      s.length = this.w < 600 ? (5 + Math.random() * 10) : (10 + Math.random() * 20);
      s.speed = this.w < 600 ? (8 + Math.random() * 5) : (15 + Math.random() * 10);
      s.colorIndex = (Math.random() * this.colors.length) | 0;
      s.alpha = 1;
      this.shootingStars.push(s);
      this.shootingTimeout = setTimeout(() => this.spawnShootingStar(), Math.random() * 4000 + 3000);
    },

    /* ================= ANIMATE ================= */

    animate(t) {
      if (!this.running) return;
      if (window.EffectController.shouldRender(t)) {
        const warpMult = this.isWarping ? 5 : 1;
        const dpr = this.DPR;

        const limitX = this.w * 0.08;
        const limitY = this.h * 0.08;
        const constrainedX = Math.max(-limitX, Math.min(limitX, this.mouseX));
        const constrainedY = Math.max(-limitY, Math.min(limitY, this.mouseY));

        const targetVX = this.w / 2 - constrainedX;
        const targetVY = this.h / 2 - constrainedY;
        this.vX += (targetVX - this.vX) * 0.04;
        this.vY += (targetVY - this.vY) * 0.04;

        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.fillStyle = `rgba(0, 0, 0, ${this.isWarping ? 0.15 : 0.35})`;
        this.ctx.fillRect(0, 0, this.w, this.h);
        this.ctx.globalCompositeOperation = 'source-over';

        for (let i = this.stars.length - 1; i >= 0; i--) {
            const star = this.stars[i];
            
            star.z -= star.layer.speed * warpMult;
            if (star.z <= 0) {
              star.x = Math.random() * this.w;
              star.y = Math.random() * this.h;
              star.z = this.w;
            }
            
            star.alpha += star.alphaChange;
            if (star.alpha > 1 || star.alpha < 0.2) star.alphaChange *= -1;

            const k = 550 / star.z;
            const x = (star.x - this.vX) * k + this.vX;
            const y = (star.y - this.vY) * k + this.vY;
            let size = star.radius * k * 0.75; 

            this.ctx.globalAlpha = star.alpha;
            if (this.isWarping) {
                // Vector math instead of Math.atan2/rotate
                const dx = x - this.vX;
                const dy = y - this.vY;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const stretch = 1 + (k * 0.05);
                
                // Rotation matrix components based on direction vector
                const cos = dx / dist;
                const sin = dy / dist;

                this.ctx.setTransform(dpr * cos * stretch, dpr * sin * stretch, -dpr * sin, dpr * cos, dpr * x, dpr * y);
                this.ctx.drawImage(this.spriteCache[star.colorIndex], -size, -size, size * 2, size * 2);
            } else {
                this.ctx.setTransform(dpr, 0, 0, dpr, dpr * x, dpr * y);
                this.ctx.drawImage(this.spriteCache[star.colorIndex], -size, -size, size * 2, size * 2);
            }
        }

        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.ctx.globalAlpha = 1;

        for (let i = this.shootingStars.length - 1; i >= 0; i--) {
            const s = this.shootingStars[i];
            s.x += s.speed * warpMult;
            s.y += (s.speed / 3) * warpMult;
            s.alpha -= 0.02 * warpMult;
            if (s.alpha <= 0) {
                this.shootingPool.recycle(this.shootingStars.splice(i, 1)[0]);
                continue;
            }
            this.ctx.beginPath();
            this.ctx.moveTo(s.x, s.y);
            this.ctx.lineTo(s.x - s.length, s.y - s.length / 3);
            this.ctx.strokeStyle = `rgba(${this.colors[s.colorIndex]},${s.alpha})`;
            this.ctx.lineWidth = 1.5;
            this.ctx.stroke();
        }
      }
      this.animationId = requestAnimationFrame((t) => this.animate(t));
    }
  };

  window.EffectController.register("starfield", starfieldEffect);

})();
