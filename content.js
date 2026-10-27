(function () {
    if (window.location.hostname !== 'online-store-web.shopifyapps.com' ||
        !/\/themes\/?$/.test(window.location.pathname)) return;

    const urlParams = new URLSearchParams(window.location.search);

    let SHOP_DOMAIN = urlParams.get('shop');
    getPrimaryShopDomain();

    const THEME_SELCTOR = 'ul[class*="_ThemeList_"] > li';
    const MORE_ACTIONS_SELECTOR = 'button[aria-label="Click for more theme actions"]';
    const COPY_ICON = chrome.runtime.getURL('icons/copy_icon.svg');
    const CHECK_ICON = chrome.runtime.getURL('icons/check_icon.svg');

    function getPrimaryShopDomain() {
        if (!SHOP_DOMAIN) return;
        
        chrome.storage.local.get([SHOP_DOMAIN], (res) => {
            if (res[SHOP_DOMAIN]) {
                SHOP_DOMAIN = res[SHOP_DOMAIN];
                return;
            }

            fetch(`https://${SHOP_DOMAIN}/meta.json`)
            .then(response => response.json())
            .then(data => {
                const domain = data?.domain;

                if (!domain) return;

                SHOP_DOMAIN = domain;

                chrome.storage.local.set({ [urlParams.get('shop')]: SHOP_DOMAIN });
            })
            .catch(()=>{});
        });
    }


    const observer = new MutationObserver(() => {
        const themeRows = document.querySelectorAll(THEME_SELCTOR);

        themeRows.forEach((row) => {
            const details = getThemeDetails(row);
            
            if (details.THEME_ID) injectButton(row, details);
        });
    });

    observer.observe(document, { childList: true, subtree: true });

    function injectButton(row, details) {
        // The action bar is the InlineStack that holds the "…" more-actions button.
        const moreBtn = row.querySelector(MORE_ACTIONS_SELECTOR);
        const buttonGroup = moreBtn?.parentElement;
        if (!buttonGroup) return;

        if (!buttonGroup.querySelector('.adminflow-copy')) {
            buttonGroup.insertBefore(createCopyButton(details, moreBtn), moreBtn);
        }
    }

    // Shopify's class names are hashed per build, so copy them from the native
    // "…" button in the same row to match its look rather than hard-coding.
    function createActionButton(className, iconUrl, title, onClick, templateBtn) {
        const btnWrapper = document.createElement('span');
        btnWrapper.className = className;

        const btn = document.createElement('button');
        btn.className = templateBtn?.className || 'Polaris-Button Polaris-Button--variantSecondary Polaris-Button--sizeMedium';
        btn.type = 'button';
        btn.title = title;
        btn.setAttribute('aria-label', title);
        const icon = document.createElement('img');
        icon.src = iconUrl;
        icon.alt = '';
        icon.style.cssText = 'width: 16px; height: 16px; display: block; transition: transform .1s ease-out, opacity .1s ease-out;';
        btn.appendChild(icon);

        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            onClick();
        };

        btnWrapper.appendChild(btn);
        return btnWrapper;
    }

    function createCopyButton(details, templateBtn) {
        let wrapper;

        wrapper = createActionButton('adminflow-copy', COPY_ICON, 'Copy details', () => {
            const btn = wrapper.querySelector('button');
            const textToCopy = `Theme Details\nTheme ID: ${details.THEME_ID}\nTheme Name: ${details.themeName}\nTheme Preview: ${details.previewLink}\nGithub Branch: ${details.themeBranch}`;
            navigator.clipboard.writeText(textToCopy)
                .then(() => showCopied(btn))
                .catch(() => {});
        }, templateBtn);

        return wrapper;
    }

    // Same cue Polaris uses for copy actions: the icon swaps to a checkmark
    // with a small pop, then returns to the copy icon.
    function showCopied(btn) {
        const icon = btn.querySelector('img');
        if (!icon || btn._copiedTimer) return;

        icon.style.transform = 'scale(0.6)';
        icon.style.opacity = '0';
        setTimeout(() => {
            icon.src = CHECK_ICON;
            icon.style.transform = 'scale(1)';
            icon.style.opacity = '1';
        }, 100);

        btn._copiedTimer = setTimeout(() => {
            icon.style.transform = 'scale(0.6)';
            icon.style.opacity = '0';
            setTimeout(() => {
                icon.src = COPY_ICON;
                icon.style.transform = 'scale(1)';
                icon.style.opacity = '1';
                btn._copiedTimer = null;
            }, 100);
        }, 800);
    }

    function getThemeDetails(theme) {
        const themeName = theme.querySelector('h3')?.textContent || "Unknown";
        // The branch is only exposed via the "Open in GitHub" link in the
        // GitHub popover: https://github.com/<owner>/<repo>/tree/<branch>
        const branchLink = theme.querySelector('a[href^="https://github.com/"][href*="/tree/"]')?.href || "";
        const editorLink = theme.querySelector('a[href*="/editor"]')?.href || "";
        
        const themeIdMatch = editorLink.match(/\/themes\/(\d+)/);
        const THEME_ID = themeIdMatch ? themeIdMatch[1] : "";

        const themeBranch = branchLink || "No Branch";

        const previewLink = `https://${SHOP_DOMAIN}/?_ab=0&_fd=0&_sc=1&preview_theme_id=${THEME_ID}`;

        return { themeName, themeBranch, previewLink, THEME_ID };
    }
})();