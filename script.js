import {
    populateTable,
    initializePostDataLoad,
    setupTableEventListeners,
    clearTableAndState as clearTableDataAndState, // Renamed to avoid conflict
    showLoadingIndicator,
    hideLoadingIndicator
} from './tableOperations.js';

document.addEventListener('DOMContentLoaded', function () {
    // --- Configuration & Auth Variables (Implicit Grant Flow) ---
    const CLIENT_ID = '60205420705-5ldius1gebfc9svc0jqeq7cj3vh2q733.apps.googleusercontent.com';
    const REDIRECT_URI = window.location.origin + window.location.pathname;
    const SCOPES = 'openid profile email https://www.googleapis.com/auth/spreadsheets.readonly';
    const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
    const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
    const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

    let currentAccessToken = null; // Store the access token

    // --- DOM Elements (Main Script) ---
    const initialLoadForm = document.getElementById('initial-load-form'); // Added
    const filterContainer = document.getElementById('filter-container'); // Added
    const searchContainer = document.getElementById('search-container'); // Added
    const tableContainer = document.querySelector('.table-container'); // Added

    // Get references to elements within BOTH forms (initial and modal)
    // Initial Form Elements
    const loginBtn = initialLoadForm?.querySelector('#authorize_button');
    const logoutBtn = initialLoadForm?.querySelector('#signout_button');
    const userInfoDiv = initialLoadForm?.querySelector('#userInfo');
    const userNameSpan = initialLoadForm?.querySelector('#userName');
    const userEmailSpan = initialLoadForm?.querySelector('#userEmail');
    const userPictureImg = initialLoadForm?.querySelector('#userPicture');
    const sheetIdInput = initialLoadForm?.querySelector('#sheet-id-input');
    const loadSheetButton = initialLoadForm?.querySelector('#load-sheet-button');

    // Navbar Elements
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const navMenu = document.getElementById('nav-menu');
    const openLoadModalBtn = document.getElementById('open-load-modal-btn'); // Button in navbar

    // Modal Elements
    const loadSheetModal = document.getElementById('loadSheetModal');
    const closeLoadModalBtn = document.getElementById('closeLoadModalBtn'); // Close button in modal
    const modalSheetIdInput = loadSheetModal?.querySelector('#sheet-id-input');
    const modalLoadSheetButton = loadSheetModal?.querySelector('#load-sheet-button');
    const modalLoginButton = loadSheetModal?.querySelector('#authorize_button');
    const modalLogoutButton = loadSheetModal?.querySelector('#signout_button');
    const modalUserInfoDiv = loadSheetModal?.querySelector('#userInfo');


    // --- State (Main Script) ---
    const lastSheetIdKey = 'lastLoadedSheetId'; // localStorage key for sheet ID

    // --- UI State Functions ---

    function resetToInitialView() {
        console.log("Resetting to initial view");
        if (initialLoadForm) initialLoadForm.style.display = 'block'; // Or 'flex' etc. depending on CSS
        if (filterContainer) filterContainer.style.display = 'none';
        if (searchContainer) searchContainer.style.display = 'none';
        if (openLoadModalBtn) openLoadModalBtn.style.display = 'none';
        // Also hide the table itself and any loading indicators from tableOperations
        const dataTable = document.getElementById('data-table');
        const loadingIndicator = document.getElementById('table-loading-indicator');
        if (dataTable) dataTable.style.display = 'none';
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (tableContainer) tableContainer.style.display = 'none'; // Hide whole container
    }

    function showMainContentView() {
        console.log("Showing main content view");
        if (initialLoadForm) initialLoadForm.style.display = 'none';
        if (filterContainer) filterContainer.style.display = 'block'; // Or 'flex' etc.
        if (searchContainer) searchContainer.style.display = 'block'; // Or 'flex' etc.
        if (tableContainer) tableContainer.style.display = 'block'; // Show table container
        if (openLoadModalBtn) {
            openLoadModalBtn.style.display = 'block'; // Or 'inline-block' etc.
            openLoadModalBtn.textContent = 'Load Different Sheet';
        }
    }

    // --- Authentication (Implicit Grant Flow) ---

    function getAccessTokenFromUrl() {
        const fragment = window.location.hash.substring(1);
        const params = new URLSearchParams(fragment);
        return params.get('access_token');
    }

    function redirectToGoogleLogin() {
        const params = {
            client_id: CLIENT_ID,
            redirect_uri: REDIRECT_URI,
            response_type: 'token',
            scope: SCOPES,
            include_granted_scopes: 'true',
        };
        const queryString = new URLSearchParams(params).toString();
        const oauthUrl = `${AUTH_URL}?${queryString}`;
        console.log('Redirecting to:', oauthUrl);
        window.location.href = oauthUrl;
    }

    async function fetchUserInfo(accessToken) {
        try {
            console.log('Fetching user info with token:', accessToken);
            const response = await fetch(USERINFO_URL, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    console.error('Access Token seems invalid or expired.');
                    clearTokenAndLogout(); // This will reset the view
                } else {
                    throw new Error(`Google API Error: ${response.status} ${response.statusText}`);
                }
                return; // Exit if token is invalid
            }
            const data = await response.json();
            console.log('User Info:', data);
            displayUserInfo(data); // Update user info display in both forms
            updateUI(true); // Update button states
        } catch (error) {
            console.error('Failed to fetch user info:', error);
            updateUI(false); // Ensure UI reflects logged-out state if fetch fails
            // Don't reset view here, might be a temporary network issue
        }
    }

    // Updated to potentially update both initial form and modal form elements
    function displayUserInfo(userInfo) {
        const name = userInfo.name || 'N/A';
        const email = userInfo.email || 'N/A';
        const picture = userInfo.picture;

        // Update initial form elements
        if (userNameSpan) userNameSpan.textContent = name;
        if (userEmailSpan) userEmailSpan.textContent = email;
        if (userPictureImg) {
            if (picture) {
                userPictureImg.src = picture;
                userPictureImg.style.display = 'inline-block';
            } else {
                userPictureImg.style.display = 'none';
            }
        }
        if (userInfoDiv) userInfoDiv.classList.remove('hidden');

        // Update modal form elements
        const modalUserNameSpan = modalUserInfoDiv?.querySelector('#userName');
        const modalUserEmailSpan = modalUserInfoDiv?.querySelector('#userEmail');
        const modalUserPictureImg = modalUserInfoDiv?.querySelector('#userPicture');

        if (modalUserNameSpan) modalUserNameSpan.textContent = name;
        if (modalUserEmailSpan) modalUserEmailSpan.textContent = email;
        if (modalUserPictureImg) {
            if (picture) {
                modalUserPictureImg.src = picture;
                modalUserPictureImg.style.display = 'inline-block';
            } else {
                modalUserPictureImg.style.display = 'none';
            }
        }
        if (modalUserInfoDiv) modalUserInfoDiv.classList.remove('hidden');
    }


    // Updates the state of login/logout buttons in BOTH forms
    function updateUI(isLoggedIn) {
        console.log("Updating UI, logged in:", isLoggedIn);
        // --- Update Initial Form ---
        if (loginBtn) loginBtn.style.display = isLoggedIn ? 'none' : '';
        if (logoutBtn) logoutBtn.style.display = isLoggedIn ? 'block' : 'none';
        if (userInfoDiv) {
            if (isLoggedIn) userInfoDiv.classList.remove('hidden');
            else userInfoDiv.classList.add('hidden');
        }
        // Adjust initial load button text based on login state
        if (loadSheetButton) loadSheetButton.textContent = isLoggedIn ? 'Load Sheet (Signed In)' : 'Load Public Sheet';


        // --- Update Modal Form ---
        if (modalLoginButton) modalLoginButton.style.display = isLoggedIn ? 'none' : '';
        if (modalLogoutButton) modalLogoutButton.style.display = isLoggedIn ? 'block' : 'none';
        if (modalUserInfoDiv) {
            if (isLoggedIn) modalUserInfoDiv.classList.remove('hidden');
            else modalUserInfoDiv.classList.add('hidden');
        }
        // Adjust modal load button text based on login state
        if (modalLoadSheetButton) modalLoadSheetButton.textContent = isLoggedIn ? 'Load Sheet (Signed In)' : 'Load Public Sheet';


        // --- Clear User Info Display if Logged Out ---
        if (!isLoggedIn) {
            // Clear initial form
            if (userNameSpan) userNameSpan.textContent = '';
            if (userEmailSpan) userEmailSpan.textContent = '';
            if (userPictureImg) {
                userPictureImg.src = '';
                userPictureImg.style.display = 'none';
            }
            // Clear modal form
            const modalUserNameSpan = modalUserInfoDiv?.querySelector('#userName');
            const modalUserEmailSpan = modalUserInfoDiv?.querySelector('#userEmail');
            const modalUserPictureImg = modalUserInfoDiv?.querySelector('#userPicture');
            if (modalUserNameSpan) modalUserNameSpan.textContent = '';
            if (modalUserEmailSpan) modalUserEmailSpan.textContent = '';
            if (modalUserPictureImg) {
                modalUserPictureImg.src = '';
                modalUserPictureImg.style.display = 'none';
            }
        }
    }


    function clearTokenAndLogout() {
        currentAccessToken = null;
        localStorage.removeItem('google_access_token');
        localStorage.removeItem(lastSheetIdKey); // Also clear last loaded sheet on logout
        console.log('Logging out.');

        // Reset the view to the initial form
        resetToInitialView();
        // Clear any existing table data/state
        clearTableDataAndState(); // Use renamed import

        // Update auth buttons state
        updateUI(false);

        // Clean URL hash
        if (window.location.hash.includes('access_token')) {
            try {
                history.replaceState(null, '', window.location.pathname + window.location.search);
            } catch (e) {
                window.location.hash = '';
            }
        }
    }

    // --- CSV Parsing Utility ---
    function parseCsv(csvText) {
        const rows = csvText.split(/\r?\n/); // Split lines, handle Windows/Unix endings
        return rows.map(row => {
            const values = [];
            let currentVal = '';
            let inQuotes = false;
            for (let i = 0; i < row.length; i++) {
                const char = row[i];
                const nextChar = row[i + 1];

                if (char === '"' && nextChar === '"') { // Handle escaped quote ""
                    currentVal += '"';
                    i++; // Skip next quote
                } else if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    values.push(currentVal.trim());
                    currentVal = '';
                } else {
                    currentVal += char;
                }
            }
            values.push(currentVal.trim()); // Add last value
            return values;
        }).filter(row => row.length > 1 || (row.length === 1 && row[0] !== '')); // Filter empty rows
    }


    // --- Google Sheet Loading ---
    // This function now handles loading initiated from EITHER the initial form OR the modal
    async function loadSheetDataFromApi(eventSource = 'initial') { // eventSource can be 'initial' or 'modal'
        console.log(`loadSheetDataFromApi triggered from: ${eventSource}`);

        // Determine which input field to use based on the source
        const currentSheetIdInput = (eventSource === 'modal' && modalSheetIdInput) ? modalSheetIdInput : sheetIdInput;
        const sheetIdInputValue = currentSheetIdInput ? currentSheetIdInput.value.trim() : null;

        if (!sheetIdInputValue) {
            alert('Please enter a Google Sheet ID or URL.');
            return;
        }

        // Clear previous table data/state (important when loading a new sheet)
        clearTableDataAndState(); // Use renamed import

        // Show loading indicator
        if (tableContainer) tableContainer.style.display = 'block'; // Make sure container is visible for indicator
        showLoadingIndicator('Loading table data...');


        let sheetId = sheetIdInputValue;
        try {
            const urlMatch = sheetIdInputValue.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
            if (urlMatch && urlMatch[1]) {
                sheetId = urlMatch[1];
            }
        } catch (e) {
            console.warn("Could not parse Sheet ID from input, assuming input is the ID itself.", e);
        }
        console.log("Using Sheet ID:", sheetId);


        let tableData = null; // Initialize tableData to null
        let csvError = null;
        let processingError = null;
        let apiAttempted = false;

        try { // <<<< OUTER TRY BLOCK STARTS HERE

            if (currentAccessToken) {
                // --- Logged In: Attempt API Fetch Directly ---
                console.log("User is logged in. Attempting API fetch directly.");
                apiAttempted = true;
                const range = 'Sheet1!A1:Z';
                const apiUrl = `${SHEETS_API_BASE}/${sheetId}/values/${encodeURIComponent(range)}`;
                console.log("Fetching private sheet via API:", apiUrl);

                const response = await fetch(apiUrl, {
                    headers: { 'Authorization': `Bearer ${currentAccessToken}` }
                });
                console.log("API Fetch Response Status:", response.status);

                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) {
                        console.error('Authorization error fetching sheet data via API.');
                        alert('Could not load sheet via API. Please ensure you have access and try signing in again.');
                        // Don't logout automatically here, let user decide
                    } else {
                        console.error(`Google Sheets API Error: ${response.status} ${response.statusText}`);
                    }
                    throw new Error(`API request failed (Status: ${response.status})`);
                }

                const data = await response.json();

                if (!data || !data.values || data.values.length === 0) {
                    console.warn('No data found in sheet API response.');
                    tableData = []; // Set to empty array
                } else {
                    tableData = data.values;
                }

            } else {
                // --- Not Logged In: Attempt Public Sheet as CSV ---
                console.log("User not logged in. Attempting public CSV fetch.");
                try {
                    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;
                    console.log("Fetching CSV from URL:", csvUrl);
                    const response = await fetch(csvUrl);
                    console.log("CSV Fetch Response Status:", response.status);

                    if (!response.ok || response.headers.get('Content-Type')?.includes('text/html')) {
                        console.warn("CSV Fetch failed or returned HTML (likely private/invalid sheet). Status:", response.status);
                        throw new Error(`Failed to fetch as CSV (Status: ${response.status})`);
                    }

                    const csvText = await response.text();
                    if (!csvText) {
                        console.warn("CSV text is empty.");
                        tableData = [];
                    } else {
                        tableData = parseCsv(csvText);
                        console.log("Parsed CSV Data (first 5 rows):", tableData.slice(0, 5));
                    }

                } catch (err) {
                    console.warn("Attempt (CSV) failed:", err.message);
                    csvError = err;
                }
            }

            // --- Process and Display Data ---
            if (Array.isArray(tableData)) {
                if (tableData.length > 0) {
                    // SUCCESS: Data loaded
                    console.log("Data loaded successfully. Populating table.");
                    localStorage.setItem(lastSheetIdKey, sheetId); // Save successfully loaded ID
                    populateTable(tableData);
                    initializePostDataLoad();
                    showMainContentView(); // Switch to the main view
                    if (loadSheetModal) loadSheetModal.style.display = 'none'; // Close modal if open
                } else {
                    // SUCCESS but NO DATA
                    console.warn("Sheet loaded successfully but contained no data.");
                    showLoadingIndicator('Sheet contained no data.'); // Update indicator message
                    processingError = new Error('Sheet contained no data.'); // Treat as processing error for finally block
                    showMainContentView(); // Show main view but with the message
                    if (loadSheetModal) loadSheetModal.style.display = 'none'; // Close modal if open
                }

            } else if (csvError) {
                // CSV failed and user wasn't logged in
                console.error("CSV failed and user not logged in.");
                alert('Could not load sheet as public CSV. It might be private. Please sign in if you have access.');
                processingError = csvError;
                showLoadingIndicator(`Failed to load sheet: ${csvError.message}`);
                resetToInitialView(); // Go back to initial form on definite failure
            } else if (apiAttempted) {
                // API was attempted but failed (tableData is null)
                console.error("API attempt failed.");
                processingError = new Error("API request failed."); // Set a generic error if needed
                showLoadingIndicator('Failed to load sheet via API.');
                resetToInitialView(); // Go back to initial form on definite failure
            } else {
                // Unknown state
                console.error("Unknown state after loading attempts.");
                processingError = new Error("Unknown loading error");
                showLoadingIndicator('An unknown error occurred while loading the sheet.');
                resetToInitialView(); // Go back to initial form
            }

        } catch (err) { // <<<< OUTER CATCH BLOCK
            console.error('Overall error fetching or processing sheet data:', err);
            processingError = err;
            showLoadingIndicator(`Error loading sheet: ${err.message || 'Unknown error'}`);
            resetToInitialView(); // Go back to initial form on any outer catch error

        } finally { // <<<< OUTER FINALLY BLOCK
            const loadingIndicatorElement = document.getElementById('table-loading-indicator');
            if (loadingIndicatorElement && !processingError) {
                if (Array.isArray(tableData) && tableData.length > 0) {
                    hideLoadingIndicator();
                }
            } else if (loadingIndicatorElement && loadingIndicatorElement.textContent === 'Loading table data...') {
                hideLoadingIndicator();
            }
            // Ensure table container is hidden if we reset to initial view and there was an error
            if (processingError && tableContainer && initialLoadForm && initialLoadForm.style.display !== 'none') {
                if (tableContainer) tableContainer.style.display = 'none';
            }
        }
    } // <<< Closing brace for loadSheetDataFromApi function

    // --- Hamburger Menu Toggle ---
    function attachHamburgerListener() {
        if (hamburgerBtn && navMenu) {
            hamburgerBtn.addEventListener('click', () => {
                navMenu.classList.toggle('active');
            });
        }
    }

    // --- Close Menus on Outside Click ---
    document.addEventListener('click', (e) => {
        // Close hamburger menu
        if (navMenu && hamburgerBtn && navMenu.classList.contains('active') && window.innerWidth <= 768 && !navMenu.contains(e.target) && !hamburgerBtn.contains(e.target)) {
            navMenu.classList.remove('active');
        }
        // Note: Settings menu close logic is now in tableOperations.js setupTableEventListeners
    });

    // --- Initial Load & Event Listeners ---

    // Assign Auth/Load button listeners for INITIAL form
    if (loginBtn) loginBtn.onclick = redirectToGoogleLogin;
    if (logoutBtn) logoutBtn.onclick = clearTokenAndLogout;
    if (loadSheetButton) loadSheetButton.onclick = () => loadSheetDataFromApi('initial');

    // Assign Auth/Load button listeners for MODAL form
    if (modalLoginButton) modalLoginButton.onclick = redirectToGoogleLogin;
    if (modalLogoutButton) modalLogoutButton.onclick = clearTokenAndLogout;
    if (modalLoadSheetButton) modalLoadSheetButton.onclick = () => loadSheetDataFromApi('modal');


    // Setup listeners from the table operations module
    setupTableEventListeners();

    // Setup hamburger listener
    attachHamburgerListener();

    // --- Modal Event Listeners (Opening/Closing) ---
    if (openLoadModalBtn && loadSheetModal) {
        openLoadModalBtn.addEventListener('click', () => {
            // Pre-fill modal input with current value from initial form if available
            if (sheetIdInput && modalSheetIdInput) {
                // Get the *current* value from the initial form's input
                const initialInput = document.getElementById('initial-load-form')?.querySelector('#sheet-id-input');
                if (initialInput) modalSheetIdInput.value = initialInput.value;
            }
            // Ensure modal auth state matches current state
            updateUI(!!currentAccessToken);
            loadSheetModal.style.display = 'block';
        });
    }

    if (closeLoadModalBtn && loadSheetModal) {
        closeLoadModalBtn.addEventListener('click', () => {
            loadSheetModal.style.display = 'none';
        });
    }

    // Close modal if clicking outside of it
    if (loadSheetModal) {
        window.addEventListener('click', (event) => {
            if (event.target == loadSheetModal) {
                loadSheetModal.style.display = 'none';
            }
        });
    }

    // --- Initial Page Load Logic ---
    window.addEventListener('load', () => {
        let tokenFromStorage = localStorage.getItem('google_access_token');
        let tokenFromUrl = getAccessTokenFromUrl();
        const lastSheetId = localStorage.getItem(lastSheetIdKey); // Check for last loaded sheet

        if (tokenFromUrl) {
            console.log('Access Token found in URL');
            currentAccessToken = tokenFromUrl;
            localStorage.setItem('google_access_token', tokenFromUrl);
            // Clean URL
            try {
                history.replaceState(null, '', window.location.pathname + window.location.search);
            } catch (e) {
                window.location.hash = '';
            }
            // Fetch user info first
            fetchUserInfo(currentAccessToken).then(() => {
                // THEN attempt auto-load if possible
                if (lastSheetId && sheetIdInput) {
                    console.log("Attempting auto-load after URL token auth:", lastSheetId);
                    sheetIdInput.value = lastSheetId; // Pre-fill input in initial form
                    loadSheetDataFromApi('initial'); // Trigger load
                } else {
                    resetToInitialView(); // Show initial form if no last sheet
                    updateUI(true); // Ensure auth buttons are correct
                }
            });

        } else if (tokenFromStorage) {
            console.log('Access Token found in localStorage');
            currentAccessToken = tokenFromStorage;
            // Fetch user info first
            fetchUserInfo(currentAccessToken).then(() => {
                // THEN attempt auto-load if possible
                if (lastSheetId && sheetIdInput) {
                    console.log("Attempting auto-load from storage token:", lastSheetId);
                    sheetIdInput.value = lastSheetId; // Pre-fill input in initial form
                    loadSheetDataFromApi('initial'); // Trigger load
                } else {
                    resetToInitialView(); // Show initial form if no last sheet
                    updateUI(true); // Ensure auth buttons are correct
                }
            });

        } else {
            // No token found anywhere
            console.log('No access token found.');
            resetToInitialView(); // Ensure initial view is shown
            updateUI(false); // Set auth buttons to logged-out state
        }
    });

}); // End DOMContentLoaded
