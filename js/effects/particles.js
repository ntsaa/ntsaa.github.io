// particles.js
function initParticles() {
  const canvas = document.getElementById('network');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  const DPR = window.devicePixelRatio || 1;
  let w = window.innerWidth, h = window.innerHeight;

  const num = 190;
  const maxDist = 110;
  const particles = [];
  let animationId;

  function resize() {
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    canvas.width = Math.floor(window.innerWidth * DPR);
    canvas.height = Math.floor(window.innerHeight * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    w = window.innerWidth;
    h = window.innerHeight;
  }
  window.addEventListener('resize', resize);

  function init() {
    particles.length = 0;
    for (let i = 0; i < num; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.9,
        vy: (Math.random() - 0.5) * 0.9,
        r: 1 + Math.random() * 1.2
      });
    }
  }

  const mouse = { x: null, y: null, radius: 150 };
  window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  window.addEventListener('mouseleave', () => {
    mouse.x = null;
    mouse.y = null;
  });

  function animate() {
    ctx.clearRect(0, 0, w, h);
    const hue = (Date.now() / 50) % 360;

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x <= 0 || p.x >= w) p.vx *= -1;
      if (p.y <= 0 || p.y >= h) p.vy *= -1;

      if (mouse.x !== null) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.hypot(dx, dy);
        if (dist < mouse.radius && dist > 0.001) {
          const ang = Math.atan2(dy, dx);
          const push = (mouse.radius - dist) / mouse.radius;
          p.vx += Math.cos(ang) * push * 0.1;
          p.vy += Math.sin(ang) * push * 0.1;
        }
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue}, 80%, 70%, 0.5)`;
      ctx.fill();
    }

    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i], b = particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d < maxDist) {
          const alpha = (1 - d / maxDist) * 0.3;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `hsla(${hue}, 80%, 70%, ${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }

    animationId = requestAnimationFrame(animate);
  }

  resize();
  init();
  animate();

  window._particlesCleanup = () => {
    cancelAnimationFrame(animationId);
    ctx.clearRect(0, 0, w, h);
  };
}

function destroyParticles() {
  if (window._particlesCleanup) {
    window._particlesCleanup();
    delete window._particlesCleanup;
  }
}
