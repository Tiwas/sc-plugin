// options.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Element References ---
    const saveGeneralBtn = document.getElementById('saveGeneral');
    const statusDiv = document.getElementById('status');
    const siteList = document.getElementById('siteList');
    const addSiteBtn = document.getElementById('addSiteBtn');
    const modal = document.getElementById('siteModal');
    const modalTitle = document.getElementById('modalTitle');
    const cancelModalBtn = document.getElementById('cancelModalBtn');
    const saveModalBtn = document.getElementById('saveModalBtn');

    // Data Management elements
    const backupBtn = document.getElementById('backupBtn');
    const restoreBtn = document.getElementById('restoreBtn');
    const restoreInput = document.getElementById('restoreInput');
    const loadExamplesBtn = document.getElementById('loadExamplesBtn');

    // Share elements
    const shareRulesBtn = document.getElementById('shareRulesBtn');
    const shareModal = document.getElementById('shareModal');
    const cancelShareModalBtn = document.getElementById('cancelShareModalBtn');
    const generateShareLinkBtn = document.getElementById('generateShareLinkBtn');
    const shareSiteList = document.getElementById('shareSiteList');

    // Import elements
    const importModal = document.getElementById('importModal');
    const importSiteList = document.getElementById('importSiteList');
    const cancelImportModalBtn = document.getElementById('cancelImportModalBtn');
    const importSelectedBtn = document.getElementById('importSelectedBtn');

    // Version display element
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
    let pendingImportSettings = null; // To hold settings while user chooses

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
            if (chrome.runtime.lastError) {
                showStatus('Error saving general settings.', 'red');
            } else {
                showStatus('General settings saved.', 'green');
            }
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
        setTimeout(() => {
            statusDiv.textContent = '';
        }, 3000);
    }

    // --- Site List Functions ---
    function renderSiteList() {
        siteList.innerHTML = '';
        if (sites.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No sites configured.';
            li.style.padding = '10px';
            li.style.color = '#777';
            siteList.appendChild(li);
            return;
        }
        sites.forEach((site, index) => {
            const li = document.createElement('li');
            li.className = 'site-item';
            const isEnabled = site.enabled !== false;
            li.innerHTML = `
                <label class="switch" title="Enable/Disable Rule">
                    <input type="checkbox" class="enabled-toggle" ${isEnabled ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
                <div class="site-details">
                    <span class="site-item-name">${site.name}</span>
                    <br>
                    <span class="site-item-host">${site.host}</span>
                </div>
                <div class="site-item-actions">
                    <button class="edit-btn">Edit</button>
                    <button class="delete-btn btn-danger">Delete</button>
                </div>
            `;
            li.querySelector('.edit-btn').addEventListener('click', () => openModal(index));
            li.querySelector('.delete-btn').addEventListener('click', () => deleteSite(index));
            li.querySelector('.enabled-toggle').addEventListener('change', (event) => {
                toggleSiteEnabled(index, event.target.checked);
            });
            siteList.appendChild(li);
        });
    }

    function toggleSiteEnabled(index, enabledStatus) {
        sites[index].enabled = enabledStatus;
        saveSites();
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
            } else {
                console.log('Site list saved.');
            }
        });
    }

    function deleteSite(index) {
        if (confirm(`Are you sure you want to delete "${sites[index].name}"?`)) {
            sites.splice(index, 1);
            saveSites();
            renderSiteList();
        }
    }

    // --- Data Management Functions ---
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
                const importedSettings = JSON.parse(e.target.result);
                // Store settings and open modal for user to choose sites
                pendingImportSettings = importedSettings;
                openImportModal(importedSettings.sites || []);
            } catch (error) {
                showStatus('Invalid backup file. Please select a valid JSON file.', 'red');
            }
        };
        reader.readAsText(file);
        restoreInput.value = ''; // Reset for next use
    }
    
    async function handleLoadExamples() {
        try {
            const response = await fetch('https://tiwas.github.io/sc-plugin/getting_started.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const exampleSettings = await response.json();
            showStatus('Example rules loaded. Merging...', 'blue');
            // Reuse the same logic as restore, but without general settings
            mergeSettings({ sites: exampleSettings.sites });
        } catch (error) {
            console.error('Error fetching example rules:', error);
            showStatus('Could not load example rules from GitHub.', 'red');
        }
    }

    function mergeSettings(settingsToImport) {
        chrome.storage.local.get(null, (existingSettings) => {
            if (chrome.runtime.lastError) {
                showStatus('Error reading existing settings.', 'red');
                return;
            }

            // Merge general settings only if they exist in the import
            const newGeneralSettings = { ...existingSettings };
            if (settingsToImport.externalAddress !== undefined) newGeneralSettings.externalAddress = settingsToImport.externalAddress;
            if (settingsToImport.internalAddress !== undefined) newGeneralSettings.internalAddress = settingsToImport.internalAddress;
            if (settingsToImport.apiKey !== undefined) newGeneralSettings.apiKey = settingsToImport.apiKey;
            if (settingsToImport.apiLanguages !== undefined) newGeneralSettings.apiLanguages = settingsToImport.apiLanguages;
            delete newGeneralSettings.sites;

            let existingSites = existingSettings.sites || [];
            const importedSites = settingsToImport.sites || [];

            for (const importedSite of importedSites) {
                const duplicateIndex = existingSites.findIndex(
                    (site) => site.name === importedSite.name && site.host === importedSite.host
                );
                if (duplicateIndex !== -1) {
                    const overwrite = confirm(
                        `A site named "${importedSite.name}" already exists.\n\n` +
                        `OK = Overwrite existing site.\n` +
                        `Cancel = Skip this imported site.`
                    );
                    if (overwrite) {
                        existingSites[duplicateIndex] = importedSite;
                    }
                } else {
                    existingSites.push(importedSite);
                }
            }

            const finalSettings = { ...newGeneralSettings, sites: existingSites };
            chrome.storage.local.set(finalSettings, () => {
                if (chrome.runtime.lastError) {
                    showStatus('Error merging settings.', 'red');
                } else {
                    showStatus('Settings successfully merged!', 'green');
                    restoreGeneralSettings();
                    restoreSites();
                }
            });
        });
    }
    
    // --- Import Modal Functions ---
    function openImportModal(sitesToImport) {
        importSiteList.innerHTML = '';
        if (!sitesToImport || sitesToImport.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No importable rules found in this file.';
            importSiteList.appendChild(li);
        } else {
            sitesToImport.forEach((site, index) => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <label>
                        <input type="checkbox" data-site-index="${index}" checked>
                        ${site.name} (${site.host})
                    </label>`;
                importSiteList.appendChild(li);
            });
        }
        importModal.style.display = 'flex';
    }

    function closeImportModal() {
        importModal.style.display = 'none';
        pendingImportSettings = null; // Clear pending data
    }

    function handleConfirmImport() {
        if (!pendingImportSettings) return;

        const selectedSites = [];
        const checkboxes = importSiteList.querySelectorAll('input[type="checkbox"]:checked');
        
        checkboxes.forEach(cb => {
            const siteIndex = parseInt(cb.dataset.siteIndex, 10);
            selectedSites.push(pendingImportSettings.sites[siteIndex]);
        });
        
        // Create a new settings object with general settings + only selected sites
        const settingsToMerge = { ...pendingImportSettings, sites: selectedSites };

        mergeSettings(settingsToMerge);
        closeImportModal();
    }


    // --- Share Modal Functions ---
    function openShareModal() {
        shareSiteList.innerHTML = '';
        if (sites.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'You have no sites to share.';
            shareSiteList.appendChild(li);
        } else {
            sites.forEach((site, index) => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <label>
                        <input type="checkbox" data-site-index="${index}">
                        ${site.name} (${site.host})
                    </label>`;
                shareSiteList.appendChild(li);
            });
        }
        shareModal.style.display = 'flex';
    }

    function closeShareModal() {
        shareModal.style.display = 'none';
    }

    function handleGenerateShareLink() {
        const selectedSites = [];
        const checkboxes = shareSiteList.querySelectorAll('input[type="checkbox"]:checked');
        checkboxes.forEach(cb => {
            const siteIndex = parseInt(cb.dataset.siteIndex, 10);
            const { enabled, ...siteToShare } = sites[siteIndex]; // Exclude 'enabled' status
            selectedSites.push(siteToShare);
        });

        if (selectedSites.length === 0) {
            alert('Please select at least one site to share.');
            return;
        }

        const jsonString = JSON.stringify({ sites: selectedSites }, null, 2);
        const issueTitle = "New Community Site Rules Submission";
        const issueBody = `
Please review the following site rules for addition to the community examples.

**Rules:**
\`\`\`json
${jsonString}
\`\`\`
        `;
        const encodedTitle = encodeURIComponent(issueTitle);
        const encodedBody = encodeURIComponent(issueBody.trim());
        const githubUrl = `https://github.com/Tiwas/sc-plugin/issues/new?title=${encodedTitle}&body=${encodedBody}`;
        window.open(githubUrl, '_blank');
        closeShareModal();
    }

    // --- Add/Edit Site Modal Functions ---
    function openModal(index = null) {
        // ... (rest of the function is unchanged)
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
            siteIdInput.value = '';
            siteNameInput.value = '';
            siteHostInput.value = '';
            siteUrlRegexInput.value = '';
            siteContentRegexInput.value = '';
            nameExtractionRegexInput.value = '';
            nameExtractionXpathInput.value = '';
            injectionXpathInput.value = '';
        }
        modal.style.display = 'flex';
    }

    function closeModal() {
        modal.style.display = 'none';
    }

    function saveFromModal() {
        // ... (rest of the function is unchanged)
        const name = siteNameInput.value.trim();
        const host = siteHostInput.value.trim();
        const injectionXpath = injectionXpathInput.value.trim();
        const nameExtractionRegex = nameExtractionRegexInput.value.trim();
        const nameExtractionXpath = nameExtractionXpathInput.value.trim();

        if (!name || !host) {
            alert('Site Name and Site Host are required.');
            return;
        }
        if (!injectionXpath) {
            alert('Injection XPath is required.');
            return;
        }
        if (!nameExtractionRegex && !nameExtractionXpath) {
            alert('You must provide exactly one name extraction method (either Regex or XPath).');
            return;
        }
        if (nameExtractionRegex && nameExtractionXpath) {
            alert('You must provide only one name extraction method, not both.');
            return;
        }
        
        const siteData = {
            name: name,
            host: host,
            urlRegex: siteUrlRegexInput.value.trim(),
            contentRegex: siteContentRegexInput.value.trim(),
            nameExtractionRegex: nameExtractionRegex,
            nameExtractionXpath: nameExtractionXpath,
            injectionXpath: injectionXpath,
        };
        
        const id = siteIdInput.value;
        if (id) {
            siteData.enabled = sites[parseInt(id)].enabled;
            sites[parseInt(id)] = siteData;
        } else {
            siteData.enabled = true;
            sites.push(siteData);
        }
        
        saveSites();
        renderSiteList();
        closeModal();
    }

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
    saveModalBtn.addEventListener('click', saveFromModal);

    // Data Management
    backupBtn.addEventListener('click', handleBackup);
    restoreBtn.addEventListener('click', () => restoreInput.click());
    restoreInput.addEventListener('change', handleRestore);
    loadExamplesBtn.addEventListener('click', handleLoadExamples);

    // Import Modal
    cancelImportModalBtn.addEventListener('click', closeImportModal);
    importSelectedBtn.addEventListener('click', handleConfirmImport);

    // Share Modal
    shareRulesBtn.addEventListener('click', openShareModal);
    cancelShareModalBtn.addEventListener('click', closeShareModal);
    generateShareLinkBtn.addEventListener('click', handleGenerateShareLink);

    // Close modals by clicking backdrop
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    shareModal.addEventListener('click', (e) => { if (e.target === shareModal) closeShareModal(); });
    importModal.addEventListener('click', (e) => { if (e.target === importModal) closeImportModal(); });


    // --- Initial Load ---
    restoreGeneralSettings();
    restoreSites();
    displayVersion();
});