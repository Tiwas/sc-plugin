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
    
    // Backup/Restore elements
    const backupBtn = document.getElementById('backupBtn');
    const restoreBtn = document.getElementById('restoreBtn');
    const restoreInput = document.getElementById('restoreInput');
    
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
        // Get all selected language options into an array
        const selectedLangs = [...document.getElementById('apiLanguages').selectedOptions].map(opt => opt.value);

        const settings = {
            externalAddress: document.getElementById('externalAddress').value,
            internalAddress: document.getElementById('internalAddress').value,
            apiKey: document.getElementById('apiKey').value,
            apiLanguages: selectedLangs, // Save the array of languages
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
        // Add 'apiLanguages' to the list of keys to retrieve
        const keys = ['externalAddress', 'internalAddress', 'apiKey', 'apiLanguages'];
        chrome.storage.local.get(keys, (items) => {
            if (!chrome.runtime.lastError) {
                document.getElementById('externalAddress').value = items.externalAddress || '';
                document.getElementById('internalAddress').value = items.internalAddress || '';
                document.getElementById('apiKey').value = items.apiKey || '';

                // Restore selected languages, defaulting to 'en' if nothing is saved
                const savedLangs = items.apiLanguages || ['en'];
                const langOptions = document.getElementById('apiLanguages').options;
                for (const option of langOptions) {
                    // If the option's value is in our saved array, select it
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
        siteList.innerHTML = ''; // Clear existing list
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
    
    // --- Backup and Restore Functions ---
    function handleBackup() {
        // Get all data from chrome.storage.local
        chrome.storage.local.get(null, (items) => {
            if (chrome.runtime.lastError) {
                showStatus('Error retrieving settings for backup.', 'red');
                return;
            }
            
            // Convert the settings object to a JSON string
            const jsonString = JSON.stringify(items, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            
            // Create a link to download the blob
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const date = new Date().toISOString().slice(0, 10);
            link.href = url;
            link.download = `sickchill-plugin-backup-${date}.json`;
            
            // Trigger the download
            link.click();
            
            // Clean up the object URL
            URL.revokeObjectURL(url);
        });
    }
    
    function handleRestore(event) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const settings = JSON.parse(e.target.result);
                
                // Clear existing settings first to avoid merging issues
                chrome.storage.local.clear(() => {
                    // Then, set the new settings from the backup file
                    chrome.storage.local.set(settings, () => {
                        if (chrome.runtime.lastError) {
                            showStatus('Error restoring settings.', 'red');
                        } else {
                            showStatus('Settings successfully restored!', 'green');
                            // Reload all settings on the page to reflect the changes
                            restoreGeneralSettings();
                            restoreSites();
                        }
                    });
                });
            } catch (error) {
                showStatus('Invalid backup file. Please select a valid JSON file.', 'red');
            }
        };
        
        reader.readAsText(file);
        // Reset the input value to allow restoring the same file again
        restoreInput.value = '';
    }

    // --- Modal Functions ---
    function openModal(index = null) {
        if (index !== null) {
            // Editing existing site
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
            // Adding new site
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
        const name = siteNameInput.value.trim();
        const host = siteHostInput.value.trim();
        const injectionXpath = injectionXpathInput.value.trim();
        const nameExtractionRegex = nameExtractionRegexInput.value.trim();
        const nameExtractionXpath = nameExtractionXpathInput.value.trim();

        // Rule: Basic fields are required
        if (!name || !host) {
            alert('Site Name and Site Host are required.');
            return;
        }

        // Rule: Injection XPath is required
        if (!injectionXpath) {
            alert('Injection XPath is required.');
            return;
        }

        // Rule: Exactly one name extraction method must be provided
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
            // Editing
            sites[parseInt(id)] = siteData;
        } else {
            // Adding
            sites.push(siteData);
        }
        
        saveSites();
        renderSiteList();
        closeModal();
    }

    // --- Event Listeners ---
    saveGeneralBtn.addEventListener('click', saveGeneralSettings);
    addSiteBtn.addEventListener('click', () => openModal());
    cancelModalBtn.addEventListener('click', closeModal);
    saveModalBtn.addEventListener('click', saveFromModal);
    
    // Backup/Restore Listeners
    backupBtn.addEventListener('click', handleBackup);
    restoreBtn.addEventListener('click', () => restoreInput.click()); // Trigger the hidden file input
    restoreInput.addEventListener('change', handleRestore);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // --- Initial Load ---
    restoreGeneralSettings();
    restoreSites();
});