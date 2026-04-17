// effects.js
(function () {

    class EffectController {

        constructor() {
            this.effects = {};      
            this.loadedScripts = {}; 
            this.current = null;    
            this.enabled = false;   
            this.contentVisible = true;

            const rawDPR = window.devicePixelRatio || 1;
            this.DPR = Math.min(2, Math.max(1, rawDPR));

            this.sinTable = new Float32Array(360);
            this.cosTable = new Float32Array(360);
            for (let i = 0; i < 360; i++) {
                const rad = (i * Math.PI) / 180;
                this.sinTable[i] = Math.sin(rad);
                this.cosTable[i] = Math.cos(rad);
            }

            this.caches = {}; 
            this.fpsLimit = 60; 
            this.lastFrameTime = 0;
            
            this.performanceScale = 1.0; 
            this.fpsHistory = [];
            this.lastFpsCheck = 0;
            this.isThrottled = false;

            this.interaction = {
                x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0,
                isDown: false, isValid: false, isOverUI: false, lastMoveTime: 0
            };

            this.transitioning = false;
            
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                this.performanceScale = 0.2;
            }

            this.initInteractionListeners();
            this.initVisibilityListener();
        }

        initInteractionListeners() {
            const update = (e) => {
                const isTouch = e.type.startsWith('touch');
                const t = isTouch ? (e.touches[0] || e.changedTouches[0]) : e;
                this.interaction.isValid = true;
                this.interaction.isOverUI = this.isUIElement(e.target);
                this.interaction.px = this.interaction.x;
                this.interaction.py = this.interaction.y;
                this.interaction.x = t.clientX;
                this.interaction.y = t.clientY;
                this.interaction.lastMoveTime = performance.now();
                this.interaction.vx = this.interaction.x - this.interaction.px;
                this.interaction.vy = this.interaction.y - this.interaction.py;
            };

            const down = (e) => { this.interaction.isDown = true; update(e); };
            const up = () => { this.interaction.isDown = false; };

            window.addEventListener('mousemove', update, { passive: true });
            window.addEventListener('mousedown', down, { passive: true });
            window.addEventListener('mouseup', up, { passive: true });
            window.addEventListener('mouseleave', () => { this.interaction.isValid = false; });
            window.addEventListener('touchstart', down, { passive: true });
            window.addEventListener('touchmove', update, { passive: true });
            window.addEventListener('touchend', up, { passive: true });
        }

        updatePerformance(now) {
            if (now - this.interaction.lastMoveTime > 100) {
                this.interaction.vx *= 0.8; this.interaction.vy *= 0.8;
            }
            if (now - this.lastFpsCheck < 1000) return;
            const delta = now - this.lastFrameTime;
            const currentFps = 1000 / delta;
            this.fpsHistory.push(currentFps);
            if (this.fpsHistory.length > 5) this.fpsHistory.shift();
            const avgFps = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
            if (avgFps < 40 && !this.isThrottled && this.fpsHistory.length >= 5) {
                this.performanceScale = 0.5; this.isThrottled = true;
                this.recalculateCurrentEffect();
            } else if (avgFps > 55 && this.isThrottled) {
                this.performanceScale = 0.8; this.isThrottled = false;
                this.recalculateCurrentEffect();
            }
            this.lastFpsCheck = now;
        }

        recalculateCurrentEffect() {
            if (this.current && this.effects[this.current]) this.effects[this.current].resize?.();
        }

        getCSSVar(name, fallback) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback; }
        fastSin(deg) { return this.sinTable[((deg | 0) % 360 + 360) % 360]; }
        fastCos(deg) { return this.cosTable[((deg | 0) % 360 + 360) % 360]; }

        getCache(name, initFn) {
            if (!this.caches[name]) this.caches[name] = initFn();
            return this.caches[name];
        }

        createPool(factoryFn, resetFn = null, initialSize = 100) {
            const pool = [];
            for (let i = 0; i < initialSize; i++) pool.push(factoryFn());
            return {
                get: () => pool.pop() || factoryFn(),
                recycle: (obj) => { if (typeof resetFn === 'function') resetFn(obj); pool.push(obj); }
            };
        }

        drawSprite(ctx, sprite, x, y, size, rotation = 0, alpha = 1) {
            if (alpha <= 0 || !sprite) return;
            const dpr = this.DPR;
            ctx.globalAlpha = alpha;
            if (rotation === 0) {
                ctx.setTransform(dpr, 0, 0, dpr, dpr * x, dpr * y);
            } else {
                const cos = Math.cos(rotation);
                const sin = Math.sin(rotation);
                ctx.setTransform(dpr * cos, dpr * sin, -dpr * sin, dpr * cos, dpr * x, dpr * y);
            }
            ctx.drawImage(sprite, -size, -size, size * 2, size * 2);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0); 
            ctx.globalAlpha = 1;
        }

        initVisibilityListener() {
            document.addEventListener('visibilitychange', () => {
                const effect = this.effects[this.current];
                if (document.hidden) { if (this.enabled && effect) effect.stop?.(); } 
                else { if (this.enabled && effect) effect.start?.(); }
            });
        }

        shouldRender(now) {
            this.updatePerformance(now);
            const interval = 1000 / this.fpsLimit;
            const delta = now - this.lastFrameTime;
            if (delta >= interval) {
                this.lastFrameTime = now - (delta % interval);
                return true;
            }
            return false;
        }

        toggleContent(show) {
            this.contentVisible = show === undefined ? !this.contentVisible : show;
            const el = document.getElementById('content');
            if (el) {
                if (this.contentVisible) { el.style.display = ''; el.classList.add('fade-in'); } 
                else { el.style.display = 'none'; el.classList.remove('fade-in'); }
            }
            document.body.style.overflow = this.contentVisible ? '' : 'hidden';
        }

        async loadEffect(name) {
            if (this.effects[name]) return true;
            if (this.loadedScripts[name]) return this.loadedScripts[name];
            this.loadedScripts[name] = new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = `js/effects/${name}.js`; s.async = true;
                s.onload = () => resolve(true);
                s.onerror = () => { delete this.loadedScripts[name]; reject(new Error(name)); };
                document.body.appendChild(s);
            });
            return this.loadedScripts[name];
        }

        register(name, instance) { this.effects[name] = instance; }

        resetCanvasContext(ctx) {
            if (!ctx) return;
            ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
            ctx.setTransform(1, 0, 0, 1, 0, 0);
        }

        isUIElement(target) {
            return !!(target && (target.closest('header') || target.closest('footer') || target.closest('#toggle-off') || target.closest('#toggle-effect')));
        }

        async setEffect(name) {
            if (this.current === name || this.transitioning) return;
            try { await this.loadEffect(name); } catch (e) { return; }

            const canvas = document.getElementById('network');
            if (!this.enabled) {
                if (this.current) this.effects[this.current]?.stop?.();
                this.current = name;
                return;
            }

            // Fix Flicker: Fade-out OLD -> Stop -> Swap -> Start NEW -> Fade-in
            if (this.current && canvas) {
                this.transitioning = true;
                canvas.style.transition = 'opacity 0.25s ease-in-out';
                canvas.style.opacity = '0';
                
                setTimeout(() => {
                    this.effects[this.current]?.stop?.();
                    this.current = name;
                    this.effects[this.current].start?.();
                    canvas.style.opacity = '1';
                    setTimeout(() => { this.transitioning = false; }, 250);
                }, 250);
            } else {
                this.current = name;
                this.effects[name].start?.();
            }
        }

        toggleEffects(state) {
            state = state === undefined ? !this.enabled : state;
            this.enabled = state;
            const effect = this.effects[this.current];
            const canvas = document.getElementById('network');
            if (state) {
                if (canvas) { canvas.style.transition = 'opacity 0.3s ease-in-out'; canvas.style.opacity = '1'; }
                if (this.current) effect?.start?.();
            } else {
                if (canvas) {
                    canvas.style.transition = 'opacity 0.4s ease-in-out';
                    canvas.style.opacity = '0';
                    setTimeout(() => { if (!this.enabled) effect?.stop?.(); }, 400);
                } else {
                    effect?.stop?.();
                }
            }
        }
    }

    window.EffectController = new EffectController();
})();