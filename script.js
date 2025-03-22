document.addEventListener('DOMContentLoaded', function() {
    const table = document.getElementById('data-table');
    const rows = Array.from(table.getElementsByTagName('tr')).slice(1);
    
    // Store all category-subcategory relationships
    const categoryMap = new Map();
    rows.forEach(row => {
        const category = row.cells[2].textContent;
        const subcategory = row.cells[3].textContent;
        
        if (!categoryMap.has(category)) {
            categoryMap.set(category, new Set());
        }
        categoryMap.get(category).add(subcategory);
    });
    
    // Create primary filter buttons
    const primaryFilters = document.getElementById('primary-filters');
    const secondaryFilters = document.getElementById('secondary-filters');
    
    // Create primary filter buttons
    Array.from(categoryMap.keys()).forEach(category => {
        const button = createFilterButton(category, 'primary');
        primaryFilters.appendChild(button);
    });
    
    // Track active filters
    const activeFilters = {
        primary: new Set(),
        secondary: new Set()
    };
    
    function createFilterButton(text, filterType) {
        const button = document.createElement('button');
        button.textContent = text;
        button.className = 'filter-btn';
        
        button.addEventListener('click', () => {
            if (filterType === 'primary') {
                handlePrimaryFilter(button, text);
            } else {
                handleSecondaryFilter(button, text);
            }
        });
        
        return button;
    }
    
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
                const button = createFilterButton(subcategory, 'secondary');
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
            const button = createFilterButton(subcategory, 'secondary');
            secondaryFilters.appendChild(button);
        });
    }
    
    function applyFilters() {
        rows.forEach(row => {
            const category = row.cells[2].textContent;
            const subcategory = row.cells[3].textContent;
            
            const showPrimary = activeFilters.primary.size === 0 || 
                              activeFilters.primary.has(category);
            const showSecondary = activeFilters.secondary.size === 0 || 
                                 activeFilters.secondary.has(subcategory);
            
            row.style.display = showPrimary && showSecondary ? '' : 'none';
        });
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