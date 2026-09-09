const translations = {
    en: {
        title: "NTSAA - Capture, Edit & Extract Text",
        description: "A lightweight desktop tool for screenshot capture, drawing, and AI-powered text recognition.",
        download_full: "📦 Get it",
        help_full: "📝 User Guide",
        image_loading: "Loading image...",
        effect: "Change effect",
        effect_off: "Turn on/off effects",
        error: "Cannot load content.",
        copyright: "© 2025 NTSAA. All rights reserved.",
        none: "None",
        press_esc: "Press Esc to start"
    },
    vn: {
        title: "NTSAA - Chụp màn hình, Chỉnh sửa & Trích xuất văn bản",
        description: "Công cụ máy tính gọn nhẹ hỗ trợ chụp màn hình, vẽ chú thích và nhận dạng văn bản thông minh.",
        download_full: "📦 Dùng ngay",
        help_full: "📝 Hướng dẫn",
        image_loading: "Đang tải ảnh...",
        effect: "Chuyển hiệu ứng",
        effect_off: "Bật/Tắt hiệu ứng",
        error: "Không thể tải nội dung.",
        copyright: "© 2025 NTSAA. Giữ bản quyền.",
        none: "Chưa có",
        press_esc: "Nhấn Esc để bắt đầu"
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

    const detectLanguage = () => {
        const saved = localStorage.getItem("lang");
        if (saved) return saved;

        const browserLangs = navigator.languages || [navigator.language || ""];
        
        // 1. Trình duyệt có tiếng Việt
        if (browserLangs.some(l => (l || "").toLowerCase().startsWith("vi"))) {
            return "vn";
        }

        // 2. Kiểm tra nếu là ngôn ngữ các nước láng giềng cùng múi giờ UTC+7 (Thái Lan, Indo, Malay)
        const isNeighbor = browserLangs.some(l => {
            const s = (l || "").toLowerCase();
            return s.startsWith("th") || s.startsWith("id") || s.startsWith("ms");
        });

        // 3. Múi giờ Việt Nam (Windows đặt là Asia/Bangkok, SE Asia Standard Time, offset -420)
        try {
            const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || "").toLowerCase();
            const isGmt7 = new Date().getTimezoneOffset() === -420;
            const isVnTimezone = tz.includes("ho_chi_minh") || tz.includes("saigon") || tz.includes("bangkok") || isGmt7;

            if (isVnTimezone && !isNeighbor) {
                return "vn";
            }
        } catch {}

        return "en";
    };

    const getCurrentLang = () => detectLanguage();
    const pageCache = {};

    const loadPage = async (url, callback) => {
        const contentEl = document.getElementById("content");

        // Bước 1: Cho mờ dần nội dung cũ đi (Fade out)
        contentEl.classList.remove("fade-in");

        // Đợi một chút để hiệu ứng fade-out kịp diễn ra (200ms theo CSS)
        setTimeout(async () => {
            // Nếu đã có trong cache, dùng luôn
            if (pageCache[url]) {
                contentEl.innerHTML = pageCache[url];
                contentEl.classList.add("fade-in");
                callback?.();
                return;
            }

            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error("Network response was not ok");
                const html = await res.text();

                pageCache[url] = html;
                contentEl.innerHTML = html;
                contentEl.classList.add("fade-in");
                callback?.();
            } catch {
                contentEl.innerHTML = `<div style="text-align:center; padding: 50px;">
                    ${translations[getCurrentLang()].error}
                </div>`;
                contentEl.classList.add("fade-in");
            }
        }, 200);
    };

    const isDldPage = () => window.location.hash === "#download";

    const updateDownloadText = (lang) => {
        const t = translations[lang] || translations.en;
        document.documentElement.lang = (lang === "vn" ? "vi" : "en");

        document.title = t.title;
        document.querySelector('meta[name="description"]')?.setAttribute("content", t.description);
        document.querySelector('meta[property="og:title"]')?.setAttribute("content", t.title);
        document.querySelector('meta[property="og:description"]')?.setAttribute("content", t.description);

        const dldEl = document.querySelector("#download .full-text");
        if (dldEl) {
            dldEl.textContent = isDldPage()
                ? t.help_full
                : t.download_full;
        }

        const toggleBtn = document.getElementById('toggle-effect');
        const offBtn = document.getElementById('toggle-off');
        const footerText = document.querySelector('.footer-text');

        if (toggleBtn) toggleBtn.title = t.effect;
        if (window.effectManager?.updateOffIcon) {
            window.effectManager.updateOffIcon();
        } else if (offBtn) {
            offBtn.title = t.effect_off;
        }

        if (footerText && window.EffectController && window.EffectController.contentVisible) {
            footerText.textContent = t.copyright;
        }
    };

    // Expose helpers globally
    window.getCurrentLang = getCurrentLang;
    window.getTranslation = (key) => translations[getCurrentLang()][key] || key;
    window.updateLanguageUI = () => updateDownloadText(getCurrentLang());
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
                ["download_x64", ver.x64?.bundle_url],
                ["download_x86", ver.x86?.bundle_url],
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

                // nếu đang cooldown → chặn click hoàn toàn
                if (btn.dataset.cooling === "1") {
                    e.preventDefault();
                    return;
                }

                const href = btn.getAttribute('href');

                if (href && href !== '#') {
                    // Tải trực tiếp trên trang hiện tại, không mở tab trắng thừa
                    e.preventDefault();
                    
                    btn.dataset.cooling = "1";
                    window.location.href = href;

                    // Tạm thời vô hiệu hóa tương tác chuột để tránh click nhầm/nhanh
                    btn.style.pointerEvents = "none";

                    setTimeout(() => {
                        btn.dataset.cooling = "0";
                        btn.style.pointerEvents = "";
                    }, 3000);
                }

            });

        });
    }

    /* ============================= */
    /*  PAGE RENDER                  */
    /* ============================= */

    let lastHash = window.location.hash;

    const renderPageFromHash = () => {

        const lang = getCurrentLang();
        const img = getHashParam("img");
        const versions = isDldPage();
        
        const currentHash = window.location.hash;
        const shouldScroll = currentHash !== lastHash;
        lastHash = currentHash;

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
                        imageEl.style.opacity = 0;
                        imageEl.style.display = "block";
                        // Thêm hiệu ứng hiện ảnh mượt mà
                        setTimeout(() => { imageEl.style.transition = "opacity 0.3s"; imageEl.style.opacity = 1; }, 10);
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
                    if (shouldScroll) window.scrollTo({ top: 0 });
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
                    if (shouldScroll) window.scrollTo({ top: 0 });
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
    /*  1-CLICK COPY HANDLER         */
    /* ============================= */

    document.addEventListener("click", (e) => {
        const copyBadge = e.target.closest(".copy-badge");
        if (!copyBadge) return;

        const textToCopy = copyBadge.getAttribute("data-copy");
        if (!textToCopy) return;

        if (copyBadge.dataset.copied === "1") return;

        const showCopiedFeedback = () => {
            copyBadge.dataset.copied = "1";
            const originalHtml = copyBadge.innerHTML;
            const lang = getCurrentLang();
            const copiedText = lang === "vn" ? "Đã chép! ✅" : "Copied! ✅";
            copyBadge.innerHTML = copiedText;
            copyBadge.classList.add("copied");

            setTimeout(() => {
                copyBadge.innerHTML = originalHtml;
                copyBadge.classList.remove("copied");
                copyBadge.dataset.copied = "0";
            }, 2000);
        };

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(textToCopy)
                .then(showCopiedFeedback)
                .catch(() => {
                    const temp = document.createElement("input");
                    temp.value = textToCopy;
                    document.body.appendChild(temp);
                    temp.select();
                    document.execCommand("copy");
                    document.body.removeChild(temp);
                    showCopiedFeedback();
                });
        } else {
            const temp = document.createElement("input");
            temp.value = textToCopy;
            document.body.appendChild(temp);
            temp.select();
            document.execCommand("copy");
            document.body.removeChild(temp);
            showCopiedFeedback();
        }
    });

    /* ============================= */
    /*  INIT EFFECT SYSTEM           */
    /* ============================= */

    if (window.initEffectManager) {
        window.initEffectManager();
    }

});
