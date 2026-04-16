// effects.js
(function () {

    class EffectController {

        constructor() {
            this.effects = {};      // { name: instance }
            this.loadedScripts = {}; // { name: Promise }
            this.current = null;    // current effect name
            this.enabled = false;   // global on/off
            this.contentVisible = true;
        }

        /* ============================= */
        /*  CONTENT VISIBILITY           */
        /* ============================= */

        toggleContent(show) {
            this.contentVisible = show === undefined ? !this.contentVisible : show;
            const contentEl = document.getElementById('content');

            if (contentEl) {
                if (this.contentVisible) {
                    contentEl.style.display = '';
                    contentEl.offsetHeight; 
                    contentEl.classList.add('fade-in');
                } else {
                    contentEl.style.display = 'none';
                    contentEl.classList.remove('fade-in');
                }
            }
            
            document.body.style.overflow = this.contentVisible ? '' : 'hidden';
        }

        /* ============================= */
        /*  LAZY LOAD                    */
        /* ============================= */

        async loadEffect(name) {
            if (this.effects[name]) return true;
            if (this.loadedScripts[name]) return this.loadedScripts[name];

            this.loadedScripts[name] = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = `js/effects/${name}.js`;
                script.async = true;
                script.onload = () => resolve(true);
                script.onerror = () => {
                    delete this.loadedScripts[name];
                    reject(new Error(`Failed to load effect: ${name}`));
                };
                document.body.appendChild(script);
            });

            return this.loadedScripts[name];
        }

        /* ============================= */
        /*  REGISTER                     */
        /* ============================= */

        register(name, instance) {
            if (!name || !instance) return;
            this.effects[name] = instance;
        }

        /* ============================= */
        /*  HELPER                       */
        /* ============================= */

        resetCanvasContext(ctx) {
            if (!ctx) return;
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            ctx.shadowBlur = 0;
            ctx.shadowColor = "transparent";
            ctx.filter = "none";
            ctx.imageSmoothingEnabled = true;
            ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform về mặc định
        }

        /* ============================= */
        /*  UI CHECK                     */
        /* ============================= */

        isUIElement(target) {
            return !!(target && (target.closest('header') || target.closest('footer') || target.closest('#toggle-off') || target.closest('#toggle-effect')));
        }

        /* ============================= */
        /*  SET EFFECT                   */
        /* ============================= */

        async setEffect(name) {
            if (this.current === name && this.enabled) return;

            try {
                await this.loadEffect(name);
            } catch (err) {
                console.error(err);
                return;
            }

            if (!this.effects[name]) return;

            // Nếu đang bật hiệu ứng, thực hiện chuyển cảnh mờ dần (Fade transition)
            if (this.enabled && this.current && this.effects[this.current]) {
                const canvas = document.getElementById('network');
                if (canvas) {
                    canvas.style.transition = 'opacity 0.4s ease-in-out';
                    canvas.style.opacity = '0';
                    
                    // Đợi mờ dần xong mới đổi sang hiệu ứng mới
                    setTimeout(() => {
                        this.effects[this.current]?.stop?.();
                        this.current = name;
                        
                        canvas.style.transition = 'none';
                        canvas.style.opacity = '1';
                        this.effects[name].start?.();
                    }, 400);
                    return;
                }
            }

            // Nếu không có hiệu ứng cũ hoặc đang tắt, bật thẳng hiệu ứng mới
            if (this.current && this.effects[this.current]) {
                this.effects[this.current].stop?.();
            }
            this.current = name;
            if (this.enabled) {
                this.effects[name].start?.();
            }
        }

        getCurrent() {
            return this.current;
        }

        getAvailableEffects() {
            return Object.keys(this.effects);
        }

        /* ============================= */
        /*  TOGGLE                       */
        /* ============================= */

        toggleEffects(state) {
            state = state === undefined ? !this.enabled : state;
            this.enabled = state;

            if (!this.current) return;

            const canvas = document.getElementById('network');
            if (state) {
                if (canvas) {
                    canvas.style.transition = 'none';
                    canvas.style.opacity = '1';
                }
                this.effects[this.current]?.start?.();
            } else {
                // Khi tắt hiệu ứng cũng mờ dần cho chuyên nghiệp
                if (canvas) {
                    canvas.style.transition = 'opacity 0.5s ease-in-out';
                    canvas.style.opacity = '0';
                    setTimeout(() => {
                        if (!this.enabled) { // Kiểm tra lại đề phòng user bật lại nhanh
                            this.effects[this.current]?.stop?.();
                        }
                    }, 500);
                } else {
                    this.effects[this.current]?.stop?.();
                }
            }
        }

        /* ============================= */
        /*  DESTROY (optional)           */
        /* ============================= */

        destroyAll() {
            Object.values(this.effects).forEach(effect => {
                effect.stop?.();
            });
            this.enabled = false;
            this.current = null;
        }

    }

    window.EffectController = new EffectController();

})();