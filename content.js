// content.js

/**
 * Extracts the TV show name from the current page using the method
 * defined in the site configuration (Regex or XPath).
 * @param {object} site - The configuration object for the matched site.
 * @returns {string|null} The extracted name or null if not found.
 */
function extractName(site) {
    try {
        if (site.nameExtractionRegex) {
            const title = document.title;
            const match = title.match(new RegExp(site.nameExtractionRegex));
            if (match && match[1]) return match[1].trim();
        } else if (site.nameExtractionXpath) {
            const result = document.evaluate(site.nameExtractionXpath, document, null, XPathResult.STRING_TYPE, null);
            if (result.stringValue) return result.stringValue.trim();
        }
    } catch (e) {
        console.error('SickChill Plugin: Error during name extraction:', e);
    }
    return null;
}

/**
 * Injects the "Add to SickChill" icon and link onto the page.
 * @param {HTMLElement} targetElement - The DOM element where the icon should be injected.
 * @param {string} title - The extracted TV show title.
 */
function performInjection(targetElement, title) {
    // Avoid duplicate injections
    if (document.getElementById('sickchill-add-icon')) return;

    const link = document.createElement('a');
    link.id = 'sickchill-add-icon';
    link.title = `Add "${title}" to SickChill`;
    link.style.cursor = 'pointer';

    // When clicked, prevent default link behavior and send a message to the background script.
    link.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        chrome.runtime.sendMessage({
            action: "directToAddShowPage",
            name: title
        });
    };

    const icon = document.createElement('img');
    icon.src = chrome.runtime.getURL('images/SC.png');
    icon.style.height = '1em';
    icon.style.width = 'auto';
    icon.style.marginRight = '8px';
    icon.style.verticalAlign = 'middle';

    link.appendChild(icon);
    
    // Insert the icon as the first child of the target element (e.g., inside the H1 tag)
    targetElement.insertBefore(link, targetElement.firstChild);
    console.log(`SickChill Plugin: Icon injected for "${title}".`);
}


/**
 * Finds the matching site configuration for the current URL.
 */
function initialize() {
    chrome.storage.local.get({ sites: [] }, (result) => {
        if (chrome.runtime.lastError) return;
        const matchingSite = result.sites.find(site => {
            if (site.host && window.location.href.includes(site.host)) {
                // If a URL regex is provided, it must also match.
                if (site.urlRegex) {
                    try {
                        return new RegExp(site.urlRegex, 'i').test(window.location.href);
                    }
                    catch (e) {
                        return false;
                    }
                }
                return true;
            }
            return false;
        });
        if (matchingSite) {
            waitForElementsAndInject(matchingSite);
        }
    });
}

/**
 * Periodically checks for the required elements on the page before injecting the icon.
 * This handles pages that load content dynamically.
 * @param {object} site - The configuration for the matched site.
 */
function waitForElementsAndInject(site) {
    let attempts = 0;
    const maxAttempts = 60; // Try for 15 seconds (60 * 250ms).
    const intervalId = setInterval(() => {
        if (attempts++ >= maxAttempts) {
            clearInterval(intervalId);
            return;
        }

        // If a content regex is provided, check if the page body contains the text.
        if (site.contentRegex && !new RegExp(site.contentRegex, 'i').test(document.body.innerText)) return;
        
        const extractedName = extractName(site);
        // Ensure injectionXpath points to the container (e.g., //h1) and not the text node
        const injectionTarget = document.evaluate(site.injectionXpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        
        // Once both the name and target element are found, perform the injection.
        if (extractedName && injectionTarget) {
            clearInterval(intervalId);
            performInjection(injectionTarget, extractedName);
        }
    }, 250);
}

// Check if the script is already injected to avoid running multiple times
if (typeof window.sickChillInjected === 'undefined') {
    window.sickChillInjected = true;
    initialize();
}
