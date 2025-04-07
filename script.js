document.addEventListener('DOMContentLoaded', function () {
    const table = document.getElementById('data-table');
    const tableHead = table.querySelector('thead');
    const tableBody = table.querySelector('tbody');
    const loadingIndicator = document.getElementById('table-loading-indicator');
    let rows = []; // Will be populated after fetch

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

    // --- Google Sheet Loading ---
    const sheetId = '1WcqNK4kQ-As2kcolqpwzJK-KtObRzGrScSNCum8Q5Ds';
    const sheetGid = '0'; // Or the specific GID if not the first sheet
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${sheetGid}`;

    async function loadSheetData() {
        loadingIndicator.style.display = 'block';
        table.style.display = 'none';
        try {
            const response = await fetch(sheetUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const csvData = await response.text();
            const parsedData = parseCSV(csvData);

            if (parsedData.length > 0) {
                populateTable(parsedData);
                // Initialize everything else *after* table is populated
                initializePostDataLoad();
            } else {
                console.error("No data parsed from CSV.");
                loadingIndicator.textContent = 'Failed to load or parse data.';
            }

        } catch (error) {
            console.error('Error loading or parsing sheet data:', error);
            loadingIndicator.textContent = 'Error loading data. Please check the console.';
        } finally {
            // Hide loading indicator only if table was successfully populated
            if (table.style.display !== 'none') {
                loadingIndicator.style.display = 'none';
            }
        }
    }

    function parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        return lines.map(line => {
            // Basic CSV parsing (doesn't handle quoted commas perfectly)
            return line.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')); // Trim quotes
        });
    }

    function populateTable(data) {
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

        // Populate Body Rows
        data.slice(1).forEach(rowData => {
            const row = tableBody.insertRow();
            rowData.forEach(cellData => {
                const cell = row.insertCell();
                cell.textContent = cellData;
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


    // --- Initialization Function (Called after data load) ---
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
        // Note: Filter button listeners are added during generation
    }

    // --- Filter Settings Management --- (Keep existing functions loadFilterSettings, saveFilterSettings)

    function loadFilterSettings() {
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
        const uniqueValues = new Map(); // Map<value, count>
        rows.forEach(row => {
            if (row.cells[columnIndex]) {
                const value = row.cells[columnIndex].textContent.trim();
                if (value) { // Ignore empty values
                    uniqueValues.set(value, (uniqueValues.get(value) || 0) + 1);
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
                if (activeFilters[columnIndex].size > 0) { // Only check if filters are active for this column
                    const cellValue = row.cells[columnIndex] ? row.cells[columnIndex].textContent.trim() : '';
                    if (!activeFilters[columnIndex].has(cellValue)) {
                        matchesAllActiveFilters = false;
                        break; // No need to check other filter groups for this row
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
        if (settingsBtn) {
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
    loadSheetData(); // Start the process by loading data

}); // <-- Correct closing }); for DOMContentLoaded
