const translations = {
    en: {
        download_full: "⬇️ Download latest version",
        download_short: "⬇️ Download",
        versions_full: "🕒 Versions",
        coffee_full: "☕ Buy me a coffee",
        coffee_short: "☕ Buy me",
        image_loading: "Loading image...",
        error: "Cannot load content."
    },
    vn: {
        download_full: "⬇️ Tải phiên bản mới nhất",
        download_short: "⬇️ Tải xuống",
        versions_full: "🕒 Phiên bản",
        coffee_full: "☕ Mời tôi ly cà phê",
        coffee_short: "☕ Mời tôi",
        image_loading: "Đang tải ảnh...",
        error: "Không thể tải nội dung."
    }
};

document.addEventListener("DOMContentLoaded", () => {

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
        document.querySelector("#downloadBtn .full-text").textContent = translations[lang].download_full;
        document.querySelector("#downloadBtn .short-text").textContent = translations[lang].download_short;

        document.querySelector("#versionsBtn .full-text").textContent = translations[lang].versions_full;
        document.querySelector("#versionsBtn .short-text").textContent = translations[lang].versions_full;

        document.querySelector("#bmcBtn .full-text").textContent = translations[lang].coffee_full;
        document.querySelector("#bmcBtn .short-text").textContent = translations[lang].coffee_short;
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

    const renderPageFromHash = () => {
        const lang = getCurrentLang();
        const img = getHashParam("img");
        const versions = window.location.hash === "#versions";
        // alert(window.location.hash)

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
            loadPage(lang === "vn" ? "pages/versions-vn.html" : "pages/versions-en.html");
        }
        else {
            loadPage(lang === "vn" ? "pages/help-vn.html" : "pages/help-en.html");
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
            if (data.url) document.getElementById("downloadBtn").href = data.url;
        })
        .catch(err => console.error("Không tải được dữ liệu version:", err));

    document.getElementById("home-link")?.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.hash = "";
    });

    document.getElementById("versionsBtn")?.addEventListener("click", (e) => 
    {
        e.preventDefault();
        window.location.hash = "versions";
        renderPageFromHash();
    });

    document.getElementById("lang-vn")?.addEventListener("click", () => setLanguage("vn"));
    document.getElementById("lang-en")?.addEventListener("click", () => setLanguage("en"));
});
