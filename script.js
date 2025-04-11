document.addEventListener('DOMContentLoaded', function () {
    const table = document.getElementById('data-table');
    // Removed duplicate table declaration
    const tableHead = table.querySelector('thead');
    const tableBody = table.querySelector('tbody');
    const loadingIndicator = document.getElementById('table-loading-indicator');
    let rows = []; // Will be populated after fetch

    // --- Configuration & Auth Variables (Implicit Grant Flow) ---
    const CLIENT_ID = '60205420705-5ldius1gebfc9svc0jqeq7cj3vh2q733.apps.googleusercontent.com';
    // IMPORTANT: Set this to your actual deployment URL in Google Cloud Console
    const REDIRECT_URI = window.location.origin + window.location.pathname;
    // Request basic profile info + sheets read-only access
    const SCOPES = 'openid profile email https://www.googleapis.com/auth/spreadsheets.readonly';
    const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
    const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
    const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

    let currentAccessToken = null; // Store the access token

    // --- DOM Elements ---
    const loginBtn = document.getElementById('authorize_button'); // Keep old ID for now, map variable
    const logoutBtn = document.getElementById('signout_button'); // Keep old ID for now, map variable
    const authStatusMessageSpan = document.getElementById('auth-status-message');
    const userInfoDiv = document.getElementById('userInfo');
    const userNameSpan = document.getElementById('userName');
    const userEmailSpan = document.getElementById('userEmail');
    const userPictureImg = document.getElementById('userPicture');
    const sheetInputSection = document.getElementById('sheet-input-section');
    const sheetIdInput = document.getElementById('sheet-id-input');
    const loadSheetButton = document.getElementById('load-sheet-button');


    const clearFiltersBtn = document.getElementById('clear-filters');
    const dynamicFilterGroupsContainer = document.getElementById('dynamic-filter-groups');
    const filterSetupPrompt = document.getElementById('filter-setup-prompt');
    const setupFiltersBtn = document.getElementById('setup-filters-btn');
    const filterColumnSelector = document.getElementById('filter-column-selector');
    const columnCheckboxesContainer = document.getElementById('column-checkboxes');
    const saveFilterSettingsBtn = document.getElementById('save-filter-settings-btn');
    const cancelFilterSettingsBtn = document.getElementById('cancel-filter-settings-btn');
    const filterSettingsBtn = document.getElementById('filter-settings-btn');
    const clearFiltersWrapper = document.getElementById('clear-filters-wrapper');

    const filterSettingsKey = 'dynamicFilterColumns'; // localStorage key for selected columns
    let configuredFilterColumns = []; // Array of { index: number, name: string }
    let activeFilters = {}; // Object to store active filters, e.g., { columnIndex: Set(['value1', 'value2']) }
    let tableHeaders = []; // Will be populated after fetch

    // --- Authentication (Implicit Grant Flow) ---

    /**
     * Extracts access token from the URL fragment.
     * @returns {string|null} Access token or null if not found.
     */
    function getAccessTokenFromUrl() {
        const fragment = window.location.hash.substring(1); // Remove '#'
        const params = new URLSearchParams(fragment);
        return params.get('access_token');
    }

    /**
     * Redirects the user to Google's OAuth 2.0 server.
     */
    function redirectToGoogleLogin() {
        const params = {
            client_id: CLIENT_ID,
            redirect_uri: REDIRECT_URI,
            response_type: 'token', // Use 'token' for Implicit Grant Flow
            scope: SCOPES,
            include_granted_scopes: 'true',
            // state: 'pass-through-value' // Optional
        };
        const queryString = new URLSearchParams(params).toString();
        const oauthUrl = `${AUTH_URL}?${queryString}`;
        console.log('Redirecting to:', oauthUrl);
        window.location.href = oauthUrl; // Perform the redirect
    }

    /**
     * Fetches user information from Google using the access token.
     * @param {string} accessToken The access token.
     */
    async function fetchUserInfo(accessToken) {
        try {
            console.log('Fetching user info with token:', accessToken);
            const response = await fetch(USERINFO_URL, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    console.error('Access Token seems invalid or expired.');
                    clearTokenAndLogout(); // Treat as logged out
                } else {
                    throw new Error(`Google API Error: ${response.status} ${response.statusText}`);
                }
                return;
            }
            const data = await response.json();
            console.log('User Info:', data);
            displayUserInfo(data);
            updateUI(true); // Update UI to show logged-in state
        } catch (error) {
            console.error('Failed to fetch user info:', error);
            authStatusMessageSpan.textContent = `Error fetching user info: ${error.message}`;
            updateUI(false); // Assume error means logged out state
        }
    }

    /**
     * Displays the fetched user information on the page.
     * @param {object} userInfo User data from Google.
     */
    function displayUserInfo(userInfo) {
        userNameSpan.textContent = userInfo.name || 'N/A';
        userEmailSpan.textContent = userInfo.email || 'N/A';
        if (userInfo.picture) {
            userPictureImg.src = userInfo.picture;
            userPictureImg.style.display = 'inline-block';
        } else {
            userPictureImg.style.display = 'none';
        }
        userInfoDiv.classList.remove('hidden');
    }

    /**
     * Updates the visibility of buttons and info sections based on login status.
     * @param {boolean} isLoggedIn Is the user considered logged in?
     */
    function updateUI(isLoggedIn) {
        if (isLoggedIn) {
            loginBtn.style.display = 'none';
            logoutBtn.style.display = 'block';
            sheetInputSection.style.display = 'block'; // Show sheet input
            authStatusMessageSpan.textContent = ''; // Clear status message
            // User info div visibility is handled by displayUserInfo
        } else {
            loginBtn.style.display = 'block';
            logoutBtn.style.display = 'none';
            sheetInputSection.style.display = 'none'; // Hide sheet input
            authStatusMessageSpan.textContent = 'Please sign in to load a sheet.';
            userInfoDiv.classList.add('hidden'); // Hide user info
            userNameSpan.textContent = '';
            userEmailSpan.textContent = '';
            userPictureImg.src = '';
            userPictureImg.style.display = 'none';
        }
    }

    /**
     * Clears the stored access token and updates the UI.
     */
    function clearTokenAndLogout() {
        currentAccessToken = null;
        sessionStorage.removeItem('google_access_token'); // Clear from sessionStorage
        console.log('Logging out.');
        // Clear the sensitive parts of the URL fragment if present
        if (window.location.hash.includes('access_token')) {
            try {
                // Use history.replaceState to remove hash without reload if possible
                history.replaceState(null, '', window.location.pathname + window.location.search);
            } catch (e) {
                window.location.hash = ''; // Fallback for older browsers
            }
        }
        updateUI(false);
        clearTableAndState(); // Also clear table data on logout
    }

    function clearTableAndState() {
        tableHead.innerHTML = '';
        tableBody.innerHTML = '';
        table.style.display = 'none';
        rows = [];
        tableHeaders = [];
        activeFilters = {};
        configuredFilterColumns = []; // Or reload from localStorage if preferred? For now, clear.
        // localStorage.removeItem(filterSettingsKey); // Optional: clear filter settings on sign out
        initializeFilterUI(); // Reset filter UI to initial/prompt state
        // Clear column visibility state?
        // columnVisibilityState = {};
        // localStorage.removeItem(columnVisibilityKey);
    }


    // --- Google Sheet Loading (API Version using Fetch) ---

    async function loadSheetDataFromApi() {
        if (!currentAccessToken) {
            alert('You must be signed in to load a sheet.');
            return;
        }
        const sheetIdInputValue = sheetIdInput.value.trim();
        if (!sheetIdInputValue) {
            alert('Please enter a Google Sheet ID or URL.');
            return;
        }

        // Basic extraction of Sheet ID from URL or direct ID
        let sheetId = sheetIdInputValue;
        try {
            const urlMatch = sheetIdInputValue.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
            if (urlMatch && urlMatch[1]) {
                sheetId = urlMatch[1];
            }
        } catch (e) { /* Ignore errors, assume it might be an ID */ }


        loadingIndicator.style.display = 'block';
        loadingIndicator.textContent = 'Loading table data...'; // Reset message
        table.style.display = 'none';
        clearTableAndState(); // Clear previous table/state before loading new

        try {
            // Construct the Sheets API URL
            const range = 'Sheet1!A1:Z'; // Adjust as needed
            const apiUrl = `${SHEETS_API_BASE}/${sheetId}/values/${encodeURIComponent(range)}`;

            const response = await fetch(apiUrl, {
                headers: { 'Authorization': `Bearer ${currentAccessToken}` }
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    console.error('Authorization error fetching sheet data. Token might be invalid/expired or insufficient permissions.');
                    alert('Could not load sheet. Please ensure you have access and try signing in again.');
                    clearTokenAndLogout();
                } else {
                    throw new Error(`Google Sheets API Error: ${response.status} ${response.statusText}`);
                }
                return; // Stop if not ok
            }

            const data = await response.json();

            if (!data || !data.values || data.values.length == 0) {
                console.error('No data found in sheet response.');
                loadingIndicator.textContent = 'No data found in the specified sheet or range.';
                return; // Exit early
            }

            // The API returns data as a 2D array in data.values
            const apiData = data.values;
            populateTable(apiData); // Use the existing populateTable function
            initializePostDataLoad(); // Initialize filters etc.

        } catch (err) {
            console.error('Error fetching or processing sheet data:', err);
            loadingIndicator.textContent = `Error loading sheet: ${err.message || 'Unknown error'}`;
        } finally {
            if (table.style.display !== 'none') {
                loadingIndicator.style.display = 'none';
            }
        }
    }


    function populateTable(data) { // data is now a 2D array from API
        tableHead.innerHTML = ''; // Clear existing header
        tableBody.innerHTML = ''; // Clear existing body

        if (data.length === 0) return;

        // Create Header Row
        const headerRow = tableHead.insertRow();
        data[0].forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            headerRow.appendChild(th);
        });
        // Add settings column header
        const settingsTh = document.createElement('th');
        settingsTh.className = 'settings-column';
        settingsTh.innerHTML = `<button id="settings-btn" class="settings-btn"><i class="fas fa-cog"></i></button>`;
        headerRow.appendChild(settingsTh);

        // Find the index of the "Link" column (case-insensitive)
        const linkColumnIndex = data[0].findIndex(header => header.toLowerCase() === 'link');

        // Populate Body Rows
        data.slice(1).forEach(rowData => {
            const row = tableBody.insertRow();
            rowData.forEach((cellData, cellIndex) => {
                const cell = row.insertCell();
                if (cellIndex === linkColumnIndex && cellData) {
                    // Create a button if it's the Link column and has data
                    const button = document.createElement('button');
                    button.textContent = 'Workflow'; // Static text
                    button.className = 'workflow-link'; // Apply link-like styling
                    button.dataset.imageUrl = cellData; // Store URL in data attribute
                    cell.appendChild(button);
                } else {
                    // Otherwise, just set text content
                    cell.textContent = cellData;
                }
            });
            // Add empty cell for settings column
            const settingsTd = row.insertCell();
            settingsTd.className = 'settings-column';
        });

        // Update global rows variable AFTER populating
        rows = Array.from(tableBody.getElementsByTagName('tr'));
        // Update global tableHeaders AFTER populating
        tableHeaders = table ? Array.from(table.querySelectorAll('thead th')) : [];

        table.style.display = ''; // Show table now
    }


    // --- Initialization Function (Called after data load) --- (Keep most of it)
    function initializePostDataLoad() {
        // Initialize Filter Settings & UI (Loads from localStorage)
        loadFilterSettings(); // This now depends on 'rows' being populated

        // Initialize column toggles (after table structure is potentially updated)
        if (tableHeaders.length > 0) { // Only run if headers were found
            createColumnToggles(); // This depends on tableHeaders
        }

        // Initialize search column options
        updateSearchColumnOptions();

        // Apply initial filters/search if needed (optional)
        applyFilters();

        // Re-attach listeners that might have been lost if elements were regenerated
        // (e.g., settings button listener if header was fully regenerated)
        attachSettingsMenuListeners();
        attachDoubleClickCopyListener();
        attachHamburgerListener();
        attachWorkflowModalListeners(); // Add listener for modal triggers
        // Note: Filter button listeners are added during generation
    }

    // --- Filter Settings Management --- (Keep existing functions loadFilterSettings, saveFilterSettings)

    function loadFilterSettings() {
        // Ensure 'rows' is populated before calculating filter counts
        if (rows.length === 0 && tableBody.rows.length > 0) {
            rows = Array.from(tableBody.getElementsByTagName('tr'));
        }
        const savedSettings = localStorage.getItem(filterSettingsKey);
        if (savedSettings) {
            try {
                configuredFilterColumns = JSON.parse(savedSettings);
                // Basic validation (ensure it's an array of objects with index/name)
                if (!Array.isArray(configuredFilterColumns) || !configuredFilterColumns.every(col => typeof col === 'object' && 'index' in col && 'name' in col)) {
                    configuredFilterColumns = [];
                    localStorage.removeItem(filterSettingsKey); // Clear invalid data
                }
            } catch (e) {
                console.error("Error parsing filter settings from localStorage", e);
                configuredFilterColumns = [];
                localStorage.removeItem(filterSettingsKey);
            }
        } else {
            configuredFilterColumns = [];
        }
        initializeFilterUI();
    }

    function saveFilterSettings(selectedColumns) {
        configuredFilterColumns = selectedColumns; // selectedColumns should be array of { index: number, name: string }
        localStorage.setItem(filterSettingsKey, JSON.stringify(configuredFilterColumns));
        initializeFilterUI(); // Re-initialize UI after saving
        applyFilters(); // Re-apply filters with new settings
    }

    // --- Filter Generation --- (Keep existing functions generateFilterGroup, createFilterButton)

    function generateFilterGroup(columnIndex, columnName) {
        // Ensure 'rows' is populated before calculating filter counts
        if (rows.length === 0 && tableBody.rows.length > 0) {
            rows = Array.from(tableBody.getElementsByTagName('tr'));
        }
        const uniqueValues = new Map(); // Map<value, count>
        rows.forEach(row => {
            if (row.cells[columnIndex]) {
                const cellContent = row.cells[columnIndex].textContent.trim();
                if (cellContent) {
                    // Split by comma and process each value
                    const values = cellContent.split(',').map(v => v.trim()).filter(v => v); // Trim and remove empty strings
                    values.forEach(value => {
                        uniqueValues.set(value, (uniqueValues.get(value) || 0) + 1);
                    });
                }
            }
        });

        if (uniqueValues.size === 0) return; // Don't generate group if no values found

        const filterGroup = document.createElement('div');
        filterGroup.className = 'filter-group';
        filterGroup.dataset.columnIndex = columnIndex;

        const header = document.createElement('div');
        header.className = 'filter-group-header';

        const title = document.createElement('h3');
        title.textContent = columnName;

        const clearBtn = document.createElement('button');
        clearBtn.className = 'clear-group-btn';
        clearBtn.title = `Clear ${columnName} Filters`;
        clearBtn.textContent = 'Clear';
        clearBtn.addEventListener('click', () => {
            clearGroupFilters(columnIndex);
        });

        header.appendChild(title);
        header.appendChild(clearBtn);
        filterGroup.appendChild(header);

        // Sort values alphabetically for consistent order
        Array.from(uniqueValues.keys()).sort().forEach(value => {
            const count = uniqueValues.get(value);
            const button = createFilterButton(value, columnIndex, count);
            filterGroup.appendChild(button);
        });

        dynamicFilterGroupsContainer.appendChild(filterGroup);
    }

    function createFilterButton(value, columnIndex, count) {
        const button = document.createElement('button');
        button.className = 'filter-btn';
        button.dataset.columnIndex = columnIndex;
        button.dataset.value = value;

        const textSpan = document.createElement('span');
        textSpan.textContent = value;

        const countSpan = document.createElement('span');
        countSpan.className = 'count';
        countSpan.textContent = ` (${count})`;

        button.appendChild(textSpan);
        button.appendChild(countSpan);

        // Check if this filter is currently active
        if (activeFilters[columnIndex] && activeFilters[columnIndex].has(value)) {
            button.classList.add('active');
        }

        button.addEventListener('click', () => {
            handleFilterClick(button, columnIndex, value);
        });

        return button;
    }

    // --- Filter Logic --- (Keep existing functions handleFilterClick, clearGroupFilters, clearAllFilters)

    function handleFilterClick(button, columnIndex, value) {
        button.classList.toggle('active');

        if (!activeFilters[columnIndex]) {
            activeFilters[columnIndex] = new Set();
        }

        if (button.classList.contains('active')) {
            activeFilters[columnIndex].add(value);
        } else {
            activeFilters[columnIndex].delete(value);
            if (activeFilters[columnIndex].size === 0) {
                delete activeFilters[columnIndex]; // Remove empty set
            }
        }
        applyFilters();
    }

    function clearGroupFilters(columnIndex) {
        delete activeFilters[columnIndex]; // Remove filters for this column
        // Deactivate buttons visually
        dynamicFilterGroupsContainer.querySelectorAll(`.filter-group[data-column-index="${columnIndex}"] .filter-btn.active`).forEach(btn => {
            btn.classList.remove('active');
        });
        applyFilters();
    }

    function clearAllFilters() {
        activeFilters = {}; // Clear all active filters
        // Deactivate all filter buttons visually
        dynamicFilterGroupsContainer.querySelectorAll('.filter-btn.active').forEach(btn => {
            btn.classList.remove('active');
        });
        applyFilters();
    }

    // Add event listener to the main clear button
    clearFiltersBtn.addEventListener('click', clearAllFilters);


    // --- Search Functionality ---
    const searchInput = document.getElementById('search-input');
    const searchColumn = document.getElementById('search-column');

    function updateSearchColumnOptions() {
        // Ensure tableHeaders is populated
        if (tableHeaders.length === 0 && tableHead.rows.length > 0) {
            tableHeaders = Array.from(tableHead.rows[0].cells);
        }
        searchColumn.innerHTML = '<option value="all">All Columns</option>'; // Reset
        tableHeaders.forEach((header, index) => {
            // Skip the last column (Settings)
            if (index === tableHeaders.length - 1) return;
            const option = document.createElement('option');
            option.value = index;
            option.textContent = header.textContent.trim();
            searchColumn.appendChild(option);
        });
    }


    function applyFilters() { // Handles both search and dynamic filters
        // Ensure 'rows' is populated
        if (rows.length === 0 && tableBody.rows.length > 0) {
            rows = Array.from(tableBody.getElementsByTagName('tr'));
        }
        const searchTerm = searchInput.value.toLowerCase();
        const selectedSearchColumnIndex = searchColumn.value; // 'all' or column index string

        rows.forEach(row => {
            let matchesSearch = true;
            // Apply search filter
            if (searchTerm) {
                let textToSearch;
                if (selectedSearchColumnIndex === 'all') {
                    textToSearch = Array.from(row.cells)
                        .map(cell => cell.textContent)
                        .join(' ')
                        .toLowerCase();
                } else {
                    const cellIndex = parseInt(selectedSearchColumnIndex);
                    textToSearch = row.cells[cellIndex] ? row.cells[cellIndex].textContent.toLowerCase() : '';
                }
                matchesSearch = textToSearch.includes(searchTerm);
            }

            // Apply dynamic filters
            let matchesAllActiveFilters = true;
            for (const columnIndex in activeFilters) {
                const activeValueSet = activeFilters[columnIndex];
                if (activeValueSet.size > 0) { // Only check if filters are active for this column
                    const cellContent = row.cells[columnIndex] ? row.cells[columnIndex].textContent.trim() : '';
                    const cellValues = cellContent.split(',').map(v => v.trim()).filter(v => v); // Get values in the cell

                    // Check if *at least one* value in the cell matches *any* active filter for this column
                    const matchesThisColumn = cellValues.some(cellValue => activeValueSet.has(cellValue));

                    if (!matchesThisColumn) {
                        matchesAllActiveFilters = false;
                        break; // Row doesn't match this filter group, no need to check others
                    }
                }
            }

            // Show row only if it matches search AND all active filters
            row.style.display = (matchesSearch && matchesAllActiveFilters) ? '' : 'none';
        });
    }

    // Add search event listeners
    searchInput.addEventListener('input', applyFilters);
    searchColumn.addEventListener('change', applyFilters);


    // --- UI Management --- (Keep existing functions initializeFilterUI, showColumnSelector)

    function initializeFilterUI() {
        // Clear previous dynamic groups
        dynamicFilterGroupsContainer.innerHTML = '';
        activeFilters = {}; // Reset active filters when settings change

        if (configuredFilterColumns.length > 0) {
            // Generate groups based on settings
            configuredFilterColumns.forEach(col => {
                generateFilterGroup(col.index, col.name);
            });
            filterSetupPrompt.style.display = 'none';
            filterColumnSelector.style.display = 'none';
            filterSettingsBtn.style.display = 'inline-block'; // Show cog
            clearFiltersWrapper.style.display = configuredFilterColumns.length > 0 ? 'block' : 'none'; // Show clear all if groups exist
            dynamicFilterGroupsContainer.style.display = 'block';
        } else {
            // Show setup prompt
            filterSetupPrompt.style.display = 'block';
            filterColumnSelector.style.display = 'none';
            filterSettingsBtn.style.display = 'none'; // Hide cog
            clearFiltersWrapper.style.display = 'none'; // Hide clear all
            dynamicFilterGroupsContainer.style.display = 'none';
        }
    }

    function showColumnSelector() {
        filterSetupPrompt.style.display = 'none';
        dynamicFilterGroupsContainer.style.display = 'none'; // Hide existing filter groups
        clearFiltersWrapper.style.display = 'none'; // Hide clear all button

        columnCheckboxesContainer.innerHTML = ''; // Clear previous checkboxes
        const headers = Array.from(table.querySelectorAll('thead th'));

        headers.forEach((header, index) => {
            // Skip the last column (Settings)
            if (index === headers.length - 1) return;

            const columnName = header.textContent.trim();
            const checkboxId = `filter-col-checkbox-${index}`;

            const label = document.createElement('label');
            label.htmlFor = checkboxId;

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = checkboxId;
            input.value = index; // Store index in value
            input.dataset.columnName = columnName; // Store name

            // Check if this column is currently configured
            input.checked = configuredFilterColumns.some(col => col.index === index);

            label.appendChild(input);
            label.appendChild(document.createTextNode(` ${columnName}`)); // Add space before name
            columnCheckboxesContainer.appendChild(label);
        });

        filterColumnSelector.style.display = 'block';
    }

    // Event Listeners for Setup/Settings UI
    setupFiltersBtn.addEventListener('click', showColumnSelector);
    filterSettingsBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent click from bubbling to header
        showColumnSelector();
    });

    saveFilterSettingsBtn.addEventListener('click', () => {
        const selectedColumns = [];
        columnCheckboxesContainer.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
            selectedColumns.push({
                index: parseInt(checkbox.value),
                name: checkbox.dataset.columnName
            });
        });
        // Sort by index to maintain consistent order if needed
        selectedColumns.sort((a, b) => a.index - b.index);
        saveFilterSettings(selectedColumns); // This also calls initializeFilterUI and applyFilters
    });

    cancelFilterSettingsBtn.addEventListener('click', () => {
        filterColumnSelector.style.display = 'none';
        // Restore visibility based on whether filters were previously configured
        initializeFilterUI(); // This will show prompt or existing filters
    });


    // --- Dynamic Column Visibility (Table Columns) --- (Keep existing functions loadColumnVisibilityState, toggleColumn, createColumnToggles)
    const columnTogglesContainer = document.querySelector('.settings-menu .column-toggles');
    const columnVisibilityKey = 'columnVisibilityState'; // localStorage key
    let columnVisibilityState = {}; // Object like { columnIndex: boolean (isVisible) }

    function loadColumnVisibilityState() {
        const savedState = localStorage.getItem(columnVisibilityKey);
        if (savedState) {
            try {
                columnVisibilityState = JSON.parse(savedState);
                // Optional: Add validation if needed
            } catch (e) {
                console.error("Error parsing column visibility state:", e);
                columnVisibilityState = {}; // Reset on error
            }
        } else {
            columnVisibilityState = {}; // Default to empty (all visible)
        }
    }

    function toggleColumn(columnIndex, isVisible) {
        // const table = document.getElementById('data-table'); // Already defined globally
        // const headers = table.querySelectorAll('thead th'); // Use global tableHeaders
        const bodyRows = table.querySelectorAll('tbody tr');

        // Toggle header visibility
        const headers = tableHeaders; // Use the globally defined headers
        if (headers[columnIndex]) {
            headers[columnIndex].classList.toggle('hide-column', !isVisible);
        }

        // Toggle cells visibility in body rows
        bodyRows.forEach(row => {
            const cell = row.cells[columnIndex];
            if (cell) {
                cell.classList.toggle('hide-column', !isVisible);
            }
        });

        // Update and save state
        columnVisibilityState[columnIndex] = isVisible;
        localStorage.setItem(columnVisibilityKey, JSON.stringify(columnVisibilityState));
    }

    function createColumnToggles() {
        loadColumnVisibilityState(); // Load state before creating toggles
        columnTogglesContainer.innerHTML = ''; // Clear existing (if any)
        // Ensure tableHeaders is populated
        if (tableHeaders.length === 0 && tableHead.rows.length > 0) {
            tableHeaders = Array.from(tableHead.rows[0].cells);
        }

        tableHeaders.forEach((header, index) => {
            // Skip the last column (Settings) - Use global tableHeaders length
            if (!header || index === tableHeaders.length - 1) return;

            const columnName = header.textContent.trim();
            const toggleId = `toggle-col-${index}`;

            const label = document.createElement('label');
            label.className = 'switch';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = toggleId;
            // Set initial state based on loaded state, default to true (visible) if not set
            const isVisible = columnVisibilityState.hasOwnProperty(index) ? columnVisibilityState[index] : true;
            input.checked = isVisible;
            input.dataset.columnIndex = index; // Store index

            // Apply initial visibility class (important!)
            if (!isVisible) {
                if (tableHeaders[index]) tableHeaders[index].classList.add('hide-column');
                // Also hide corresponding body cells initially
                table.querySelectorAll(`tbody tr td:nth-child(${index + 1})`).forEach(cell => cell.classList.add('hide-column'));
            }


            const slider = document.createElement('span');
            slider.className = 'slider round';

            const switchLabel = document.createElement('span');
            switchLabel.className = 'switch-label';
            switchLabel.textContent = columnName;

            label.appendChild(input);
            label.appendChild(slider);
            label.appendChild(switchLabel);

            columnTogglesContainer.appendChild(label);

            // Add event listener
            input.addEventListener('change', (e) => {
                toggleColumn(index, e.target.checked);
            });
        });
    }

    // Settings menu functionality
    const settingsMenu = document.getElementById('settings-menu');
    // Need to re-attach listener after header generation
    function attachSettingsMenuListeners() {
        const settingsBtn = document.getElementById('settings-btn'); // Get potentially new button
        if (settingsBtn && settingsMenu) { // Check both exist
            settingsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                settingsMenu.classList.toggle('active');
            });
        }
        // Close settings menu when clicking outside (keep existing listener)
        // document.addEventListener('click', (e) => { ... }); // Already exists below
    }


    // Update table cells to accommodate settings column (Keep existing function)
    function updateTableStructure() {
        const rows = table.getElementsByTagName('tr');
        Array.from(rows).forEach(row => {
            if (row.cells.length === 7) { // Only add cell if it doesn't exist
                const cell = document.createElement(row === rows[0] ? 'th' : 'td');
                cell.className = 'settings-column';
                row.appendChild(cell);
            }
        });
    } // <-- Add missing closing brace for updateTableStructure

    // --- Filter Container Collapse/Expand --- (Keep existing functions setFilterState, toggleFilterCollapse and listeners)
    const filterContainer = document.getElementById('filter-container');
    const toggleFiltersBtn = document.getElementById('toggle-filters-btn');
    const filterContainerHeader = document.querySelector('.filter-container-header'); // Get header element
    const filterStateKey = 'filterContainerCollapsed'; // Key for localStorage

    function setFilterState(isCollapsed) {
        const icon = toggleFiltersBtn.querySelector('i');
        if (isCollapsed) {
            filterContainer.classList.add('collapsed');
            icon.classList.remove('fa-chevron-up');
            icon.classList.add('fa-chevron-down');
            localStorage.setItem(filterStateKey, 'true');
        } else {
            filterContainer.classList.remove('collapsed');
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-up');
            localStorage.setItem(filterStateKey, 'false');
        }
    }

    function toggleFilterCollapse() {
        const isCurrentlyCollapsed = filterContainer.classList.contains('collapsed');
        setFilterState(!isCurrentlyCollapsed); // Toggle the state
    }

    // Initial state setup on load
    const savedState = localStorage.getItem(filterStateKey);
    // Default to open (not collapsed) if no saved state or saved as 'false'
    setFilterState(savedState === 'true');


    // Add listeners to both the button and the header area
    toggleFiltersBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent header listener from firing too
        toggleFilterCollapse();
    });
    filterContainerHeader.addEventListener('click', toggleFilterCollapse);


    // Add double-click to copy functionality (ensure table exists)
    function attachDoubleClickCopyListener() {
        if (!table) return; // Guard against null table
        table.addEventListener('dblclick', (e) => {
            const cell = e.target.closest('td');
            if (!cell || cell.classList.contains('settings-column')) return;

            const text = cell.textContent;
            navigator.clipboard.writeText(text).then(() => {
                // Show copy feedback
                cell.classList.add('copied');
                setTimeout(() => {
                    cell.classList.remove('copied');
                }, 1000);
            }).catch(err => {
                console.error('Failed to copy:', err);
            });
        });
    }


    // --- Hamburger Menu Toggle ---
    function attachHamburgerListener() {
        const hamburgerBtn = document.getElementById('hamburger-btn');
        const navMenu = document.getElementById('nav-menu');

        if (hamburgerBtn && navMenu) { // Check if elements exist
            hamburgerBtn.addEventListener('click', () => {
                navMenu.classList.toggle('active');
            });
            // Keep the close on outside click listener attached to document
        }
    }

    // Close menus (settings, hamburger) when clicking outside
    document.addEventListener('click', (e) => {
        // Close settings menu
        const settingsBtn = document.getElementById('settings-btn'); // Need to get it again
        if (settingsMenu && settingsBtn && !settingsMenu.contains(e.target) && !settingsBtn.contains(e.target)) {
            settingsMenu.classList.remove('active');
        }
        // Close hamburger menu
        const hamburgerBtn = document.getElementById('hamburger-btn'); // Need to get it again
        const navMenu = document.getElementById('nav-menu'); // Need to get it again
        if (navMenu && hamburgerBtn && navMenu.classList.contains('active') && window.innerWidth <= 768 && !navMenu.contains(e.target) && !hamburgerBtn.contains(e.target)) {
            navMenu.classList.remove('active');
        }
    });


    // --- Initial Load ---
    // --- Image Modal Logic ---
    const modal = document.getElementById("imageModal");
    const modalImg = document.getElementById("modalImage");
    const captionText = document.getElementById("modalCaption");
    const modalCloseBtn = document.getElementById("modalCloseBtn");

    function openImageModal(imageUrl) {
        if (modal && modalImg) {
            modal.style.display = "block";
            modalImg.src = imageUrl;
            // captionText.innerHTML = this.alt; // Optional: Add caption if needed
        }
    }

    function closeImageModal() {
        if (modal) {
            modal.style.display = "none";
            modalImg.src = ""; // Clear src
        }
    }

    // Attach listeners to dynamically created workflow buttons
    function attachWorkflowModalListeners() {
        tableBody.addEventListener('click', function (event) {
            if (event.target.classList.contains('workflow-link')) {
                const imageUrl = event.target.dataset.imageUrl;
                if (imageUrl) {
                    openImageModal(imageUrl);
                }
            }
        });
    }

    // Close modal listeners
    if (modalCloseBtn) {
        modalCloseBtn.onclick = closeImageModal;
    }
    // Close modal if clicking outside the image
    if (modal) {
        modal.onclick = function (event) {
            if (event.target === modal) { // Check if click is on the background overlay
                closeImageModal();
            }
        }
    }


    // --- Initial Load & Event Listeners ---

    // Assign button listeners
    loginBtn.onclick = redirectToGoogleLogin;
    logoutBtn.onclick = clearTokenAndLogout;
    loadSheetButton.onclick = loadSheetDataFromApi;

    // Check for access token on page load (from storage first, then URL)
    window.addEventListener('load', () => {
        let accessToken = sessionStorage.getItem('google_access_token'); // Check storage first

        if (accessToken) {
            console.log('Access Token found in sessionStorage');
            currentAccessToken = accessToken;
            fetchUserInfo(currentAccessToken); // Validate token and update UI
        } else {
            accessToken = getAccessTokenFromUrl(); // Check URL fragment if not in storage
            if (accessToken) {
                console.log('Access Token found in URL');
                currentAccessToken = accessToken; // Store the token
                sessionStorage.setItem('google_access_token', accessToken); // Save to sessionStorage

                // Remove token from URL bar for cleanliness/security
                try {
                    history.replaceState(null, '', window.location.pathname + window.location.search);
                } catch (e) {
                    window.location.hash = ''; // Fallback
                }

                fetchUserInfo(currentAccessToken); // Fetch user info now
            } else {
                // No token found anywhere
                updateUI(false); // Ensure initial state is logged out
            }
        }
    });

    // Keep other listeners like modal, double-click, hamburger etc.
    // The attach... functions will be called by initializePostDataLoad if data loads


}); // <-- Correct closing }); for DOMContentLoaded
