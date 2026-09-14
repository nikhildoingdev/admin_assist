(function () {
    if (window.location.hostname !== 'online-store-web.shopifyapps.com' ||
        !/\/themes\/?$/.test(window.location.pathname)) return;

    const urlParams = new URLSearchParams(window.location.search);

    let SHOP_DOMAIN = urlParams.get('shop');
    getPrimaryShopDomain();

    const THEME_SELCTOR = 'div.Polaris-BlockStack > [class*="ThemeListItem_"]';
    const BASE_BRANCH = 'Main';

    const COPY_ICON = chrome.runtime.getURL('icons/copy_icon.svg');
    const RESYNC_ICON = chrome.runtime.getURL('icons/resync_icon.svg');

    

    console.log('THEME_SELCTOR', THEME_SELCTOR);
    
    let shouldHidePublish = false;
    let hasResyncSecret = false;

    chrome.storage.local.get(["hidePublish", "resyncSecret"], (result) => {
        shouldHidePublish = result.hidePublish ?? true;
        hasResyncSecret = Boolean(result.resyncSecret);
        updatePublishButtonsVisibility(); 
    });

    chrome.storage.onChanged.addListener((changes) => {
        if (!changes.resyncSecret) return;

        hasResyncSecret = Boolean(changes.resyncSecret.newValue);
        document.querySelectorAll(THEME_SELCTOR).forEach((row) => injectButton(row, getThemeDetails(row)));
    });

    chrome.runtime.onMessage.addListener((request) => {
        if (request.action === "togglePublish") {
            shouldHidePublish = request.hidePublish;
            updatePublishButtonsVisibility();
        }
    });

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

        console.log('themeRows', themeRows);

        themeRows.forEach((row) => {
            const details = getThemeDetails(row);
            console.log('details', details);
            
            if (details.THEME_ID) {
                injectButton(row, details);
                handlePublishButton(row);
            }
        });
    });

    observer.observe(document, { childList: true, subtree: true });

    function updatePublishButtonsVisibility() {
        const themeRows = document.querySelectorAll(THEME_SELCTOR);
        themeRows.forEach((row) => handlePublishButton(row));
    }

    function handlePublishButton(row) {
        const publishButton = row.querySelector('s-internal-button[accessibilitylabel^="Publish"]');
        if (!publishButton) return;
        publishButton.style.display = shouldHidePublish ? 'none' : '';
    }

    function injectButton(row, details) {
        const buttonGroup = row.querySelector('.Polaris-ButtonGroup');
        if (!buttonGroup) return;

        if (!buttonGroup.querySelector('.adminflow-copy')) {
            buttonGroup.insertBefore(createCopyButton(details), buttonGroup.lastChild);
        }

        const existingResync = buttonGroup.querySelector('.adminflow-resync');
        const canResync = hasResyncSecret && details.repo && details.branchName && details.branchName !== BASE_BRANCH;

        if (canResync && !existingResync) {
            buttonGroup.insertBefore(createResyncButton(details), buttonGroup.lastChild);
        }

        if (!canResync && existingResync) existingResync.remove();
    }

    function createActionButton(className, iconUrl, title, onClick) {
        const btnWrapper = document.createElement('div');
        btnWrapper.className = `Polaris-ButtonGroup__Item ${className}`;

        const btn = document.createElement('button');
        btn.className = 'Polaris-Button Polaris-Button--variantSecondary Polaris-Button--sizeMedium';
        btn.type = 'button';
        btn.title = title;
        btn.innerHTML = `<span class="Polaris-Text--root Polaris-Text--bodySm Polaris-Text--medium"><img src="${iconUrl}" alt="" style="width: 16px; height: 16px; display: block;"></span>`;

        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            onClick();
        };

        btnWrapper.appendChild(btn);
        return btnWrapper;
    }

    function createCopyButton(details) {
        return createActionButton('adminflow-copy', COPY_ICON, 'Copy details', () => {
            const textToCopy = `Theme ID: ${details.THEME_ID}\nTheme Name: ${details.themeName}\nTheme Preview: ${details.previewLink}\nGithub Branch: ${details.themeBranch}`;
            navigator.clipboard.writeText(textToCopy);
        });
    }

    function createResyncButton(details) {
        const title = `Resync with ${BASE_BRANCH}`;

        return createActionButton('adminflow-resync', RESYNC_ICON, title, () => {
            chrome.runtime.sendMessage({ action: 'resync', repo: details.repo, branch: details.branchName, base: BASE_BRANCH });
        });
    }

    function getThemeDetails(theme) {
        const themeName = theme.querySelector('h3')?.textContent || "Unknown";
        const branchLink = theme.querySelector('[class*="BranchName_"] > a')?.href || "";
        const repoLink = theme.querySelector('[class*="RepositoryName_"] > a')?.href || "";
        const editorLink = theme.querySelector('a[href*="/editor"]')?.href || "";
        
        const themeIdMatch = editorLink.match(/\/themes\/(\d+)/);
        const THEME_ID = themeIdMatch ? themeIdMatch[1] : "";

        const themeBranch = branchLink || "No Branch";
        const branchName = branchLink.split('/tree/')[1] || "";
        const repo = repoLink.replace('https://github.com/', '');

        const previewLink = `https://${SHOP_DOMAIN}/?_ab=0&_fd=0&_sc=1&preview_theme_id=${THEME_ID}`;

        return { themeName, themeBranch, branchName, repo, previewLink, THEME_ID };
    }
})();