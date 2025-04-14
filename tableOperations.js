// --- Table DOM Elements & State ---
const table = document.getElementById('data-table');
const tableHead = table.querySelector('thead');
const tableBody = table.querySelector('tbody');
const loadingIndicator = document.getElementById('table-loading-indicator');
let rows = []; // Populated after data load
let tableHeaders = []; // Populated after data load

// --- Filter Elements & State ---
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
const filterSettingsKey = 'dynamicFilterColumns'; // localStorage key
let configuredFilterColumns = []; // Array of { index: number, name: string }
let activeFilters = {}; // { columnIndex: Set(['value1']) }

// --- Search Elements ---
const searchInput = document.getElementById('search-input');
const searchColumn = document.getElementById('search-column');

// --- Column Visibility Elements & State ---
const settingsMenu = document.getElementById('settings-menu');
const columnTogglesContainer = settingsMenu ? settingsMenu.querySelector('.column-toggles') : null;
const columnVisibilityKey = 'columnVisibilityState'; // localStorage key
let columnVisibilityState = {}; // { columnIndex: boolean }

// --- Filter Container Collapse/Expand Elements & State ---
const filterContainer = document.getElementById('filter-container');
const toggleFiltersBtn = document.getElementById('toggle-filters-btn');
const filterContainerHeader = document.querySelector('.filter-container-header');
const filterStateKey = 'filterContainerCollapsed';

// --- Image Modal Elements ---
const modal = document.getElementById("imageModal");
const modalImg = document.getElementById("modalImage");
const captionText = document.getElementById("modalCaption");
const modalCloseBtn = document.getElementById("modalCloseBtn");

// --- Helper Functions (Internal) ---

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
    if (dynamicFilterGroupsContainer) {
        dynamicFilterGroupsContainer.querySelectorAll(`.filter-group[data-column-index="${columnIndex}"] .filter-btn.active`).forEach(btn => {
            btn.classList.remove('active');
        });
    }
    applyFilters();
}

function clearAllFilters() {
    activeFilters = {}; // Clear all active filters
    // Deactivate all filter buttons visually
    if (dynamicFilterGroupsContainer) {
        dynamicFilterGroupsContainer.querySelectorAll('.filter-btn.active').forEach(btn => {
            btn.classList.remove('active');
        });
    }
    applyFilters(); // Apply to show all rows
    // Update counts based on the cleared state (all rows visible)
    updateFilterButtons(rows);
}

function updateFilterButtons(visibleRows) {
    if (!dynamicFilterGroupsContainer) return;
    // Iterate through each configured filter group
    dynamicFilterGroupsContainer.querySelectorAll('.filter-group').forEach(group => {
        const columnIndex = parseInt(group.dataset.columnIndex);
        if (isNaN(columnIndex)) return; // Skip if column index is invalid

        // Calculate counts based *only* on visible rows for this column
        const visibleValueCounts = new Map();
        visibleRows.forEach(row => {
            // Ensure the row is actually visible
            if (row.style.display !== 'none' && row.cells[columnIndex]) {
                const cellContent = row.cells[columnIndex].textContent.trim();
                if (cellContent) {
                    const values = cellContent.split(',').map(v => v.trim()).filter(v => v);
                    values.forEach(value => {
                        visibleValueCounts.set(value, (visibleValueCounts.get(value) || 0) + 1);
                    });
                }
            }
        });

        // Update buttons within this group
        group.querySelectorAll('.filter-btn').forEach(button => {
            const value = button.dataset.value;
            const countSpan = button.querySelector('.count');
            const currentCount = visibleValueCounts.get(value) || 0;

            if (countSpan) {
                countSpan.textContent = ` (${currentCount})`;
            }

            // Add/remove 'unavailable' class based on count
            if (currentCount === 0) {
                button.classList.add('unavailable');
            } else {
                button.classList.remove('unavailable');
            }
        });
    });
}

