// options.js

document.addEventListener('DOMContentLoaded', () => {
    // Element references
    const saveGeneralBtn = document.getElementById('saveGeneral');
    const statusDiv = document.getElementById('status');
    const siteList = document.getElementById('siteList');
    const addSiteBtn = document.getElementById('addSiteBtn');
    const modal = document.getElementById('siteModal');
    const modalTitle = document.getElementById('modalTitle');
    const cancelModalBtn = document.getElementById('cancelModalBtn');
    const saveModalBtn = document.getElementById('saveModalBtn');
    const backupBtn = document.getElementById('backupBtn');
    const restoreBtn = document.getElementById('restoreBtn');
    const restoreInput = document.getElementById('restoreInput');
    const versionDisplay = document.getElementById('version-display');
    
    // Modal fields
    const siteIdInput = document.getElementById('siteId');
    const siteNameInput = document.getElementById('siteName');
    const siteHostInput = document.getElementById('siteHost');
    const siteUrlRegexInput = document.getElementById('siteUrlRegex');
    const siteContentRegexInput = document.getElementById('siteContentRegex');
    const nameExtractionRegexInput = document.getElementById('nameExtractionRegex');
    const nameExtractionXpathInput = document.getElementById('nameExtractionXpath');
    const injectionXpathInput = document.getElementById('injectionXpath');

    let sites = [];

    // --- General Settings Functions ---
    function saveGeneralSettings() {
        const selectedLangs = [...document.getElementById('apiLanguages').selectedOptions].map(opt => opt.value);
        const settings = {
            externalAddress: document.getElementById('externalAddress').value,
            internalAddress: document.getElementById('internalAddress').value,
            apiKey: document.getElementById('apiKey').value,
            apiLanguages: selectedLangs,
        };
        chrome.storage.local.set(settings, () => {
            showStatus(chrome.runtime.lastError ? 'Error saving general settings.' : 'General settings saved.', chrome.runtime.lastError ? 'red' : 'green');
        });
    }

    function restoreGeneralSettings() {
        const keys = ['externalAddress', 'internalAddress', 'apiKey', 'apiLanguages'];
        chrome.storage.local.get(keys, (items) => {
            if (!chrome.runtime.lastError) {
                document.getElementById('externalAddress').value = items.externalAddress || '';
                document.getElementById('internalAddress').value = items.internalAddress || '';
                document.getElementById('apiKey').value = items.apiKey || '';
                const savedLangs = items.apiLanguages || ['en'];
                const langOptions = document.getElementById('apiLanguages').options;
                for (const option of langOptions) {
                    option.selected = savedLangs.includes(option.value);
                }
            }
        });
    }
    
    function showStatus(message, color) {
        statusDiv.textContent = message;
        statusDiv.style.color = color;
        setTimeout(() => { statusDiv.textContent = ''; }, 3000);
    }

    // --- Site List Functions ---
    function renderSiteList() {
        siteList.innerHTML = '';
        if (sites.length === 0) {
            siteList.innerHTML = '<li style="padding: 10px; color: #777;">No sites configured.</li>';
            return;
        }
        sites.forEach((site, index) => {
            const li = document.createElement('li');
            li.className = 'site-item';
            li.innerHTML = `
                <div>
                    <span class="site-item-name">${site.name}</span>
                    <span class="site-item-host">${site.host}</span>
                </div>
                <div class="site-item-actions">
                    <button class="edit-btn">Edit</button>
                    <button class="delete-btn btn-danger">Delete</button>
                </div>
            `;
            li.querySelector('.edit-btn').addEventListener('click', () => openModal(index));
            li.querySelector('.delete-btn').addEventListener('click', () => deleteSite(index));
            siteList.appendChild(li);
        });
    }

    function restoreSites() {
        chrome.storage.local.get({ sites: [] }, (items) => {
            if (!chrome.runtime.lastError) {
                sites = items.sites;
                renderSiteList();
            }
        });
    }

    function saveSites() {
        chrome.storage.local.set({ sites: sites }, () => {
            if (chrome.runtime.lastError) {
                showStatus('Error saving site list.', 'red');
            }
        });
    }

    function deleteSite(index) {
        const siteNameToDelete = sites[index].name;
        // Using a custom modal/dialog would be better, but confirm is simple.
        if (confirm(`Are you sure you want to delete "${siteNameToDelete}"?`)) {
            const hostToDelete = sites[index].host;
            const origin = `*://${hostToDelete}/*`;

            // Also remove the permission for this host
            chrome.permissions.remove({ origins: [origin] }, (removed) => {
                if (removed) {
                    console.log(`Permission for ${hostToDelete} removed.`);
                } else {
                    console.warn(`Could not remove permission for ${hostToDelete}. It might not have been granted.`);
                }
                 // Proceed with deleting from storage regardless of permission removal result
                sites.splice(index, 1);
                saveSites();
                renderSiteList();
            });
        }
    }
    
    // --- Backup and Restore ---
    function handleBackup() {
        chrome.storage.local.get(null, (items) => {
            if (chrome.runtime.lastError) {
                showStatus('Error retrieving settings for backup.', 'red');
                return;
            }
            const jsonString = JSON.stringify(items, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const date = new Date().toISOString().slice(0, 10);
            link.href = url;
            link.download = `sickchill-plugin-backup-${date}.json`;
            link.click();
            URL.revokeObjectURL(url);
        });
    }
    
    function handleRestore(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const settings = JSON.parse(e.target.result);
                chrome.storage.local.clear(() => {
                    chrome.storage.local.set(settings, () => {
                        if (chrome.runtime.lastError) {
                            showStatus('Error restoring settings.', 'red');
                        } else {
                            showStatus('Settings successfully restored!', 'green');
                            restoreGeneralSettings();
                            restoreSites();
                        }
                    });
                });
            } catch (error) {
                showStatus('Invalid backup file.', 'red');
            }
        };
        reader.readAsText(file);
        restoreInput.value = '';
    }

    // --- Modal Functions ---
    function openModal(index = null) {
        if (index !== null) {
            modalTitle.textContent = 'Edit Site';
            const site = sites[index];
            siteIdInput.value = index;
            siteNameInput.value = site.name;
            siteHostInput.value = site.host;
            siteUrlRegexInput.value = site.urlRegex || '';
            siteContentRegexInput.value = site.contentRegex || '';
            nameExtractionRegexInput.value = site.nameExtractionRegex || '';
            nameExtractionXpathInput.value = site.nameExtractionXpath || '';
            injectionXpathInput.value = site.injectionXpath || '';
        } else {
            modalTitle.textContent = 'Add New Site';
            // Clear all fields
            document.querySelector('#siteModal .modal-content').querySelectorAll('input').forEach(input => input.value = '');
        }
        modal.style.display = 'flex';
    }

    function closeModal() {
        modal.style.display = 'none';
    }

    function saveSiteData() {
        const siteData = {
            name: siteNameInput.value.trim(),
            host: siteHostInput.value.trim(),
            urlRegex: siteUrlRegexInput.value.trim(),
            contentRegex: siteContentRegexInput.value.trim(),
            nameExtractionRegex: nameExtractionRegexInput.value.trim(),
            nameExtractionXpath: nameExtractionXpathInput.value.trim(),
            injectionXpath: injectionXpathInput.value.trim(),
        };
        
        const id = siteIdInput.value;
        if (id) {
            sites[parseInt(id, 10)] = siteData;
        } else {
            sites.push(siteData);
        }
        
        saveSites();
        renderSiteList();
        closeModal();
    }
    
    function handleSaveFromModal() {
        const name = siteNameInput.value.trim();
        const host = siteHostInput.value.trim();
        const injectionXpath = injectionXpathInput.value.trim();
        const nameExtractionRegex = nameExtractionRegexInput.value.trim();
        const nameExtractionXpath = nameExtractionXpathInput.value.trim();

        if (!name || !host || !injectionXpath) {
            alert('Site Name, Site Host, and Injection XPath are required.');
            return;
        }
        if ((!nameExtractionRegex && !nameExtractionXpath) || (nameExtractionRegex && nameExtractionXpath)) {
            alert('You must provide exactly one name extraction method (either Regex or XPath).');
            return;
        }

        const origin = `*://${host}/*`;
        chrome.permissions.contains({ origins: [origin] }, (result) => {
            if (result) {
                // We already have permission, just save.
                saveSiteData();
            } else {
                // Request permission.
                chrome.permissions.request({ origins: [origin] }, (granted) => {
                    if (granted) {
                        saveSiteData();
                    } else {
                        alert(`Permission for "${host}" was denied. The site will not be saved.`);
                    }
                });
            }
        });
    }

    // --- Version Display ---
    function displayVersion() {
        const manifest = chrome.runtime.getManifest();
        if (manifest && manifest.version) {
            versionDisplay.textContent = `Version: ${manifest.version}`;
        }
    }

    // --- Event Listeners ---
    saveGeneralBtn.addEventListener('click', saveGeneralSettings);
    addSiteBtn.addEventListener('click', () => openModal());
    cancelModalBtn.addEventListener('click', closeModal);
    saveModalBtn.addEventListener('click', handleSaveFromModal);
    backupBtn.addEventListener('click', handleBackup);
    restoreBtn.addEventListener('click', () => restoreInput.click());
    restoreInput.addEventListener('change', handleRestore);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // --- Initial Load ---
    restoreGeneralSettings();
    restoreSites();
    displayVersion();
});
