// background.js

/**
 * Checks a tab's URL against configured sites, updates the action icon,
 * and injects the content script if a match is found.
 * @param {number} tabId - The ID of the tab.
 * @param {string} url - The URL of the tab.
 */
function checkUrlAndInject(tabId, url) {
    // Don't run on empty or internal URLs
    if (!url || !tabId || !url.startsWith('http')) {
        chrome.action.disable(tabId);
        return;
    }

    chrome.storage.local.get({ sites: [] }, (result) => {
        if (chrome.runtime.lastError) {
            console.error("Error fetching sites:", chrome.runtime.lastError);
            return;
        }

        const sites = result.sites;
        const matchingSite = sites.find(site => {
            if (site.host && url.includes(site.host)) {
                if (site.urlRegex) {
                    try {
                        return new RegExp(site.urlRegex, 'i').test(url);
                    } catch (e) {
                        console.warn("Invalid regex for site:", site.name, e);
                        return false;
                    }
                }
                return true;
            }
            return false;
        });

        if (matchingSite) {
            // We have a match, enable the icon and inject the script.
            chrome.action.setIcon({
                tabId: tabId,
                path: {
                    "48": "images/SC.png",
                    "128": "images/SC.png"
                }
            });
            chrome.action.enable(tabId);

            chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            }).catch(err => {
                // This error can happen if the page is an internal chrome page or similar.
                if (!err.message.includes('Cannot access a chrome:// URL') && !err.message.includes('Receiving end does not exist')) {
                     console.error(`Failed to inject content script into ${url}: ${err.message}`);
                }
            });
        } else {
            // No match, ensure the icon is disabled.
            chrome.action.disable(tabId);
            // The icon will automatically revert to the default (disabled) state from the manifest.
        }
    });
}


/**
 * Tries to connect to the internal and external SickChill addresses to find one that is active.
 * @param {object} settings - The plugin settings containing address and API key.
 * @returns {Promise<string|null>} The base URL of the active SickChill instance or null if none are reachable.
 */
async function getActiveAddress(settings) {
    const addressesToTry = [settings.internalAddress, settings.externalAddress].filter(Boolean);
    for (const address of addressesToTry) {
        let cleanBaseUrl;
        try {
            let addressWithProtocol = address;
            if (!address.startsWith('http://') && !address.startsWith('https://')) {
                addressWithProtocol = `https://${address}`;
            }
            const urlObject = new URL(addressWithProtocol);
            cleanBaseUrl = `${urlObject.protocol}//${urlObject.host}`;
            await fetch(`${cleanBaseUrl}/api/${settings.apiKey}/?cmd=ping`, { signal: AbortSignal.timeout(3000) });
            return cleanBaseUrl;
        } catch (e) {
            console.warn(`Address ${cleanBaseUrl || address} failed the connection test.`);
        }
    }
    return null;
}

/**
 * Handles the main user action: opening the SickChill "Add Show" page.
 * @param {string} name - The name of the TV show to add.
 */
async function handleDirectToAddShow(name) {
    const settings = await chrome.storage.local.get(['internalAddress', 'externalAddress', 'apiKey']);
    const activeAddress = await getActiveAddress(settings);
    if (!activeAddress) {
        console.error("Could not connect to any configured SickChill address.");
        chrome.runtime.openOptionsPage();
        return;
    }
    
    await chrome.storage.session.set({ showNameToAdd: name });
    
    const addShowUrl = `${activeAddress}/addShows/newShow/`;
    chrome.tabs.create({ url: addShowUrl });
}

/**
 * This function is injected into the SickChill tab to perform the search automatically.
 * @param {string} showName - The name of the show to search for.
 */
function automateSearch(showName) {
    const searchInput = document.getElementById('show-name');
    const searchButton = document.getElementById('search-button');
    if (searchInput && searchButton) {
        searchInput.value = showName;
        searchButton.click();
    } else {
        console.error('SickChill Plugin: Could not find search input or button on the page.');
    }
}

// --- Event Listeners ---

// Open options page when the action icon is clicked.
chrome.action.onClicked.addListener((tab) => {
    chrome.runtime.openOptionsPage();
});

// Listens for tab updates for both content script injection and SickChill page automation.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        // 1. Check if we need to inject the content script.
        checkUrlAndInject(tabId, tab.url);

        // 2. Check if this is the SickChill page we need to automate.
        if (tab.url.includes('/addShows/newShow/')) {
            const data = await chrome.storage.session.get('showNameToAdd');
            if (data.showNameToAdd) {
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: automateSearch,
                    args: [data.showNameToAdd]
                });
                await chrome.storage.session.remove('showNameToAdd');
            }
        }
    }
});

// Primary message listener for actions from the popup or content scripts.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "directToAddShowPage") {
        handleDirectToAddShow(request.name);
    }
    return true; // Indicates you might send a response asynchronously.
});

// Update icon when the user switches to a different tab.
chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab && tab.url) {
            checkUrlAndInject(tab.id, tab.url);
        }
    });
});

// Re-check the active tab when site configurations change.
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.sites) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url) {
                checkUrlAndInject(tabs[0].id, tabs[0].url);
            }
        });
    }
});