function generateFilterGroup(columnIndex, columnName) {
    // Ensure 'rows' is populated before calculating filter counts
    if (rows.length === 0 && tableBody && tableBody.rows.length > 0) {
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

    if (uniqueValues.size === 0 || !dynamicFilterGroupsContainer) return; // Don't generate group if no values found or container missing

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

function loadFilterSettings() {
    // Ensure 'rows' is populated before calculating filter counts
    if (rows.length === 0 && tableBody && tableBody.rows.length > 0) {
        rows = Array.from(tableBody.getElementsByTagName('tr'));
    }
    const savedSettings = localStorage.getItem(filterSettingsKey);
    if (savedSettings) {
        try {
            configuredFilterColumns = JSON.parse(savedSettings);
            // Basic validation
            if (!Array.isArray(configuredFilterColumns) || !configuredFilterColumns.every(col => typeof col === 'object' && 'index' in col && 'name' in col)) {
                configuredFilterColumns = [];
                localStorage.removeItem(filterSettingsKey);
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
    configuredFilterColumns = selectedColumns;
    localStorage.setItem(filterSettingsKey, JSON.stringify(configuredFilterColumns));
    initializeFilterUI(); // Re-initialize UI after saving
    applyFilters(); // Re-apply filters with new settings
}

function initializeFilterUI() {
    if (!dynamicFilterGroupsContainer || !filterSetupPrompt || !filterColumnSelector || !filterSettingsBtn || !clearFiltersWrapper) return;

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
        filterSettingsBtn.style.display = 'inline-block';
        clearFiltersWrapper.style.display = 'block';
        dynamicFilterGroupsContainer.style.display = 'block';
        // Update counts based on initial data load (all rows visible)
        updateFilterButtons(rows);
    } else {
        // Show setup prompt
        filterSetupPrompt.style.display = 'block';
        filterColumnSelector.style.display = 'none';
        filterSettingsBtn.style.display = 'none';
        clearFiltersWrapper.style.display = 'none';
        dynamicFilterGroupsContainer.style.display = 'none';
    }
}

function showColumnSelector() {
    if (!filterSetupPrompt || !dynamicFilterGroupsContainer || !clearFiltersWrapper || !columnCheckboxesContainer || !table || !filterColumnSelector) return;

    filterSetupPrompt.style.display = 'none';
    dynamicFilterGroupsContainer.style.display = 'none';
    clearFiltersWrapper.style.display = 'none';

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
        label.appendChild(document.createTextNode(` ${columnName}`));
        columnCheckboxesContainer.appendChild(label);
    });

    filterColumnSelector.style.display = 'block';
}

function loadColumnVisibilityState() {
    const savedState = localStorage.getItem(columnVisibilityKey);
    if (savedState) {
        try {
            columnVisibilityState = JSON.parse(savedState);
        } catch (e) {
            console.error("Error parsing column visibility state:", e);
            columnVisibilityState = {};
        }
    } else {
        columnVisibilityState = {};
    }
}

function toggleColumn(columnIndex, isVisible) {
    if (!table || !tableHeaders) return;
    const bodyRows = table.querySelectorAll('tbody tr');

    // Toggle header visibility
    const headers = tableHeaders;
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
    if (!columnTogglesContainer || !tableHeaders) return;
    loadColumnVisibilityState();
    columnTogglesContainer.innerHTML = '';

    tableHeaders.forEach((header, index) => {
        // Skip the last column (Settings)
        if (!header || index === tableHeaders.length - 1) return;

        const columnName = header.textContent.trim();
        const toggleId = `toggle-col-${index}`;

        const label = document.createElement('label');
        label.className = 'switch';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = toggleId;
        const isVisible = columnVisibilityState.hasOwnProperty(index) ? columnVisibilityState[index] : true;
        input.checked = isVisible;
        input.dataset.columnIndex = index;

        // Apply initial visibility class
        if (!isVisible) {
            if (tableHeaders[index]) tableHeaders[index].classList.add('hide-column');
            if (table) {
                table.querySelectorAll(`tbody tr td:nth-child(${index + 1})`).forEach(cell => cell.classList.add('hide-column'));
            }
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

        input.addEventListener('change', (e) => {
            toggleColumn(index, e.target.checked);
        });
    });
}

function attachSettingsMenuListeners() {
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn && settingsMenu) {
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsMenu.classList.toggle('active');
        });
    }
}

function setFilterState(isCollapsed) {
    if (!filterContainer || !toggleFiltersBtn) return;
    const icon = toggleFiltersBtn.querySelector('i');
    if (isCollapsed) {
        filterContainer.classList.add('collapsed');
        if (icon) {
            icon.classList.remove('fa-chevron-up');
            icon.classList.add('fa-chevron-down');
        }
        localStorage.setItem(filterStateKey, 'true');
    } else {
        filterContainer.classList.remove('collapsed');
        if (icon) {
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-up');
        }
        localStorage.setItem(filterStateKey, 'false');
    }
}

function toggleFilterCollapse() {
    if (!filterContainer) return;
    const isCurrentlyCollapsed = filterContainer.classList.contains('collapsed');
    setFilterState(!isCurrentlyCollapsed);
}

function attachDoubleClickCopyListener() {
    if (!table) return;
    table.addEventListener('dblclick', (e) => {
        const cell = e.target.closest('td');
        if (!cell || cell.classList.contains('settings-column')) return;

        const text = cell.textContent;
        navigator.clipboard.writeText(text).then(() => {
            cell.classList.add('copied');
            setTimeout(() => {
                cell.classList.remove('copied');
            }, 1000);
        }).catch(err => {
            console.error('Failed to copy:', err);
        });
    });
}

function openImageModal(imageUrl) {
    if (modal && modalImg) {
        modal.style.display = "block";
        modalImg.src = imageUrl;
    }
}

function closeImageModal() {
    if (modal) {
        modal.style.display = "none";
        if (modalImg) modalImg.src = ""; // Clear src
    }
}

function attachWorkflowModalListeners() {
    if (!tableBody) return;
    tableBody.addEventListener('click', function (event) {
        if (event.target.classList.contains('workflow-link')) {
            const imageUrl = event.target.dataset.imageUrl;
            if (imageUrl) {
                openImageModal(imageUrl);
            }
        }
    });
}

