// popup.js

/**
 * Finds a matching site configuration from the stored list based on the current URL.
 * @param {Array<object>} sites - The array of site configurations.
 * @param {string} url - The current tab's URL.
 * @returns {object|null} The matching site object or null if no match is found.
 */
function findMatchingSite(sites, url) {
    for (const site of sites) {
        if (site.host && url.includes(site.host)) {
            if (site.urlRegex) {
                try {
                    if (new RegExp(site.urlRegex, 'i').test(url)) return site;
                } catch (e) { /* Ignore invalid regex */ }
            } else {
                return site;
            }
        }
    }
    return null;
}

// --- Functions to be injected into the active tab ---

/**
 * Extracts text from the page using an XPath expression.
 * @param {string} xpath - The XPath expression to evaluate.
 * @returns {string|null} The trimmed text content or null.
 */
function extractNameByXpath(xpath) {
    try {
        const result = document.evaluate(xpath, document, null, XPathResult.STRING_TYPE, null);
        return result.stringValue.trim();
    } catch (e) { return null; }
}

/**
 * Extracts text from the page's title using a regular expression.
 * @param {string} regexStr - The regular expression string.
 * @returns {string|null} The first captured group or null.
 */
function extractNameByRegex(regexStr) {
     try {
        const regex = new RegExp(regexStr);
        const match = document.title.match(regex);
        return (match && match[1]) ? match[1].trim() : null;
    } catch (e) { return null; }
}

// --- Main popup logic ---

document.addEventListener('DOMContentLoaded', () => {
    const addBtn = document.getElementById('addBtn');
    const configBtn = document.getElementById('configBtn');
    const errorDiv = document.getElementById('error');

    // Get the currently active tab.
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        if (!currentTab) {
            addBtn.disabled = true;
            addBtn.textContent = "Cannot find active tab";
            return;
        }

        // Load site configurations from storage.
        chrome.storage.local.get({ sites: [] }, (result) => {
            const matchingSite = findMatchingSite(result.sites, currentTab.url);
            if (!matchingSite) {
                addBtn.disabled = true;
                addBtn.textContent = 'No matching site config';
                return;
            }

            // Determine which extraction method to use (Regex or XPath).
            const useRegex = !!matchingSite.nameExtractionRegex;
            const extractionFunction = useRegex ? extractNameByRegex : extractNameByXpath;
            const extractionArg = useRegex ? matchingSite.nameExtractionRegex : matchingSite.nameExtractionXpath;

            // Execute the appropriate extraction script in the active tab.
            chrome.scripting.executeScript({
                target: { tabId: currentTab.id },
                func: extractionFunction,
                args: [extractionArg]
            }, (injectionResults) => {
                if (chrome.runtime.lastError || !injectionResults || !injectionResults[0]) {
                    errorDiv.textContent = 'Could not extract name from page.';
                    return;
                }

                const extractedName = injectionResults[0].result;
                if (extractedName) {
                    addBtn.textContent = `Add "${extractedName}"`;
                    addBtn.disabled = false;
                    
                    addBtn.addEventListener('click', () => {
                        // Send a message to the background script to initiate the "add show" process.
                        chrome.runtime.sendMessage({
                            action: "directToAddShowPage",
                            name: extractedName
                        });
                        window.close(); // Close the popup after clicking.
                    });
                } else {
                    addBtn.textContent = 'Name not found';
                }
            });
        });
    });

    // Set up the button to open the extension's options page.
    configBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });
});