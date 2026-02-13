const translations = {
    en: {
        download_full: "📦 Get it",
        help_full: "📝 User Guide",
        image_loading: "Loading image...",
        effect: "Change effect",
        effect_off: "Turn on/off effects",
        error: "Cannot load content."
    },
    vn: {
        download_full: "📦 Dùng ngay",
        help_full: "📝 Hướng dẫn",
        image_loading: "Đang tải ảnh...",
        effect: "Chuyển hiệu ứng",
        effect_off: "Bật/Tắt hiệu ứng",
        error: "Không thể tải nội dung."
    }
};

const IMAGE_PROVIDERS = {
    imgbb: "https://i.ibb.co/",
    anhmoe: "https://cdn.save.moe/"
};

document.addEventListener("DOMContentLoaded", () => {

    let ver = {};

    /* ============================= */
    /*  HELPERS                      */
    /* ============================= */

    const getHashParam = (name) =>
        new URLSearchParams(window.location.hash.slice(1)).get(name);

    const detectLanguage = () =>
        localStorage.getItem("lang") ||
        ((navigator.language || "").toLowerCase().startsWith("vi") ? "vn" : "en");

    const getCurrentLang = () => detectLanguage();

    const loadPage = async (url, callback) => {
        try {
            const res = await fetch(url);
            const html = await res.text();
            document.getElementById("content").innerHTML = html;
            callback?.();
        } catch {
            document.getElementById("content").textContent =
                translations[getCurrentLang()].error;
        }
    };

    const isDldPage = () => window.location.hash === "#download";

    const updateDownloadText = (lang) => {
        document.querySelector("#download .full-text").textContent =
            isDldPage()
                ? translations[lang].help_full
                : translations[lang].download_full;

        const toggleBtn = document.getElementById('toggle-effect');
        const offBtn = document.getElementById('toggle-off');

        if (toggleBtn) toggleBtn.title = translations[lang].effect;
        if (offBtn) offBtn.title = translations[lang].effect_off;
    };

    const highlightLangButton = (lang) => {
        document.querySelectorAll(".lang-toggle")
            .forEach(btn => btn.classList.remove("active-lang"));

        document.getElementById(`lang-${lang}`)
            ?.classList.add("active-lang");
    };

    const setLanguage = (lang) => {
        localStorage.setItem("lang", lang);
        updateDownloadText(lang);
        highlightLangButton(lang);
        renderPageFromHash();
    };

    const updateUrl = (all) => {
        if (all) {
            [
                ["download_x64", ver.url],
                ["alt_x64", ver.alterurl],
                ["download_x86", ver.url_x86],
                ["alt_x86", ver.alterurl_x86],
            ].forEach(([id, url]) => {
                const el = document.getElementById(id);
                if (el && url) el.href = url;
            });
        }

        document.querySelectorAll('[data-role="pw"]')
            .forEach(elpw => elpw.textContent = ver.pw || '');

        document.querySelectorAll('[data-role="pw-container"]')
            .forEach(cont => cont.style.display = ver.pw ? '' : 'none');
    };

    /* ============================= */
    /*  DOWNLOAD COOLDOWN            */
    /* ============================= */

    function attachDownloadCooldown() {

        const dldButtons = document.querySelectorAll('.download-button, .alt-link');

        dldButtons.forEach(btn => {

            btn.addEventListener('click', (e) => {

                // nếu đang cooldown → bỏ qua nhưng KHÔNG chặn propagation
                if (btn.dataset.cooling === "1") {
                    return;
                }

                btn.dataset.cooling = "1";

                const href = btn.getAttribute('href');

                if (href && href !== '#') {
                    // delay nhỏ để không phá chuỗi click event
                    setTimeout(() => {
                        window.open(href, '_blank');
                    }, 10);
                }

                // khoá click trong 3 giây
                btn.style.pointerEvents = "none";

                setTimeout(() => {
                    btn.dataset.cooling = "0";
                    btn.style.pointerEvents = "";
                }, 3000);

            });

        });
    }

    /* ============================= */
    /*  PAGE RENDER                  */
    /* ============================= */

    const renderPageFromHash = () => {

        const lang = getCurrentLang();
        const img = getHashParam("img");
        const versions = isDldPage();

        if (img) {

            const srcType = getHashParam("src") || "imgbb";

            loadPage("pages/viewer.html", () => {

                const imageEl = document.getElementById("screenshot-image");
                const loadingEl = document.getElementById("loading-text");

                if (!imageEl || !loadingEl) return;

                loadingEl.textContent = translations[lang].image_loading;
                loadingEl.style.display = "block";
                imageEl.style.display = "none";

                requestAnimationFrame(() => {

                    imageEl.onload = () => {
                        loadingEl.style.display = "none";
                        imageEl.style.display = "block";
                    };

                    imageEl.onerror = () => {
                        loadingEl.textContent = "Failed to load image!";
                    };

                    const baseUrl = IMAGE_PROVIDERS[srcType.toLowerCase()];
                    imageEl.src = baseUrl + decodeURIComponent(img);
                });
            });

        } else if (versions) {

            loadPage(
                lang === "vn"
                    ? "pages/versions-vn.html"
                    : "pages/versions-en.html",
                () => {
                    updateDownloadText(lang);
                    updateUrl(true);
                    window.scrollTo({ top: 0 });
                    attachDownloadCooldown();
                }
            );

        } else {

            loadPage(
                lang === "vn"
                    ? "pages/help-vn.html"
                    : "pages/help-en.html",
                () => {
                    updateDownloadText(lang);
                    updateUrl(false);
                }
            );
        }
    };

    /* ============================= */
    /*  INIT BASIC                   */
    /* ============================= */

    const initialLang = getCurrentLang();
    updateDownloadText(initialLang);
    highlightLangButton(initialLang);
    renderPageFromHash();

    window.addEventListener("hashchange", renderPageFromHash);

    fetch("api/version/index.json")
        .then(res => res.json())
        .then(data => {
            ver = data;
            updateUrl(true);
        })
        .catch(() => { });

    document.getElementById("home-link")
        ?.addEventListener("click", e => {
            e.preventDefault();
            window.location.hash = "";
        });

    document.getElementById("download")
        ?.addEventListener("click", e => {
            e.preventDefault();
            window.location.hash = isDldPage() ? "" : "download";
            renderPageFromHash();
        });

    document.getElementById("lang-vn")
        ?.addEventListener("click", () => setLanguage("vn"));

    document.getElementById("lang-en")
        ?.addEventListener("click", () => setLanguage("en"));

    /* ============================= */
    /*  INIT EFFECT SYSTEM           */
    /* ============================= */

    if (window.initEffectManager) {
        window.initEffectManager();
    }

});
