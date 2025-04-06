document.addEventListener('DOMContentLoaded', function () {
    const table = document.getElementById('data-table');
    const rows = Array.from(table.getElementsByTagName('tr')).slice(1);
    const clearFiltersBtn = document.getElementById('clear-filters');
    const clearPrimaryBtn = document.getElementById('clear-primary-filters');
    const clearSecondaryBtn = document.getElementById('clear-secondary-filters');

    // Store all category-subcategory relationships and counts
    const categoryMap = new Map();
    const categoryCounts = new Map();
    const subcategoryCounts = new Map();

    rows.forEach(row => {
        const category = row.cells[2].textContent;
        const subcategory = row.cells[3].textContent;

        // Update category counts
        categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
        subcategoryCounts.set(subcategory, (subcategoryCounts.get(subcategory) || 0) + 1);

        if (!categoryMap.has(category)) {
            categoryMap.set(category, new Set());
        }
        categoryMap.get(category).add(subcategory);
    });

    // Create primary filter buttons
    const primaryFilters = document.getElementById('primary-filters');
    const secondaryFilters = document.getElementById('secondary-filters');

    // Create primary filter buttons with counts
    Array.from(categoryMap.keys()).forEach(category => {
        const button = createFilterButton(category, 'primary', categoryCounts.get(category));
        primaryFilters.appendChild(button);
    });

    // Track active filters
    const activeFilters = {
        primary: new Set(),
        secondary: new Set()
    };

    function createFilterButton(text, filterType, count) {
        const button = document.createElement('button');
        button.className = 'filter-btn';

        // Create text span and count span
        const textSpan = document.createElement('span');
        textSpan.textContent = text;

        const countSpan = document.createElement('span');
        countSpan.className = 'count';
        countSpan.textContent = ` (${count})`;

        button.appendChild(textSpan);
        button.appendChild(countSpan);

        button.addEventListener('click', () => {
            if (filterType === 'primary') {
                handlePrimaryFilter(button, text);
            } else {
                handleSecondaryFilter(button, text);
            }
        });

        return button;
    }

    // Clear all filters functionality
    clearFiltersBtn.addEventListener('click', () => {
        // Remove active class from all filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Clear active filters
        activeFilters.primary.clear();
        activeFilters.secondary.clear();

        // Update secondary filters and table
        updateSecondaryFilters();
        applyFilters();
    });

    // Clear primary filters functionality
    clearPrimaryBtn.addEventListener('click', () => {
        // Remove active class from primary filter buttons
        primaryFilters.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        // Clear active primary filters
        activeFilters.primary.clear();
        // Update secondary filters and table
        updateSecondaryFilters();
        applyFilters();
    });

    // Clear secondary filters functionality
    clearSecondaryBtn.addEventListener('click', () => {
        // Remove active class from secondary filter buttons
        secondaryFilters.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        // Clear active secondary filters
        activeFilters.secondary.clear();
        // Apply filters to update table
        applyFilters();
    });


    function handlePrimaryFilter(button, category) {
        // Toggle active state
        button.classList.toggle('active');

        if (button.classList.contains('active')) {
            activeFilters.primary.add(category);
        } else {
            activeFilters.primary.delete(category);
        }

        // Update secondary filters
        updateSecondaryFilters();
        applyFilters();
    }

    function handleSecondaryFilter(button, subcategory) {
        button.classList.toggle('active');

        if (button.classList.contains('active')) {
            activeFilters.secondary.add(subcategory);
        } else {
            activeFilters.secondary.delete(subcategory);
        }

        applyFilters();
    }

    function updateSecondaryFilters() {
        // Clear existing secondary filters, keeping the header
        const header = secondaryFilters.querySelector('.filter-group-header');
        secondaryFilters.innerHTML = ''; // Clear all content
        if (header) {
            secondaryFilters.appendChild(header); // Re-add the header
        } else {
            // Fallback if header wasn't found (shouldn't happen with current HTML)
            secondaryFilters.innerHTML = `
                <div class="filter-group-header">
                    <h3>Secondary Filters</h3>
                    <button id="clear-secondary-filters" class="clear-group-btn" title="Clear Secondary Filters">Clear</button>
                </div>`;
        }
        activeFilters.secondary.clear(); // Ensure secondary active filters are cleared

        // If no primary filters are selected, show all possible secondary filters
        if (activeFilters.primary.size === 0) {
            const allSubcategories = new Set();
            categoryMap.forEach(subcategories => {
                subcategories.forEach(sub => allSubcategories.add(sub));
            });

            allSubcategories.forEach(subcategory => {
                const button = createFilterButton(subcategory, 'secondary', subcategoryCounts.get(subcategory));
                secondaryFilters.appendChild(button);
            });
            return;
        }

        // Show only secondary filters that match active primary filters
        const availableSubcategories = new Set();
        activeFilters.primary.forEach(category => {
            categoryMap.get(category).forEach(sub => availableSubcategories.add(sub));
        });

        availableSubcategories.forEach(subcategory => {
            const button = createFilterButton(subcategory, 'secondary', subcategoryCounts.get(subcategory));
            secondaryFilters.appendChild(button);
        });
    }

    // Search functionality
    const searchInput = document.getElementById('search-input');
    const searchColumn = document.getElementById('search-column');

    function performSearch() {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedColumn = searchColumn.value;

        rows.forEach(row => {
            let text;
            if (selectedColumn === 'all') {
                // Search all columns
                text = Array.from(row.cells)
                    .map(cell => cell.textContent)
                    .join(' ')
                    .toLowerCase();
            } else {
                // Search specific column
                text = row.cells[parseInt(selectedColumn)].textContent.toLowerCase();
            }

            const matchesSearch = text.includes(searchTerm);

            // Combine search with existing filters
            const category = row.cells[2].textContent;
            const subcategory = row.cells[3].textContent;

            const showPrimary = activeFilters.primary.size === 0 ||
                activeFilters.primary.has(category);
            const showSecondary = activeFilters.secondary.size === 0 ||
                activeFilters.secondary.has(subcategory);

            row.style.display = (matchesSearch && showPrimary && showSecondary) ? '' : 'none';
        });
    }

    // Add search event listeners
    searchInput.addEventListener('input', performSearch);
    searchColumn.addEventListener('change', performSearch);

    // Update the applyFilters function to also reapply search
    function applyFilters() {
        performSearch(); // This will handle both search and filters
    }

    // Initialize secondary filters
    updateSecondaryFilters();

    // --- Dynamic Column Visibility ---
    const columnTogglesContainer = document.querySelector('.settings-menu .column-toggles');
    const tableHeaders = Array.from(table.querySelectorAll('thead th'));

    function toggleColumn(columnIndex, isVisible) {
        const table = document.getElementById('data-table');
        const headers = table.querySelectorAll('thead th');
        const bodyRows = table.querySelectorAll('tbody tr');

        // Toggle header visibility
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
    }

    function createColumnToggles() {
        columnTogglesContainer.innerHTML = ''; // Clear existing (if any)
        tableHeaders.forEach((header, index) => {
            // Skip the last column (Settings)
            if (index === tableHeaders.length - 1) return;

            const columnName = header.textContent.trim();
            const toggleId = `toggle-col-${index}`;

            const label = document.createElement('label');
            label.className = 'switch';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = toggleId;
            input.checked = true; // Default to visible
            input.dataset.columnIndex = index; // Store index

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
    const settingsBtn = document.getElementById('settings-btn');
    const settingsMenu = document.getElementById('settings-menu');

    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsMenu.classList.toggle('active');
    });

    // Close settings menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!settingsMenu.contains(e.target) && !settingsBtn.contains(e.target)) {
            settingsMenu.classList.remove('active');
        }
    });

    // Update table cells to accommodate settings column
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

    // --- Filter Container Collapse/Expand ---
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


    // Initialize table structure
    updateTableStructure();
    // Initialize column toggles
    createColumnToggles();

    // Add double-click to copy functionality
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
}); // <-- Add missing closing }); for DOMContentLoaded
