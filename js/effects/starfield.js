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
    DPR: window.devicePixelRatio || 1,
    running: false,
    resizeTimeout: null,

    mouseX: 0,
    mouseY: 0,
    isWarping: false,

    colors: [
      '255,99,132', '54,162,235', '255,206,86',
      '75,192,192', '153,102,255', '255,159,64'
    ],
    spriteCache: [],

    start() {
      if (this.running) return;
      this.running = true;

      this.canvas = document.getElementById('network');
      if (!this.canvas) return;

      this.ctx = this.canvas.getContext('2d');
      
      // Reset trạng thái Canvas thông qua Controller chung
      window.EffectController.resetCanvasContext(this.ctx);

      this.initSpriteCache();

      this.resizeHandler = () => this.resize();
      window.addEventListener('resize', this.resizeHandler);

      this.mouseHandler = (e) => {
        if (window.EffectController.isUIElement(e.target)) {
          this.mouseX = 0;
          this.mouseY = 0;
        } else {
          this.mouseX = e.clientX - this.w / 2;
          this.mouseY = e.clientY - this.h / 2;
        }
      };

      this.warpStartHandler = (e) => {
        if (window.EffectController.isUIElement(e.target)) return;
        this.isWarping = true;
      };
      this.warpEndHandler = () => {
        this.isWarping = false;
      };

      document.addEventListener('mousemove', this.mouseHandler);
      document.addEventListener('mousedown', this.warpStartHandler);
      document.addEventListener('mouseup', this.warpEndHandler);
      document.addEventListener('touchstart', this.warpStartHandler, { passive: true });
      document.addEventListener('touchend', this.warpEndHandler, { passive: true });

      this.resize(true);
      this.spawnShootingStar();
      this.animate();
    },

    stop() {
      if (!this.running) return;
      this.running = false;

      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }

      clearTimeout(this.resizeTimeout);

      window.removeEventListener('resize', this.resizeHandler);
      document.removeEventListener('mousemove', this.mouseHandler);
      document.removeEventListener('mousedown', this.warpStartHandler);
      document.removeEventListener('mouseup', this.warpEndHandler);
      document.removeEventListener('touchstart', this.warpStartHandler);
      document.removeEventListener('touchend', this.warpEndHandler);

      if (this.shootingTimeout) {
        clearTimeout(this.shootingTimeout);
      }

      if (this.ctx) {
        this.ctx.clearRect(0, 0, this.w, this.h);
      }

      this.stars = [];
      this.shootingStars = [];
      this.isWarping = false;
    },

    resize(isInitial = false) {

      this.canvas.style.width = window.innerWidth + 'px';
      this.canvas.style.height = window.innerHeight + 'px';

      this.canvas.width = Math.floor(window.innerWidth * this.DPR);
      this.canvas.height = Math.floor(window.innerHeight * this.DPR);

      this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);

      this.w = window.innerWidth;
      this.h = window.innerHeight;

      if (isInitial) {
        this.initStars();
        return;
      }

      const layersConfig = this.getLayersConfig();
      this.stars.forEach(star => {
        star.layer = layersConfig[star.layerIndex];
      });

      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => this.refillStep(), 500);
    },

    getLayersConfig() {
      // Điều chỉnh dải kích thước để cân bằng thị giác
      return [
        {
          count: this.w < 600 ? 60 : 120,
          speed: 6,
          size: this.w < 600 ? [1.2, 2.5] : [2.5, 4.5]
        },
        {
          count: this.w < 600 ? 90 : 180,
          speed: 3,
          size: this.w < 600 ? [0.7, 1.4] : [1.4, 2.4]
        },
        {
          count: this.w < 600 ? 120 : 240,
          speed: 1.5,
          size: this.w < 600 ? [0.4, 1.0] : [0.8, 1.8]
        }
      ];
    },

    initSpriteCache() {
      this.spriteCache = [];
      this.colors.forEach(colorStr => {
        const size = 64; // Dùng 64 để cực nét mà vẫn mượt
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const center = size / 2;
        
        // Vẽ sao đanh thép: lõi đặc chiếm 75% diện tích
        const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
        gradient.addColorStop(0, `rgba(${colorStr}, 1)`);
        gradient.addColorStop(0.75, `rgba(${colorStr}, 0.9)`); // Lõi đặc rộng
        gradient.addColorStop(0.9, `rgba(${colorStr}, 0.2)`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        this.spriteCache.push(canvas);
      });
    },

    createStar(layer, layerIndex, atDistance = false) {
      const colorIndex = Math.floor(Math.random() * this.colors.length);
      return {
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        z: atDistance ? this.w : Math.random() * this.w,
        radius: layer.size[0] + Math.random() * (layer.size[1] - layer.size[0]),
        colorIndex: colorIndex,
        alpha: Math.random() * 0.5 + 0.5,
        layer: layer,
        layerIndex: layerIndex,
        alphaChange: Math.random() * 0.02 + 0.005
      };
    },

    initStars() {
      this.stars = [];
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
          const toAdd = Math.min(3, layer.count - currentCount);
          for (let i = 0; i < toAdd; i++) {
            this.stars.push(this.createStar(layer, index, true));
          }
          added = true;
        }
      });

      if (added) {
        this.resizeTimeout = setTimeout(() => this.refillStep(), 800);
      }
    },

    spawnShootingStar() {

      const star = {
        x: Math.random() * this.w,
        y: Math.random() * this.h / 2,
        length: this.w < 600
          ? 5 + Math.random() * 10
          : 10 + Math.random() * 20,
        speed: this.w < 600
          ? 8 + Math.random() * 5
          : 15 + Math.random() * 10,
        colorIndex: Math.floor(Math.random() * this.colors.length),
        alpha: 1
      };

      this.shootingStars.push(star);

      this.shootingTimeout = setTimeout(
        () => this.spawnShootingStar(),
        Math.random() * 4000 + 3000
      );
    },

    updateStars() {
      const layersConfig = this.getLayersConfig();
      const layerCounts = layersConfig.map(l => l.count);
      const totalInLayer = new Array(layersConfig.length).fill(0);
      this.stars.forEach(s => totalInLayer[s.layerIndex]++);

      // Tốc độ Warp: X5 tốc độ bình thường
      const warpMult = this.isWarping ? 5 : 1;

      for (let i = this.stars.length - 1; i >= 0; i--) {

        const star = this.stars[i];

        star.z -= star.layer.speed * warpMult;

        if (star.z <= 0) {
          if (totalInLayer[star.layerIndex] > layerCounts[star.layerIndex]) {
            this.stars.splice(i, 1);
            totalInLayer[star.layerIndex]--;
            continue;
          }
          star.x = Math.random() * this.w;
          star.y = Math.random() * this.h;
          star.z = this.w;
        }

        // Độ trôi theo chuột cũng tăng lên khi Warp
        star.x += this.mouseX * 0.0005 * star.layer.speed * warpMult;
        star.y += this.mouseY * 0.0005 * star.layer.speed * warpMult;

        star.alpha += star.alphaChange;
        if (star.alpha > 1 || star.alpha < 0.2) {
          star.alphaChange *= -1;
        }
      }

      for (let i = this.shootingStars.length - 1; i >= 0; i--) {

        const s = this.shootingStars[i];

        s.x += s.speed * warpMult;
        s.y += (s.speed / 3) * warpMult;
        s.alpha -= 0.02 * warpMult;

        if (s.alpha <= 0) {
          this.shootingStars.splice(i, 1);
        }
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
        
        // Tỉ lệ chuẩn hóa để giống bản cũ
        let size = star.radius * k * 0.55; 

        this.ctx.globalAlpha = star.alpha;
        
        if (this.isWarping) {
            const stretch = 1 + (k * 0.05);
            const angle = Math.atan2(y - this.h / 2, x - this.w / 2);
            
            this.ctx.save();
            this.ctx.translate(x, y);
            this.ctx.rotate(angle);
            // Dùng drawing size = size * 2 để khớp với ảnh 64x64
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