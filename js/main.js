const translations = {
    en: {
        download_full: "📦 Get it",
        help_full: "📝 User Guide",
        image_loading: "Loading image...",
        error: "Cannot load content."
    },
    vn: {
        download_full: "📦 Dùng ngay",
        help_full: "📝 Hướng dẫn",
        image_loading: "Đang tải ảnh...",
        error: "Không thể tải nội dung."
    }
};

document.addEventListener("DOMContentLoaded", () => {
    var ver = {};
    const getHashParam = (name) => {
        const params = new URLSearchParams(window.location.hash.slice(1));
        return params.get(name);
    };

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

    const detectLanguage = () => {
        return localStorage.getItem("lang")
            || ((navigator.language || "").toLowerCase().startsWith("vi") ? "vn" : "en");
    };

    const getCurrentLang = () => detectLanguage();

    const updateDownloadText = (lang) => {
        document.querySelector("#download .full-text").textContent = isDldPage() ? translations[lang].help_full : translations[lang].download_full;
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

    const isDldPage = () => window.location.hash === "#download";

    const updateUrl = () => {
        [
            ["download_x64", ver.url],
            ["download_x86", ver.url_x86]
        ].forEach(([id, url]) => {
            const el = document.getElementById(id);
            if (el && url) el.href = url;
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
                updateDownloadText(lang); updateUrl(); window.scrollTo({ top: 0 });
            });
        }
        else {
            loadPage(lang === "vn" ? "pages/help-vn.html" : "pages/help-en.html", () => {
                updateDownloadText(lang);
            });
        }
    };

    // --- Khởi tạo ---
    const initialLang = getCurrentLang();
    updateDownloadText(initialLang);
    highlightLangButton(initialLang);
    renderPageFromHash();

    // --- Sự kiện ---
    window.addEventListener("hashchange", renderPageFromHash);

    fetch("api/version/index.json")
        .then(res => res.json())
        .then(data => {
            ver = data;
            updateUrl();
     })
    .catch(err => console.error("Không tải được dữ liệu version:", err));

    document.getElementById("home-link")?.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.hash = "";
    });

    document.getElementById("download")?.addEventListener("click", (e) => 
    {
        e.preventDefault();
        window.location.hash = isDldPage() ? "" : "download";
        renderPageFromHash();
    });

    document.getElementById("lang-vn")?.addEventListener("click", () => setLanguage("vn"));
    document.getElementById("lang-en")?.addEventListener("click", () => setLanguage("en"));
});
