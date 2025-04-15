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
    const authStatusMessageSpan = document.getElementById('auth-status-message');
    const userInfoDiv = document.getElementById('userInfo');
    const userNameSpan = document.getElementById('userName');
    const userEmailSpan = document.getElementById('userEmail');
    const userPictureImg = document.getElementById('userPicture');
    const sheetInputSection = document.getElementById('sheet-input-section');
    const sheetIdInput = document.getElementById('sheet-id-input');
    const loadSheetButton = document.getElementById('load-sheet-button');
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const navMenu = document.getElementById('nav-menu');

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
            if (authStatusMessageSpan) authStatusMessageSpan.textContent = `Error fetching user info: ${error.message}`;
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
        if (loginBtn) loginBtn.style.display = isLoggedIn ? 'none' : 'block';
        if (logoutBtn) logoutBtn.style.display = isLoggedIn ? 'block' : 'none';
        if (sheetInputSection) sheetInputSection.style.display = isLoggedIn ? 'block' : 'none';
        if (authStatusMessageSpan) authStatusMessageSpan.textContent = isLoggedIn ? '' : 'Please sign in to load a sheet.';

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
    }

    // --- Google Sheet Loading (API Version using Fetch) ---

    async function loadSheetDataFromApi() {
        if (!currentAccessToken) {
            alert('You must be signed in to load a sheet.');
            return;
        }
        const sheetIdInputValue = sheetIdInput ? sheetIdInput.value.trim() : null;
        if (!sheetIdInputValue) {
            alert('Please enter a Google Sheet ID or URL.');
            return;
        }

        let sheetId = sheetIdInputValue;
        try {
            const urlMatch = sheetIdInputValue.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
            if (urlMatch && urlMatch[1]) {
                sheetId = urlMatch[1];
            }
        } catch (e) { /* Ignore */ }

        showLoadingIndicator('Loading table data...'); // Use imported function
        clearTableAndState(); // Clear previous table/state before loading new

        try {
            const range = 'Sheet1!A1:Z'; // Adjust as needed
            const apiUrl = `${SHEETS_API_BASE}/${sheetId}/values/${encodeURIComponent(range)}`;

            const response = await fetch(apiUrl, {
                headers: { 'Authorization': `Bearer ${currentAccessToken}` }
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    console.error('Authorization error fetching sheet data.');
                    alert('Could not load sheet. Please ensure you have access and try signing in again.');
                    clearTokenAndLogout();
                } else {
                    throw new Error(`Google Sheets API Error: ${response.status} ${response.statusText}`);
                }
                return;
            }

            const data = await response.json();

            if (!data || !data.values || data.values.length == 0) {
                console.error('No data found in sheet response.');
                showLoadingIndicator('No data found in the specified sheet or range.'); // Update indicator
                return;
            }

            const apiData = data.values;
            localStorage.setItem(lastSheetIdKey, sheetId);

            populateTable(apiData); // Use imported function
            initializePostDataLoad(); // Use imported function

        } catch (err) {
            console.error('Error fetching or processing sheet data:', err);
            showLoadingIndicator(`Error loading sheet: ${err.message || 'Unknown error'}`); // Update indicator
        } finally {
            // Hide indicator only if data was successfully processed or error occurred
            // populateTable shows the table, so we only need to hide indicator if it's still showing
            const loadingIndicatorElement = document.getElementById('table-loading-indicator');
            if (loadingIndicatorElement && loadingIndicatorElement.style.display !== 'none') {
                hideLoadingIndicator(); // Use imported function
            }
        }
    }

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
                updateUI(false); // Ensure initial state is logged out
            }
        }
    });

});
