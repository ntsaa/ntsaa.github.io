// starfield.js
(function () {

  const starfieldEffect = {

    animationId: null,
    canvas: null,
    ctx: null,
    resizeHandler: null,
    mouseHandler: null,
    shootingTimeout: null,

    stars: [],
    shootingStars: [],

    w: 0,
    h: 0,
    DPR: window.devicePixelRatio || 1,

    mouseX: 0,
    mouseY: 0,

    colors: [
      '255,99,132', '54,162,235', '255,206,86',
      '75,192,192', '153,102,255', '255,159,64'
    ],

    start() {
      if (this.animationId) return;
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

      this.mouseHandler = (e) => {
        this.mouseX = e.clientX - this.w / 2;
        this.mouseY = e.clientY - this.h / 2;
      };
      document.addEventListener('mousemove', this.mouseHandler);

      this.resize();
      this.initStars();
      this.spawnShootingStar();
      this.animate();
    },

    stop() {

      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;   // bắt buộc reset
      }

      if (this.resizeHandler) {
        window.removeEventListener('resize', this.resizeHandler);
      }

      if (this.mouseHandler) {
        document.removeEventListener('mousemove', this.mouseHandler);
      }

      if (this.shootingTimeout) {
        clearTimeout(this.shootingTimeout);
      }

      if (this.ctx) {
        this.ctx.clearRect(0, 0, this.w, this.h);
      }

      this.stars = [];
      this.shootingStars = [];
    },

    resize() {

      this.canvas.style.width = window.innerWidth + 'px';
      this.canvas.style.height = window.innerHeight + 'px';

      this.canvas.width = Math.floor(window.innerWidth * this.DPR);
      this.canvas.height = Math.floor(window.innerHeight * this.DPR);

      this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);

      this.w = window.innerWidth;
      this.h = window.innerHeight;

      this.initStars();
    },

    getLayersConfig() {

      return [
        {
          count: this.w < 600 ? 60 : 120,
          speed: 6,
          size: this.w < 600 ? [1, 2] : [2, 4]
        },
        {
          count: this.w < 600 ? 90 : 180,
          speed: 3,
          size: this.w < 600 ? [0.5, 1] : [1, 2]
        },
        {
          count: this.w < 600 ? 120 : 240,
          speed: 1.5,
          size: this.w < 600 ? [0.2, 0.8] : [0.5, 1.5]
        }
      ];
    },

    initStars() {

      this.stars = [];
      const layersConfig = this.getLayersConfig();

      layersConfig.forEach(layer => {
        for (let i = 0; i < layer.count; i++) {
          this.stars.push({
            x: Math.random() * this.w,
            y: Math.random() * this.h,
            z: Math.random() * this.w,
            radius: layer.size[0] + Math.random() * (layer.size[1] - layer.size[0]),
            color: this.colors[Math.floor(Math.random() * this.colors.length)],
            alpha: Math.random() * 0.5 + 0.5,
            layer: layer,
            alphaChange: Math.random() * 0.02 + 0.005
          });
        }
      });
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
        color: this.colors[Math.floor(Math.random() * this.colors.length)],
        alpha: 1
      };

      this.shootingStars.push(star);

      this.shootingTimeout = setTimeout(
        () => this.spawnShootingStar(),
        Math.random() * 4000 + 3000
      );
    },

    updateStars() {

      this.stars.forEach(star => {

        star.z -= star.layer.speed;

        if (star.z <= 0) {
          star.x = Math.random() * this.w;
          star.y = Math.random() * this.h;
          star.z = this.w;
        }

        star.x += this.mouseX * 0.0005 * star.layer.speed;
        star.y += this.mouseY * 0.0005 * star.layer.speed;

        star.alpha += star.alphaChange;
        if (star.alpha > 1 || star.alpha < 0.2) {
          star.alphaChange *= -1;
        }
      });

      for (let i = this.shootingStars.length - 1; i >= 0; i--) {

        const s = this.shootingStars[i];

        s.x += s.speed;
        s.y += s.speed / 3;
        s.alpha -= 0.02;

        if (s.alpha <= 0) {
          this.shootingStars.splice(i, 1);
        }
      }
    },

    drawStars() {

      this.ctx.fillStyle = 'rgba(0,0,0,0.25)';
      this.ctx.fillRect(0, 0, this.w, this.h);

      this.stars.forEach(star => {

        const k = 500 / star.z;
        const x = (star.x - this.w / 2) * k + this.w / 2;
        const y = (star.y - this.h / 2) * k + this.h / 2;
        const radius = star.radius * k * 0.5;

        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(${star.color},${star.alpha})`;
        this.ctx.shadowBlur = radius * 1.5;
        this.ctx.shadowColor = `rgba(${star.color},${star.alpha})`;
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
      });

      this.shootingStars.forEach(s => {

        this.ctx.beginPath();
        this.ctx.moveTo(s.x, s.y);
        this.ctx.lineTo(s.x - s.length, s.y - s.length / 3);
        this.ctx.strokeStyle = `rgba(${s.color},${s.alpha})`;
        this.ctx.lineWidth = 2;
        this.ctx.shadowBlur = 6;
        this.ctx.shadowColor = `rgba(${s.color},${s.alpha})`;
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
      });
    },

    animate() {

      this.updateStars();
      this.drawStars();

      this.animationId = requestAnimationFrame(() => this.animate());
    }

  };

  window.EffectController.register("starfield", starfieldEffect);

})();