// --- Exported Functions ---

export function populateTable(data) {
    if (!tableHead || !tableBody || !table) return;
    tableHead.innerHTML = '';
    tableBody.innerHTML = '';

    if (!data || data.length === 0) {
        table.style.display = 'none'; // Hide table if no data
        return;
    };

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

    // Update global variables AFTER populating
    rows = Array.from(tableBody.getElementsByTagName('tr'));
    tableHeaders = table ? Array.from(table.querySelectorAll('thead th')) : [];

    table.style.display = ''; // Show table now
}

export function initializePostDataLoad() {
    // Ensure 'rows' is populated before calculating filter counts
    if (rows.length === 0 && tableBody && tableBody.rows.length > 0) {
        rows = Array.from(tableBody.getElementsByTagName('tr'));
    }
    // Initialize Filter Settings & UI (Loads from localStorage)
    loadFilterSettings(); // Depends on 'rows'

    // Initialize column toggles (after table structure is potentially updated)
    if (tableHeaders.length > 0) {
        createColumnToggles(); // Depends on tableHeaders
    }

    // Initialize search column options
    updateSearchColumnOptions();

    // Apply initial filters/search if needed (optional)
    applyFilters();

    // Re-attach listeners that might have been lost if elements were regenerated
    attachSettingsMenuListeners();
    attachDoubleClickCopyListener();
    attachWorkflowModalListeners();
    // Note: Filter button listeners are added during generation
}

export function updateSearchColumnOptions() {
    if (!searchColumn || !tableHead) return;
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

export function applyFilters() {
    // Ensure 'rows' is populated
    if (rows.length === 0 && tableBody && tableBody.rows.length > 0) {
        rows = Array.from(tableBody.getElementsByTagName('tr'));
    }
    if (!searchInput || !searchColumn) return;

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

    // After filtering rows, update the filter button counts and availability
    const visibleRows = rows.filter(row => row.style.display !== 'none');
    updateFilterButtons(visibleRows);
}

export function setupTableEventListeners() {
    // Filter Setup/Settings UI Listeners
    if (setupFiltersBtn) setupFiltersBtn.addEventListener('click', showColumnSelector);
    if (filterSettingsBtn) filterSettingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showColumnSelector();
    });
    if (saveFilterSettingsBtn) saveFilterSettingsBtn.addEventListener('click', () => {
        const selectedColumns = [];
        if (columnCheckboxesContainer) {
            columnCheckboxesContainer.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
                selectedColumns.push({
                    index: parseInt(checkbox.value),
                    name: checkbox.dataset.columnName
                });
            });
        }
        selectedColumns.sort((a, b) => a.index - b.index);
        saveFilterSettings(selectedColumns);
    });
    if (cancelFilterSettingsBtn) cancelFilterSettingsBtn.addEventListener('click', () => {
        if (filterColumnSelector) filterColumnSelector.style.display = 'none';
        initializeFilterUI();
    });

    // Search Listeners
    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (searchColumn) searchColumn.addEventListener('change', applyFilters);

    // Clear All Filters Listener
    if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearAllFilters);

    // Filter Container Collapse/Expand Listeners
    if (toggleFiltersBtn) toggleFiltersBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFilterCollapse();
    });
    if (filterContainerHeader) filterContainerHeader.addEventListener('click', toggleFilterCollapse);

    // Initial Filter Container State
    const savedState = localStorage.getItem(filterStateKey);
    setFilterState(savedState === 'true');

    // Modal Close Listeners
    if (modalCloseBtn) modalCloseBtn.onclick = closeImageModal;
    if (modal) modal.onclick = function (event) {
        if (event.target === modal) {
            closeImageModal();
        }
    }

    // Close settings menu when clicking outside
    document.addEventListener('click', (e) => {
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsMenu && settingsBtn && !settingsMenu.contains(e.target) && !settingsBtn.contains(e.target)) {
            settingsMenu.classList.remove('active');
        }
    });
}

export function clearTableAndState() {
    if (tableHead) tableHead.innerHTML = '';
    if (tableBody) tableBody.innerHTML = '';
    if (table) table.style.display = 'none';
    rows = [];
    tableHeaders = [];
    activeFilters = {};
    configuredFilterColumns = [];
    // localStorage.removeItem(filterSettingsKey); // Optional: clear filter settings
    // columnVisibilityState = {}; // Optional: clear visibility state
    // localStorage.removeItem(columnVisibilityKey);
    initializeFilterUI(); // Reset filter UI
    if (loadingIndicator) loadingIndicator.textContent = ''; // Clear loading text
}

export function showLoadingIndicator(message = 'Loading...') {
    if (loadingIndicator) {
        loadingIndicator.textContent = message;
        loadingIndicator.style.display = 'block';
    }
    if (table) table.style.display = 'none';
}

export function hideLoadingIndicator() {
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    // Don't automatically show table here, populateTable should do that
}
