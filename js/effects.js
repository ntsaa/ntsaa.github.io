(function(global) {
    let enabled = false;
    let currentIndex = 0;

    const effects = [
        { name: "particles", init: global.initParticles, destroy: global.destroyParticles },
        { name: "starfield", init: global.initStarfield, destroy: global.destroyStarfield },
        { name: "ld-effect", init: global.initLDEffect, destroy: global.destroyLDEffect }
    ];

    function loadEffect(index) {
        effects.forEach((eff, i) => {
            if (typeof eff.destroy === "function") eff.destroy();
        });
        if (enabled && typeof effects[index].init === "function") effects[index].init();
        currentIndex = index;
    }

    function toggleEffects(on) {
        enabled = !!on;
        if (!enabled) {
            effects.forEach(eff => {
                if (typeof eff.destroy === "function") eff.destroy();
            });
        } else {
            loadEffect(currentIndex);
        }
    }

    global.EffectController = {
        loadEffect,
        nextEffect: () => loadEffect((currentIndex + 1) % effects.length),
        randomEffect: () => loadEffect(Math.floor(Math.random() * effects.length)),
        toggleEffects,
        getCurrent: () => enabled ? effects[currentIndex]?.name : null
    };

    // Khởi tạo ngẫu nhiên
    loadEffect(currentIndex);


})(window);
