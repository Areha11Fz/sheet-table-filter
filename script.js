import {
    populateTable,
    initializePostDataLoad,
    setupTableEventListeners,
    clearTableAndState,
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
    const loginBtn = document.getElementById('authorize_button');
    const logoutBtn = document.getElementById('signout_button');
    // Removed authStatusMessageSpan reference
    const userInfoDiv = document.getElementById('userInfo');
    const userNameSpan = document.getElementById('userName');
    const userEmailSpan = document.getElementById('userEmail');
    const userPictureImg = document.getElementById('userPicture');
    const sheetInputSection = document.getElementById('sheet-input-section');
    const sheetIdInput = document.getElementById('sheet-id-input');
    // Removed: const publicSheetCheckbox = document.getElementById('public-sheet-checkbox');
    const loadSheetButton = document.getElementById('load-sheet-button');
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const navMenu = document.getElementById('nav-menu');
    const loadSheetModal = document.getElementById('loadSheetModal'); // Added
    const openLoadModalBtn = document.getElementById('open-load-modal-btn'); // Added
    const closeLoadModalBtn = document.getElementById('closeLoadModalBtn'); // Added
    const loadStatusDisplay = document.getElementById('load-status-display'); // Added

    // --- State (Main Script) ---
    const lastSheetIdKey = 'lastLoadedSheetId'; // localStorage key for sheet ID

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
                    clearTokenAndLogout();
                } else {
                    throw new Error(`Google API Error: ${response.status} ${response.statusText}`);
                }
                return;
            }
            const data = await response.json();
            console.log('User Info:', data);
            displayUserInfo(data);
            updateUI(true);
        } catch (error) {
            console.error('Failed to fetch user info:', error);
            // Removed authStatusMessageSpan reference
            updateUI(false);
        }
    }

    function displayUserInfo(userInfo) {
        if (userNameSpan) userNameSpan.textContent = userInfo.name || 'N/A';
        if (userEmailSpan) userEmailSpan.textContent = userInfo.email || 'N/A';
        if (userPictureImg) {
            if (userInfo.picture) {
                userPictureImg.src = userInfo.picture;
                userPictureImg.style.display = 'inline-block';
            } else {
                userPictureImg.style.display = 'none';
            }
        }
        if (userInfoDiv) userInfoDiv.classList.remove('hidden');
    }

    function updateUI(isLoggedIn) {
        // Let CSS handle the display of loginBtn based on parent or class toggles if needed
        if (loginBtn) loginBtn.style.display = isLoggedIn ? 'none' : ''; // Only hide when logged in, otherwise let CSS rule
        if (logoutBtn) logoutBtn.style.display = isLoggedIn ? 'block' : 'none'; // Show logout when logged in
        // Sheet input is always visible now
        // Removed authStatusMessageSpan reference

        if (isLoggedIn) {
            // User info div visibility is handled by displayUserInfo
            // Attempt to auto-load last sheet if we just logged in
            const lastSheetId = localStorage.getItem(lastSheetIdKey);
            // Check if sheetIdInput exists before accessing value or calling loadSheetDataFromApi
            if (lastSheetId && sheetIdInput) {
                sheetIdInput.value = lastSheetId; // Pre-fill input
                console.log("Attempting to auto-load last sheet:", lastSheetId);
                // Use timeout to avoid potential race conditions with UI updates
                setTimeout(() => loadSheetDataFromApi(), 50);
            }
        } else {
            if (userInfoDiv) userInfoDiv.classList.add('hidden');
            if (userNameSpan) userNameSpan.textContent = '';
            if (userEmailSpan) userEmailSpan.textContent = '';
            if (userPictureImg) {
                userPictureImg.src = '';
                userPictureImg.style.display = 'none';
            }
        }

        // --- Update Status Display based on login state and loaded sheet ---
        const lastSheetId = localStorage.getItem(lastSheetIdKey);
        let statusText = 'Not loaded. Sign in or provide Sheet ID.'; // Default
        let buttonText = 'Load Sheet Data'; // Default

        if (isLoggedIn) {
            if (lastSheetId) {
                // Attempt to get a more user-friendly identifier if possible
                const currentSheetInputValue = sheetIdInput ? sheetIdInput.value : null;
                let loadedSheetIdentifier = `Last Loaded Sheet ID: ${lastSheetId}`; // Fallback
                if (currentSheetInputValue) {
                    const inputSheetId = currentSheetInputValue.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] || currentSheetInputValue;
                    if (inputSheetId === lastSheetId) {
                        loadedSheetIdentifier = currentSheetInputValue.includes('/') ? currentSheetInputValue : `Sheet ID: ${lastSheetId}`;
                    }
                }
                statusText = `Loaded: ${loadedSheetIdentifier}`;
                buttonText = 'Load Different Sheet';
            } else {
                statusText = 'Logged in. Select a sheet to load.';
                // buttonText remains 'Load Sheet Data'
            }
        }
        // else: statusText and buttonText remain the default 'Not loaded...'

        // if (loadStatusDisplay) loadStatusDisplay.textContent = statusText; // Removed status display update
        if (openLoadModalBtn) openLoadModalBtn.textContent = buttonText;
        // --- End Status Display Update ---
    }

    function clearTokenAndLogout() {
        currentAccessToken = null;
        localStorage.removeItem('google_access_token'); // Changed from sessionStorage
        console.log('Logging out.');
        if (window.location.hash.includes('access_token')) {
            try {
                history.replaceState(null, '', window.location.pathname + window.location.search);
            } catch (e) {
                window.location.hash = '';
            }
        }
        updateUI(false);
        clearTableAndState(); // Call imported function

        // --- Update UI after logout ---
        // if (loadStatusDisplay) loadStatusDisplay.textContent = 'Not loaded. Sign in or provide Sheet ID.'; // Removed status display update
        if (openLoadModalBtn) openLoadModalBtn.textContent = 'Load Sheet Data'; // Reset button text
        // Optional: Automatically open the modal on logout?
        // if (loadSheetModal) loadSheetModal.style.display = 'block';
        // --- End of UI update ---
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


    // --- Google Sheet Loading (Attempts Public CSV, then Private API if needed) ---

    async function loadSheetDataFromApi() {
        // Removed isPublic check - we'll try public first regardless
        const sheetIdInputValue = sheetIdInput ? sheetIdInput.value.trim() : null;

        // Removed login check here - we check later if CSV fails

        if (!sheetIdInputValue) {
            alert('Please enter a Google Sheet ID or URL.');
            return;
        }

        // Logic continues below, moved back inside function scope
        let sheetId = sheetIdInputValue;
        try {
            // Extract Sheet ID from URL if provided
            const urlMatch = sheetIdInputValue.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
            if (urlMatch && urlMatch[1]) {
                sheetId = urlMatch[1];
            }
        } catch (e) {
            console.warn("Could not parse Sheet ID from input, assuming input is the ID itself.", e);
        }
        console.log("Using Sheet ID:", sheetId);

        showLoadingIndicator('Loading table data...');
        clearTableAndState();

        let tableData;
        let csvError = null;
        let processingError = null; // To store any error for the final message

        try { // <<<< OUTER TRY BLOCK STARTS HERE

            // --- Attempt 1: Fetch Public Sheet as CSV ---
            try {
                console.log(`Attempting to fetch public sheet ${sheetId} as CSV`);
                const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;
                console.log("Fetching CSV from URL:", csvUrl);
                const response = await fetch(csvUrl);
                // Removed duplicate line above
                console.log("CSV Fetch Response Status:", response.status);

                if (!response.ok || response.headers.get('Content-Type')?.includes('text/html')) {
                    // If not OK, or if Google returns an HTML login page (common for private sheets accessed publicly)
                    console.warn("CSV Fetch failed or returned HTML (likely private/invalid sheet). Status:", response.status);
                    throw new Error(`Failed to fetch as CSV (Status: ${response.status})`); // Let outer catch handle this
                }

                const csvText = await response.text();
                console.log("Raw CSV Text (first 500 chars):", csvText.substring(0, 500));
                if (!csvText) {
                    showLoadingIndicator('No data found in the public sheet CSV.');
                    console.warn("CSV text is empty.");
                    return; // Exit if CSV is empty
                }
                tableData = parseCsv(csvText);
                // Removed duplicate block above
                // Removed duplicate return; statement here
                console.log("Parsed CSV Data (first 5 rows):", tableData.slice(0, 5));
                // REMOVED incorrect return; statement that was here.

            } catch (err) { // This catch is for the inner CSV try block
                console.warn("Attempt 1 (CSV) failed:", err.message); // Log warning, not error yet
                csvError = err; // Store the error
            }

            // --- Attempt 2: Fetch Private Sheet via API (if CSV failed) ---
            if (csvError) {
                console.log("CSV attempt failed. Checking login status for API attempt.");
                if (currentAccessToken) {
                    console.log("User is logged in. Attempting API fetch.");
                    // No inner try-catch here, let the outer one handle API errors
                    const range = 'Sheet1!A1:Z'; // Adjust range as needed
                    const apiUrl = `${SHEETS_API_BASE}/${sheetId}/values/${encodeURIComponent(range)}`;
                    console.log("Fetching private sheet via API:", apiUrl);

                    const response = await fetch(apiUrl, {
                        headers: { 'Authorization': `Bearer ${currentAccessToken}` }
                    });
                    // Removed duplicate line above
                    console.log("API Fetch Response Status:", response.status);

                    if (!response.ok) {
                        // Handle specific API errors
                        if (response.status === 401 || response.status === 403) {
                            console.error('Authorization error fetching sheet data via API.');
                            alert('Could not load sheet via API. Please ensure you have access and try signing in again.');
                            clearTokenAndLogout(); // Log out if token is bad
                        } else {
                            console.error(`Google Sheets API Error: ${response.status} ${response.statusText}`);
                        }
                        // Throw a generic error to be caught by the outer catch
                        throw new Error(`API request failed (Status: ${response.status})`);
                    }

                    const data = await response.json();

                    if (!data || !data.values || data.values.length === 0) {
                        console.error('No data found in sheet API response.');
                        showLoadingIndicator('No data found in the specified sheet or range (API).');
                        // No data via API, but not necessarily an error to stop everything
                        tableData = []; // Set to empty array
                    } else {
                        tableData = data.values; // Overwrite tableData with API result
                        csvError = null; // Clear CSV error since API succeeded
                    }

                } else {
                    // CSV failed and user is NOT logged in
                    console.log("User is not logged in. Cannot attempt API fetch.");
                    // Don't alert here, let the processing logic decide based on csvError
                    // We just know we can't try the API.
                }
            }

            // --- Process and Display Data ---
            if (tableData && tableData.length > 0) {
                // This means either CSV succeeded, or CSV failed but API succeeded
                console.log("Data loaded successfully. Populating table.");
                localStorage.setItem(lastSheetIdKey, sheetId);
                populateTable(tableData);
                initializePostDataLoad();

                // --- Update UI after successful load ---
                if (loadSheetModal) loadSheetModal.style.display = 'none'; // Close modal
                if (loadStatusDisplay) {
                    // Use the original input value for display if it was a URL, otherwise use the derived sheetId
                    const displayIdentifier = sheetIdInputValue.includes('/') ? sheetIdInputValue : `Sheet ID: ${sheetId}`;
                    loadStatusDisplay.textContent = `Loaded: ${displayIdentifier}`; // Update status
                }
                if (openLoadModalBtn) openLoadModalBtn.textContent = 'Load Different Sheet'; // Change button text
                // --- End of UI update ---

            } else if (!csvError && tableData && tableData.length === 0) {
                // CSV or API succeeded but returned no data
                console.warn("Sheet loaded successfully but contained no data.");
                showLoadingIndicator('Sheet contained no data.');
            } else if (csvError && !currentAccessToken) {
                // CSV failed and user wasn't logged in (API attempt skipped)
                console.error("CSV failed and user not logged in.");
                alert('Could not load sheet as public CSV. It might be private. Please sign in if you have access.');
                processingError = csvError; // Store error for finally block message if needed
            } else if (csvError) {
                // CSV failed, user was logged in, but API must have also failed (or returned no data and tableData is empty)
                console.error("CSV failed, and API attempt also failed or returned no data.");
                // Use the original CSV error for the message unless API provided a more specific one (handled by throw above)
                processingError = csvError;
                showLoadingIndicator(`Failed to load sheet. Error: ${csvError.message}`);
            } else {
                // Should not happen, but catchall
                console.error("Unknown state after loading attempts.");
                processingError = new Error("Unknown loading error");
                showLoadingIndicator('An unknown error occurred while loading the sheet.');
            }

        } catch (err) { // <<<< OUTER CATCH BLOCK
            console.error('Overall error fetching or processing sheet data:', err);
            processingError = err; // Store the error
            showLoadingIndicator(`Error loading sheet: ${err.message || 'Unknown error'}`);
        } finally { // <<<< OUTER FINALLY BLOCK
            // Hide indicator regardless of success or failure, if it's still showing
            const loadingIndicatorElement = document.getElementById('table-loading-indicator');
            if (loadingIndicatorElement && loadingIndicatorElement.style.display !== 'none') {
                hideLoadingIndicator();
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

    // Assign Auth/Load button listeners
    if (loginBtn) loginBtn.onclick = redirectToGoogleLogin;
    if (logoutBtn) logoutBtn.onclick = clearTokenAndLogout;
    if (loadSheetButton) loadSheetButton.onclick = loadSheetDataFromApi;

    // Setup listeners from the table operations module
    setupTableEventListeners();

    // Setup hamburger listener
    attachHamburgerListener();

    // --- Modal Event Listeners ---
    if (openLoadModalBtn && loadSheetModal) {
        openLoadModalBtn.addEventListener('click', () => {
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
            // Check if the modal itself was clicked (the overlay), not its content
            if (event.target == loadSheetModal) {
                loadSheetModal.style.display = 'none';
            }
        });
    }

    // Check for access token on page load
    window.addEventListener('load', () => {
        let accessToken = localStorage.getItem('google_access_token'); // Changed from sessionStorage

        if (accessToken) {
            console.log('Access Token found in localStorage'); // Changed log message
            currentAccessToken = accessToken;
            fetchUserInfo(currentAccessToken);
            // Auto-load handled within updateUI
        } else {
            accessToken = getAccessTokenFromUrl();
            if (accessToken) {
                console.log('Access Token found in URL');
                currentAccessToken = accessToken;
                localStorage.setItem('google_access_token', accessToken); // Changed from sessionStorage
                try {
                    history.replaceState(null, '', window.location.pathname + window.location.search);
                } catch (e) {
                    window.location.hash = '';
                }
                fetchUserInfo(currentAccessToken);
                // Auto-load handled within updateUI
            } else {
                // No token found anywhere
                updateUI(false); // Explicitly call updateUI to set initial status/button text
                // Let CSS handle the display of loginBtn
                if (loginBtn) loginBtn.style.display = ''; // Ensure login button shows if no token, let CSS handle positioning
                if (logoutBtn) logoutBtn.style.display = 'none';
                // Removed authStatusMessageSpan reference
            }
        }
        // Initial UI update for status/button text is handled by calling updateUI(false) if no token,
        // or within fetchUserInfo -> updateUI(true) if token is found.
    });

});
