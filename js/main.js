const translations = {
    en: {
        download_full: "📦 Get it",
        help_full: "📝 User Guide",
        image_loading: "Loading image...",
        effect: "Effect",
        error: "Cannot load content."
    },
    vn: {
        download_full: "📦 Dùng ngay",
        help_full: "📝 Hướng dẫn",
        image_loading: "Đang tải ảnh...",
        effect: "Hiệu ứng",
        error: "Không thể tải nội dung."
    }
};

document.addEventListener("DOMContentLoaded", () => {
    const EC = window.EffectController;
    var ver = {};

    const getHashParam = (name) => {
        const params = new URLSearchParams(window.location.hash.slice(1));
        return params.get(name);
    };

    const detectLanguage = () => {
        return localStorage.getItem("lang")
            || ((navigator.language || "").toLowerCase().startsWith("vi") ? "vn" : "en");
    };

    const getCurrentLang = () => detectLanguage();

    const loadPage = async (url, callback) => {
        try {
            const res = await fetch(url);
            const html = await res.text();
            document.getElementById("content").innerHTML = html;
            callback?.();
        } catch {
            document.getElementById("content").textContent = translations[getCurrentLang()].error;
        }
    };

    const isDldPage = () => window.location.hash === "#download";

    const updateDownloadText = (lang) => {
        document.querySelector("#download .full-text").textContent =
            isDldPage() ? translations[lang].help_full : translations[lang].download_full;
        document.getElementById('toggle-ld-effect').title = translations[lang].effect;
    };

    const highlightLangButton = (lang) => {
        document.querySelectorAll(".lang-toggle").forEach(btn => btn.classList.remove("active-lang"));
        document.getElementById(`lang-${lang}`)?.classList.add("active-lang");
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

        document.querySelectorAll('[data-role="pw"]').forEach(elpw => elpw.textContent = ver.pw || '');
        document.querySelectorAll('[data-role="pw-container"]').forEach(cont => {
            cont.style.display = ver.pw ? '' : 'none';
        });
    };

    const renderPageFromHash = () => {
        const lang = getCurrentLang();
        const img = getHashParam("img");
        const versions = isDldPage();

        if (img) {
            loadPage("pages/viewer.html", () => {
                const imageEl = document.getElementById("screenshot-image");
                const loadingEl = document.getElementById("loading-text");

                if (imageEl && loadingEl) {
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

                        imageEl.src = "https://i.ibb.co/" + decodeURIComponent(img);
                    });
                }
            });
        } else if (versions) {
            loadPage(lang === "vn" ? "pages/versions-vn.html" : "pages/versions-en.html", () => {
                updateDownloadText(lang);
                updateUrl(true);
                window.scrollTo({ top: 0 });
                attachDownloadCooldown(); // Gắn chống spam click cho tất cả nút download
            });
        } else {
            loadPage(lang === "vn" ? "pages/help-vn.html" : "pages/help-en.html", () => {
                updateDownloadText(lang);
                updateUrl(false);
            });
        }
    };

    // --- Chống click liên tục (3 giây) cho tất cả .download-button ---
    function attachDownloadCooldown() {
        const dldButtons = document.querySelectorAll('.download-button, .alt-link');
        dldButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (btn.disabled) {
                    e.preventDefault();
                    return;
                }

                btn.disabled = true;
                btn.classList.add('disabled-temp');

                const href = btn.getAttribute('href');
                if (href && href !== '#') {
                    setTimeout(() => window.open(href, '_blank'), 100);
                }

                // Bật lại sau 3 giây
                setTimeout(() => {
                    btn.disabled = false;
                    btn.classList.remove('disabled-temp');
                }, 3000);
            });
        });
    }

    // --- Khởi tạo ---
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
        .catch(err => console.error("Không tải được dữ liệu version:", err));

    document.getElementById("home-link")?.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.hash = "";
    });

    document.getElementById("download")?.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.hash = isDldPage() ? "" : "download";
        renderPageFromHash();
    });

    document.getElementById("lang-vn")?.addEventListener("click", () => setLanguage("vn"));
    document.getElementById("lang-en")?.addEventListener("click", () => setLanguage("en"));

    const toggleBtn = document.getElementById('toggle-ld-effect');
    const effects = ['particles', 'starfield', 'ld-effect', 'off'];
    const icons = {
        'particles': '💠',
        'starfield': '✨',
        'ld-effect': '💫',
        'off': '🚫'
    };

    let current = Math.floor(Math.random() * effects.length);
    function updateIcon(name) {
        toggleBtn.textContent = icons[name] || '✨';
    }

    toggleBtn.addEventListener('click', () => {
        const name = effects[current];
        if (name === 'off') {
            EC.toggleEffects(false);
        } else {
            EC.toggleEffects(true);
            EC.loadEffect(effects.indexOf(name));
        }
        current = (current + 1) % effects.length;
        updateIcon(effects[current]);
    });

    toggleBtn.click();
});
