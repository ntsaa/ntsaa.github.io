// starfield.js
function initStarfield() {
  const canvas = document.getElementById('network');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;

  let w = window.innerWidth;
  let h = window.innerHeight;
  canvas.width = w;
  canvas.height = h;

  let animationId;
  let mouseX = 0, mouseY = 0;

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
    initStars();
  }
  window.addEventListener('resize', resize);

  document.addEventListener('mousemove', e => {
    mouseX = e.clientX - w / 2;
    mouseY = e.clientY - h / 2;
  });

  // --- Layer config ---
  const layersConfig = [
    {
      count: w < 600 ? 60 : 120,
      speed: 6,
      size: w < 600 ? [1, 2] : [2, 4]
    },
    {
      count: w < 600 ? 90 : 180,
      speed: 3,
      size: w < 600 ? [0.5, 1] : [1, 2]
    },
    {
      count: w < 600 ? 120 : 240,
      speed: 1.5,
      size: w < 600 ? [0.2, 0.8] : [0.5, 1.5]
    }
  ];
  const colors = [
    '255,99,132', '54,162,235', '255,206,86',
    '75,192,192', '153,102,255', '255,159,64'
  ];

  let stars = [];
  let shootingStars = [];

  function initStars() {
    stars = [];
    layersConfig.forEach(layer => {
      for (let i = 0; i < layer.count; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          z: Math.random() * w,
          radius: layer.size[0] + Math.random() * (layer.size[1] - layer.size[0]),
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: Math.random() * 0.5 + 0.5,
          layer: layer,
          alphaChange: Math.random() * 0.02 + 0.005
        });
      }
    });
  }

  function spawnShootingStar() {
    if (window._stopStarfield) return;
    const star = {
      x: Math.random() * w,
      y: Math.random() * h / 2,
      length: w < 600 ? 5 + Math.random() * 10 : 10 + Math.random() * 20,
      speed: w < 600 ? 8 + Math.random() * 5 : 15 + Math.random() * 10,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1
    };
    shootingStars.push(star);
    setTimeout(spawnShootingStar, Math.random() * 4000 + 3000);
  }

  spawnShootingStar();
  initStars();

  function updateStars() {
    stars.forEach(star => {
      star.z -= star.layer.speed;
      if (star.z <= 0) {
        star.x = Math.random() * w;
        star.y = Math.random() * h;
        star.z = w;
      }
      star.x += mouseX * 0.0005 * star.layer.speed;
      star.y += mouseY * 0.0005 * star.layer.speed;

      star.alpha += star.alphaChange;
      if (star.alpha > 1 || star.alpha < 0.2) star.alphaChange *= -1;
    });

    shootingStars.forEach((s, i) => {
      s.x += s.speed;
      s.y += s.speed / 3;
      s.alpha -= 0.02;
      if (s.alpha <= 0) shootingStars.splice(i, 1);
    });
  }

  function drawStars() {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; // trail nhẹ
    ctx.fillRect(0, 0, w, h);

    stars.forEach(star => {
      const k = 500 / star.z;
      const x = (star.x - w / 2) * k + w / 2;
      const y = (star.y - h / 2) * k + h / 2;
      const radius = star.radius * k * 0.5;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${star.color},${star.alpha})`;
      ctx.shadowBlur = radius * 1.5; 
      ctx.shadowColor = `rgba(${star.color},${star.alpha})`;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    shootingStars.forEach(s => {
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.length, s.y - s.length / 3);
      ctx.strokeStyle = `rgba(${s.color},${s.alpha})`;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 6;
      ctx.shadowColor = `rgba(${s.color},${s.alpha})`;
      ctx.stroke();
      ctx.shadowBlur = 0;
    });
  }

  function animate() {
    if (window._stopStarfield) return;
    updateStars();
    drawStars();
    animationId = requestAnimationFrame(animate);
  }

  window._stopStarfield = false;
  animate();

  window._starfieldCleanup = () => {
    window._stopStarfield = true;
    cancelAnimationFrame(animationId);
    ctx.clearRect(0, 0, w, h);
  };
}

function destroyStarfield() {
  if (window._starfieldCleanup) {
    window._starfieldCleanup();
    delete window._starfieldCleanup;
  }
}
