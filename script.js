document.addEventListener('DOMContentLoaded', function() {
    const table = document.getElementById('data-table');
    const rows = Array.from(table.getElementsByTagName('tr')).slice(1);
    const clearFiltersBtn = document.getElementById('clear-filters');
    
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
        // Clear existing secondary filters
        secondaryFilters.innerHTML = '<h3>Secondary Filters</h3>';
        activeFilters.secondary.clear();
        
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

    // Column toggle functionality
    const toggleCategory = document.getElementById('toggle-category');
    const toggleSubcategory = document.getElementById('toggle-subcategory');
    
    function toggleColumn(columnIndex, checkbox) {
        const table = document.getElementById('data-table');
        const headers = table.getElementsByTagName('th');
        const rows = table.getElementsByTagName('tr');
        
        // Toggle header visibility
        headers[columnIndex].classList.toggle('hide-column', !checkbox.checked);
        
        // Toggle cells visibility
        for (let i = 0; i < rows.length; i++) {
            const cells = rows[i].getElementsByTagName('td');
            if (cells.length > 0) {
                cells[columnIndex].classList.toggle('hide-column', !checkbox.checked);
            }
        }
    }
    
    // Add event listeners for toggle switches
    toggleCategory.addEventListener('change', (e) => toggleColumn(2, e.target));
    toggleSubcategory.addEventListener('change', (e) => toggleColumn(3, e.target));
});