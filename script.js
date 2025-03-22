document.addEventListener('DOMContentLoaded', function() {
    // Get unique values from Category (column 2) and Subcategory (column 3)
    const table = document.getElementById('data-table');
    const rows = Array.from(table.getElementsByTagName('tr')).slice(1); // Skip header row
    
    const categories = new Set();
    const subcategories = new Set();
    
    // Extract unique values
    rows.forEach(row => {
        const category = row.cells[2].textContent;
        const subcategory = row.cells[3].textContent;
        categories.add(category);
        subcategories.add(subcategory);
    });
    
    // Create primary filter buttons
    const primaryFilters = document.getElementById('primary-filters');
    categories.forEach(category => {
        const button = createFilterButton(category, 'primary');
        primaryFilters.appendChild(button);
    });
    
    // Create secondary filter buttons
    const secondaryFilters = document.getElementById('secondary-filters');
    subcategories.forEach(subcategory => {
        const button = createFilterButton(subcategory, 'secondary');
        secondaryFilters.appendChild(button);
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
            // Toggle active state
            button.classList.toggle('active');
            
            if (button.classList.contains('active')) {
                activeFilters[filterType].add(text);
            } else {
                activeFilters[filterType].delete(text);
            }
            
            // Apply filters
            applyFilters();
        });
        
        return button;
    }
    
    function applyFilters() {
        rows.forEach(row => {
            const category = row.cells[2].textContent;
            const subcategory = row.cells[3].textContent;
            
            const showPrimary = activeFilters.primary.size === 0 || 
                              activeFilters.primary.has(category);
            const showSecondary = activeFilters.secondary.size === 0 || 
                                 activeFilters.secondary.has(subcategory);
            
            // Show row only if it matches both filters (AND operation)
            row.style.display = showPrimary && showSecondary ? '' : 'none';
        });
    }
});