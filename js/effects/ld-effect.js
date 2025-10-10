// ld-effect.js
function initLDEffect() {
  const canvas = document.getElementById('network');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;

  let w = window.innerWidth;
  let h = window.innerHeight;
  canvas.width = w;
  canvas.height = h;

  const numParticles = 500;
  const particles = [];
  let animationId;

  class Particle {
    constructor() {
      this.x = Math.random() * w;
      this.y = Math.random() * h;
      this.size = Math.random() * 1.2 + 0.3; // nhỏ, mịn
      this.speedX = (Math.random() - 0.5) * 1.5; // tăng tốc độ nhẹ
      this.speedY = (Math.random() - 0.5) * 1.5;
      this.hueOffset = Math.random() * 360; // mỗi hạt 1 pha màu riêng
    }

    update() {
      this.x += this.speedX;
      this.y += this.speedY;

      // Xuyên màn hình
      if (this.x < 0) this.x = w;
      if (this.x > w) this.x = 0;
      if (this.y < 0) this.y = h;
      if (this.y > h) this.y = 0;
    }

    draw() {
      const hue = (Date.now() / 50 + this.hueOffset) % 360;
      const color = `hsla(${hue}, 80%, 70%, 0.5)`; // nhạt vừa đủ
      ctx.fillStyle = color;
      ctx.shadowBlur = this.size * 2;       // glow nhẹ
      ctx.shadowColor = color;

      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0; // reset
    }
  }

  function createParticles() {
    particles.length = 0;
    for (let i = 0; i < numParticles; i++) {
      particles.push(new Particle());
    }
  }

  function animate() {
    if (window._stopLDEffect) return;

    // trail nhẹ, giữ hạt nổi bật
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(0, 0, w, h);

    particles.forEach(p => {
      p.update();
      p.draw();
    });

    animationId = requestAnimationFrame(animate);
  }

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
  }

  window.addEventListener('resize', resize);

  window._stopLDEffect = false;
  createParticles();
  animate();

  // cleanup function
  window._ldCleanup = () => {
    window._stopLDEffect = true;
    cancelAnimationFrame(animationId);
    ctx.clearRect(0, 0, w, h);
  };
}

function destroyLDEffect() {
  if (window._ldCleanup) {
    window._ldCleanup();
    delete window._ldCleanup;
  }
}
