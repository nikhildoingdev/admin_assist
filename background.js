const RESYNC_URL = "https://auto-pr-bot.vercel.app/api/resync";

const resync = async ({ repo, branch, base }) => {
    const { resyncSecret } = await chrome.storage.local.get(["resyncSecret"]);
    if (!resyncSecret) return { ok: false, message: "Add the resync secret in the popup" };

    const response = await fetch(RESYNC_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${resyncSecret}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ repo, branch, mainBranch: base })
    });

    const body = await response.json().catch(() => ({}));

    if (response.ok && body.ok) {
        if (body.upToDate) return { ok: true, message: "Already up to date" };
        return { ok: true, message: `Resynced with ${base}` };
    }

    if (response.status === 409) return { ok: false, message: "Merge conflict - resolve manually" };
    if (response.status === 401) return { ok: false, message: "Invalid resync secret" };

    return { ok: false, message: body.error || `Failed (${response.status})` };
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action !== "resync") return;

    resync(request)
        .then(sendResponse)
        .catch((error) => sendResponse({ ok: false, message: error.message }));

    return true;
});
