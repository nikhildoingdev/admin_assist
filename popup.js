document.addEventListener("DOMContentLoaded", () => {
    const mainContent = document.getElementById("mainContent");
    const errorMessage = document.getElementById("errorMessage");
    const toggle = document.getElementById("hidePublishToggle");
    const secretInput = document.getElementById("resyncSecret");

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        const url = currentTab.url || "";

        const isShopify = url.includes("admin.shopify.com") || url.includes("myshopify.com");
        const isThemesPage = /\/themes\/?$/.test(url.split("?")[0].split("#")[0]);

        if (isShopify && isThemesPage) {
            mainContent.style.display = "block";

            chrome.storage.local.get(["hidePublish", "resyncSecret"], (result) => {
                toggle.checked = result.hidePublish ?? true;
                secretInput.value = result.resyncSecret || "";

                setTimeout(() => {
                    document.body.classList.remove("preload");
                }, 50);
            });

            secretInput.addEventListener("change", (e) => {
                chrome.storage.local.set({ resyncSecret: e.target.value.trim() });
            });

            toggle.addEventListener("change", (e) => {
                const isHidden = e.target.checked;
                chrome.storage.local.set({ hidePublish: isHidden });
                chrome.tabs.sendMessage(currentTab.id, { action: "togglePublish", hidePublish: isHidden });
            });

        } else {
            errorMessage.style.display = "block";
            document.body.classList.remove("preload");
        }
    });
});
