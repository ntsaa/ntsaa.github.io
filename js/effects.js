// effects.js
(function () {

    class EffectController {

        constructor() {
            this.effects = {};      // { name: instance }
            this.current = null;    // current effect name
            this.enabled = false;   // global on/off
        }

        /* ============================= */
        /*  REGISTER                     */
        /* ============================= */

        register(name, instance) {
            if (!name || !instance) return;
            this.effects[name] = instance;
        }

        /* ============================= */
        /*  SET EFFECT                   */
        /* ============================= */

        setEffect(name) {
            if (!this.effects[name]) return;

            // Stop old
            if (this.current && this.effects[this.current]) {
                this.effects[this.current].stop?.();
            }

            this.current = name;

            // Start new if enabled
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

            this.enabled = state;

            if (!this.current) return;

            if (state) {
                this.effects[this.current]?.start?.();
            } else {
                this.effects[this.current]?.stop?.();
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
