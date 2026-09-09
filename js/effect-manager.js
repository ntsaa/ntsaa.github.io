// effect-manager.js
(function () {

    /* ============================= */
    /*  CONFIG                       */
    /* ============================= */

    const ICON_MAP = {
        singularity: "🔆",
        starfield: "✨",
        drift: "🌀",
        fireworks: "🎆",
        peach: "🌸"
    };

    const TET_EFFECTS = ["fireworks", "peach"];
    const NORMAL_EFFECTS = ["singularity", "starfield", "drift"];

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
            this.toggleBtn = toggleBtn; // Left: Change Effect
            this.offBtn = offBtn;       // Right: Cycle 3 modes (ON_VISIBLE / OFF_VISIBLE / ON_HIDDEN)

            this.pool = isTetSeason()
                ? TET_EFFECTS
                : NORMAL_EFFECTS;

            this.index = 0;
            // 0: ON_VISIBLE (Bật hiệu ứng + Hiện text)
            // 1: OFF_VISIBLE (Tắt hiệu ứng + Hiện text)
            // 2: ON_HIDDEN (Bật hiệu ứng + Ẩn text để tương tác toàn màn hình)
            this.cycleState = 0;

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
            this.updateOffIcon();

            this.bindEvents();
        }

        bindEvents() {

            // Nút Trái: Chuyển hiệu ứng kế tiếp
            this.toggleBtn?.addEventListener("click", () => {
                // Nếu hiệu ứng đang tắt (trạng thái 1), tự động bật lại
                if (this.cycleState === 1) {
                    this.cycleState = 0; // Chuyển về trạng thái ON_VISIBLE
                    this.EC.toggleEffects(true);
                    this.updateOffIcon();
                }
                this.next();
            });

            // Nút Phải: Xoay vòng 3 chế độ (Bật/Hiện) -> (Tắt/Hiện) -> (Bật/Ẩn)
            this.offBtn?.addEventListener("click", () => {
                this.cycleState = (this.cycleState + 1) % 3;
                this.applyState();
            });

            // Header quick hotkey: Nhấp vào Header để thoát chế độ ẩn chữ (quay lại hiện text + hiệu ứng)
            const header = document.querySelector('header');
            header?.addEventListener("click", () => {
                if (this.cycleState === 2) {
                    this.cycleState = 0; // Về trạng thái ON_VISIBLE (hiện text kèm hiệu ứng)
                    this.applyState();
                }
            });
        }

        applyState() {
            switch (this.cycleState) {
                case 0: // ON_VISIBLE
                    this.EC.toggleEffects(true);
                    this.EC.toggleContent(true);
                    break;
                case 1: // OFF_VISIBLE
                    this.EC.toggleEffects(false);
                    this.EC.toggleContent(true);
                    break;
                case 2: // ON_HIDDEN (Toàn màn hình hiệu ứng)
                    this.EC.toggleEffects(true);
                    this.EC.toggleContent(false);
                    break;
            }
            this.updateOffIcon();
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

        updateOffIcon() {
            // 0: ON, 1: OFF, 2: HIDDEN (A)
            const icons = ["🤖", "💤", "🌈"];
            if (this.offBtn) {
                this.offBtn.textContent = icons[this.cycleState];
                const lang = window.getCurrentLang ? window.getCurrentLang() : "vn";
                const titles = {
                    vn: ["Hiệu ứng: Bật", "Hiệu ứng: Tắt", "Chỉ hiệu ứng (Nhấp Header để hiện lại chữ)"],
                    en: ["Effects: On", "Effects: Off", "Effects Only (Click Header to restore text)"]
                };
                const langTitles = titles[lang] || titles.en;
                this.offBtn.title = langTitles[this.cycleState];
            }
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

        window.effectManager = new EffectManager(EC, toggleBtn, offBtn);
    };

})();
