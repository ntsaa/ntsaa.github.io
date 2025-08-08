const translations = {
    en: {
        download_full: "Download latest version",
        download_short: "Download",
        coffee_full: "☕ Buy me a coffee",
        error: "Cannot load content."
    },
    vn: {
        download_full: "Tải phiên bản mới nhất",
        download_short: "Tải xuống",
        coffee_full: "☕ Mời tôi ly cà phê",
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

        document.querySelector("#bmcBtn .full-text").textContent = translations[lang].coffee_full;
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

        if (img) {
            loadPage("pages/viewer.html", () => {
                const imageEl = document.getElementById("screenshot-image");
                if (imageEl) imageEl.src = "https://i.ibb.co/" + decodeURIComponent(img);
            });
        } else {
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

    document.getElementById("lang-vn")?.addEventListener("click", () => setLanguage("vn"));
    document.getElementById("lang-en")?.addEventListener("click", () => setLanguage("en"));

});
