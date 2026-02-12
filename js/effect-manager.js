// effect-manager.js
(function () {

    /* ============================= */
    /*  CONFIG                       */
    /* ============================= */

    const ICON_MAP = {
        particles: "💠",
        starfield: "✨",
        drift: "💫",
        fireworks: "🎆",
        sakura: "🌸"
    };

    const TET_EFFECTS = ["fireworks", "sakura"];
    const NORMAL_EFFECTS = ["particles", "starfield", "drift"];

    /* ============================= */
    /*  SEASON CHECK                 */
    /* ============================= */

    function isTetSeason() {

        const now = new Date();
        const year = now.getFullYear();

        const start = new Date(year, 11, 25); // 25 Dec
        const end = new Date(year + 1, 2, 15); // 15 Mar

        if (now.getMonth() <= 2) {
            start.setFullYear(year - 1);
            end.setFullYear(year);
        }

        return (now >= start && now <= end);
    }

    /* ============================= */
    /*  MANAGER CLASS                */
    /* ============================= */

    class EffectManager {

        constructor(controller, toggleBtn, offBtn) {

            this.EC = controller;
            this.toggleBtn = toggleBtn;
            this.offBtn = offBtn;

            this.pool = isTetSeason()
                ? TET_EFFECTS
                : NORMAL_EFFECTS;

            this.index = 0;

            this.init();
        }

        /* ============================= */
        /*  INIT                         */
        /* ============================= */

        init() {

            if (!this.pool.length) return;

            this.randomStart();
            this.EC.toggleEffects(true);
            this.updateIcon();

            this.bindEvents();
        }

        bindEvents() {

            this.toggleBtn?.addEventListener("click", () => {
                this.next();
            });

            this.offBtn?.addEventListener("click", () => {
                this.EC.toggleEffects(false);
            });
        }

        /* ============================= */
        /*  RANDOM START                 */
        /* ============================= */

        randomStart() {

            this.index = Math.floor(Math.random() * this.pool.length);
            this.EC.setEffect(this.pool[this.index]);
        }

        /* ============================= */
        /*  NEXT EFFECT                  */
        /* ============================= */

        next() {

            this.index = (this.index + 1) % this.pool.length;
            this.EC.setEffect(this.pool[this.index]);
            this.updateIcon();
        }

        /* ============================= */
        /*  ICON UPDATE                  */
        /* ============================= */

        updateIcon() {

            const name = this.pool[this.index];
            this.toggleBtn.textContent = ICON_MAP[name] || "✨";
        }

    }

    /* ============================= */
    /*  GLOBAL INIT                  */
    /* ============================= */

    window.initEffectManager = function () {

        const EC = window.EffectController;
        const toggleBtn = document.getElementById("toggle-effect");
        const offBtn = document.getElementById("toggle-off");

        if (!EC || !toggleBtn || !offBtn) return;

        new EffectManager(EC, toggleBtn, offBtn);
    };

})();
