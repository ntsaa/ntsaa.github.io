const params = new URLSearchParams(window.location.search);
const viewer = params.get("viewer");

if (viewer) {
    const img = document.getElementById("screenshot");
    const imgUrl = "https://i.ibb.co/" + viewer;
    const fallbackImg = "https://dummyimage.com/600x400/333/fff&text=Image+not+found";

    img.src = imgUrl;
    img.onerror = () => {
        img.src = fallbackImg;
        img.alt = "Image not found";
        document.title = "Ảnh không tồn tại";
    };
}
