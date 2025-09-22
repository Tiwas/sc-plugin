// background.js

/**
 * Creates a dynamic browser action icon.
 * @param {string} color - The background color of the icon.
 * @param {number} size - The width and height of the icon in pixels.
 * @returns {ImageData} The generated icon data.
 */
function createIcon(color, size) {
    const canvas = new OffscreenCanvas(size, size);
    const context = canvas.getContext('2d');
    context.fillStyle = color;
    context.fillRect(0, 0, size, size);
    context.font = `bold ${size * 0.6}px Arial`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = 'white';
    context.fillText('SC', size / 2, size / 2);
    return context.getImageData(0, 0, size, size);
}

/**
 * Updates the browser action icon's state (enabled/disabled) based on whether the URL
 * in the given tab matches any of the user-configured and enabled sites.
 * @param {number} tabId - The ID of the tab to update.
 * @param {string} url - The URL of the tab.
 */
function updateActionIconState(tabId, url) {
    if (!url || !tabId) return;
    chrome.storage.local.get({ sites: [] }, (result) => {
        if (chrome.runtime.lastError) return;
        const sites = result.sites;
        let matchFound = false;
        for (const site of sites) {
            // Skip disabled sites
            if (site.enabled === false) continue;

            if (site.host && url.includes(site.host)) {
                if (site.urlRegex) {
                    try {
                        if (new RegExp(site.urlRegex, 'i').test(url)) matchFound = true;
                    } catch (e) { /* Ignore invalid regex */ }
                } else {
                    matchFound = true;
                }
            }
            if (matchFound) break;
        }
        // Set the icon and enabled/disabled state for the specific tab.
        chrome.action.setIcon({
            tabId: tabId,
            imageData: {
                '48': createIcon(matchFound ? '#1E90FF' : '#808080', 48),
                '128': createIcon(matchFound ? '#1E90FF' : '#808080', 128)
            }
        });
        if (matchFound) {
            chrome.action.enable(tabId);
        } else {
            chrome.action.disable(tabId);
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
        let addressWithProtocol = address;
        // If no protocol is specified, default to http. User can override by adding https:// in settings.
        if (!address.startsWith('http://') && !address.startsWith('https://')) {
            addressWithProtocol = `http://${address}`;
        }
        
        let cleanBaseUrl;
        // Log which address is being tried.
        console.log(`SickChill Plugin: Attempting to connect to ${addressWithProtocol}`);
        try {
            const urlObject = new URL(addressWithProtocol);
             // Remove any trailing slash from the path to create a clean base URL.
            const cleanPath = urlObject.pathname.replace(/\/+$/, '');
            cleanBaseUrl = `${urlObject.protocol}//${urlObject.host}${cleanPath}`;
            
            await fetch(`${cleanBaseUrl}/api/${settings.apiKey}/?cmd=ping`, { signal: AbortSignal.timeout(3000) });
            
            // Log success.
            console.log(`SickChill Plugin: Successfully connected to ${cleanBaseUrl}`);
            return cleanBaseUrl;
        } catch (e) {
            console.warn(`SickChill Plugin: Connection to ${cleanBaseUrl || addressWithProtocol} failed.`);
        }
    }
    return null;
}

/**
 * Handles the main user action: opening the SickChill "Add Show" page and preparing it for automation.
 * @param {string} name - The name of the TV show to add.
 */
async function handleDirectToAddShow(name) {
    const settings = await chrome.storage.local.get(['internalAddress', 'externalAddress', 'apiKey']);
    const activeAddress = await getActiveAddress(settings);
    if (!activeAddress) {
        console.error("Could not connect to any configured SickChill address.");
        // If connection fails, open the options page for the user to check their settings.
        chrome.runtime.openOptionsPage();
        return;
    }
    
    // Store the show name in session storage, which is temporary and ideal for this task.
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

// Listens for tab updates to know when the SickChill page has loaded.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Check if the tab has finished loading and is the correct "Add Show" page.
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('/addShows/newShow/')) {
        const data = await chrome.storage.session.get('showNameToAdd');
        // If a show name is stored, inject the automation script.
        if (data.showNameToAdd) {
            console.log(`Injecting search script for "${data.showNameToAdd}" into tab ${tabId}`);
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: automateSearch,
                args: [data.showNameToAdd]
            });
            // Clean up by removing the show name from session storage.
            await chrome.storage.session.remove('showNameToAdd');
        }
    }
});

// Primary message listener for actions triggered from content scripts or the popup.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "directToAddShowPage") {
        handleDirectToAddShow(request.name);
    }
    // Return true to indicate that we will send a response asynchronously.
    // This is good practice but not strictly necessary for this specific action.
    return true; 
});

// --- Event Listeners for Browser Action Icon ---

/**
 * Checks the currently active tab and updates the icon state.
 */
function checkActiveTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            updateActionIconState(tabs[0].id, tabs[0].url);
        }
    });
}

// Update the icon whenever a tab is updated.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Use 'complete' to ensure the final URL is evaluated
    if (changeInfo.status === 'complete') {
        updateActionIconState(tabId, tab.url);
    }
});

// Update the icon when the user switches to a different tab.
chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab) {
            updateActionIconState(tab.id, tab.url);
        }
    });
});

// Check the initial tab when the extension is installed or the browser starts.
chrome.runtime.onInstalled.addListener(checkActiveTab);

// Re-check when the user saves changes to the site configurations.
chrome.storage.onChanged.addListener((changes) => {
    if (changes.sites) {
        checkActiveTab();
    }
});

console.log("SickChill Plugin: Background script loaded.");