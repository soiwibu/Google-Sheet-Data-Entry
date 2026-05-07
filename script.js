const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwUFME2gOQhcf25VhC74nAqRiLaLNN78LUDJv58M6mzfQo4xwb0rQqfxIYpQMZhCFSOPg/exec';
const TAX_RATE = 0.13; 

const toggleBtn = document.getElementById('toggle-mode-btn');
const pullRecentBtn = document.getElementById('pull-recent-btn');
const modeIndicator = document.getElementById('mode-indicator');
const form = document.getElementById('invoice-form');
const mainFields = document.getElementById('main-fields');
const searchSection = document.getElementById('search-section');
const resultsContainer = document.getElementById('results-container');
const resultsList = document.getElementById('results-list');
const submitBtn = document.getElementById('submit-btn');
const searchBtn = document.getElementById('search-btn');
const loadingOverlay = document.getElementById('loading-overlay');
 
const invInput = document.getElementById('invoice');
const custInput = document.getElementById('customer');
const descInput = document.getElementById('description'); 
const labInput = document.getElementById('labour');
const fabInput = document.getElementById('fabric');
const subTotInput = document.getElementById('subtotal');
const hstInput = document.getElementById('hst');
const totInput = document.getElementById('total');

const searchInvInput = document.getElementById('search-invoice');
const searchCustInput = document.getElementById('search-customer');

let isEditMode = false;
let selectedRowIndex = null;
let isActivelyEditingRecord = false; 

function formatCurrency(num) {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function stripCommas(str) {
    return parseFloat(String(str).replace(/,/g, '')) || 0;
}

// Enter Key Logic
[searchInvInput, searchCustInput].forEach(input => {
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchBtn.click();
        }
    });
});

[invInput, custInput, descInput, labInput, fabInput].forEach(input => {
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            if (!submitBtn.classList.contains('hidden')) {
                e.preventDefault();
                submitBtn.click();
            }
        }
    });
});

function calculateTotal() {
    const labour = parseFloat(labInput.value) || 0;
    const fabric = parseFloat(fabInput.value) || 0;
    const subTotal = labour + fabric;
    const hst = subTotal * TAX_RATE;
    const finalTotal = subTotal + hst;
    
    subTotInput.value = formatCurrency(subTotal);
    hstInput.value = formatCurrency(hst);
    totInput.value = formatCurrency(finalTotal);
}
labInput.addEventListener('input', calculateTotal);
fabInput.addEventListener('input', calculateTotal);

toggleBtn.addEventListener('click', () => {
    isEditMode = !isEditMode;
    resetUI();
    applyModeUI();
});

function applyModeUI() {
    if (isEditMode) {
        toggleBtn.textContent = 'Switch to Data Entry Mode';
        modeIndicator.textContent = 'Current Mode: Editing';
        modeIndicator.className = 'mode-edit';
        searchSection.classList.remove('hidden');
        mainFields.classList.add('hidden');
        submitBtn.classList.add('hidden');
        toggleRequired(false);
    } else {
        toggleBtn.textContent = 'Switch to Edit Mode';
        modeIndicator.textContent = 'Current Mode: Data Entry';
        modeIndicator.className = 'mode-entry';
        searchSection.classList.add('hidden');
        mainFields.classList.remove('hidden');
        submitBtn.classList.remove('hidden');
        submitBtn.textContent = 'Submit New Entry';
        submitBtn.className = '';
        toggleRequired(true);
    }
}

function toggleRequired(isRequired) {
    const fields = [invInput, custInput, descInput, labInput, fabInput];
    fields.forEach(f => isRequired ? f.setAttribute('required', '') : f.removeAttribute('required'));
}

function resetUI() {
    form.reset();
    selectedRowIndex = null;
    isActivelyEditingRecord = false;
    resultsContainer.classList.add('hidden');
    resultsList.innerHTML = '';
    searchInvInput.value = '';
    searchCustInput.value = '';
}

// Pull Recent Logic
pullRecentBtn.addEventListener('click', async () => {
    loadingOverlay.classList.remove('hidden');
    try {
        const res = await fetch(WEB_APP_URL, { method: 'GET', redirect: 'follow' });
        const data = await res.json();

        if (data && data.length > 0) {
            // Force into edit mode
            isEditMode = true;
            applyModeUI();
            // Populate with last item in array
            const lastRecord = data[data.length - 1];
            populateForm(lastRecord);
        } else {
            alert("No records found in database.");
        }
    } catch (err) {
        alert("Failed to pull recent entry.");
    } finally {
        loadingOverlay.classList.add('hidden');
    }
});

searchBtn.addEventListener('click', async () => {
    const invQuery = searchInvInput.value.trim();
    const custQuery = searchCustInput.value.trim().toLowerCase();
    
    if (!invQuery && !custQuery) {
        alert("Please enter a name or invoice number.");
        return;
    }

    loadingOverlay.classList.remove('hidden');
    resultsList.innerHTML = ''; 
    
    try {
        const res = await fetch(WEB_APP_URL, { method: 'GET', redirect: 'follow' });
        const data = await res.json();

        let matches = data.filter(row => {
            const matchInv = invQuery ? String(row['Invoice #']) === invQuery : true;
            const matchCust = custQuery ? String(row['Customer Name']).toLowerCase() === custQuery : true;
            return matchInv && matchCust;
        });

        if (matches.length === 0) {
            alert("No match found.");
        } else {
            resultsContainer.classList.remove('hidden');
            matches.forEach(record => {
                const item = document.createElement('div');
                item.className = 'result-item';
                item.innerHTML = `<span>#${record['Invoice #']}</span> <strong>${record['Customer Name']}</strong>`;
                item.onclick = () => populateForm(record);
                resultsList.appendChild(item);
            });
        }
    } catch (err) {
        alert("Search failed.");
    } finally {
        loadingOverlay.classList.add('hidden');
    }
});

function populateForm(record) {
    invInput.value = record['Invoice #'];
    custInput.value = record['Customer Name'];
    descInput.value = record['Description'] || ""; 
    labInput.value = parseFloat(record['Labour Cost']).toFixed(2);
    fabInput.value = parseFloat(record['Fabric Cost']).toFixed(2);
    
    calculateTotal(); 
    selectedRowIndex = record.rowIndex;
    isActivelyEditingRecord = true;

    searchSection.classList.add('hidden');
    mainFields.classList.remove('hidden');
    submitBtn.classList.remove('hidden');
    submitBtn.textContent = 'Update Existing Entry';
    submitBtn.className = 'btn-edit';
    toggleRequired(true);
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    loadingOverlay.classList.remove('hidden');

    const payload = {
        action: (isEditMode && isActivelyEditingRecord) ? "update" : "create",
        rowIndex: selectedRowIndex,
        invoice: invInput.value,
        customer: custInput.value,
        description: descInput.value,
        labour: parseFloat(labInput.value).toFixed(2),
        fabric: parseFloat(fabInput.value).toFixed(2),
        subTotal: stripCommas(subTotInput.value).toFixed(2),
        hst: stripCommas(hstInput.value).toFixed(2),
        total: stripCommas(totInput.value).toFixed(2)
    };

    try {
        await fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors', 
            body: JSON.stringify(payload)
        });
        
        alert("Success!");
        resetUI();
        if (isEditMode) {
            isEditMode = false; // Reset to entry mode after success
            applyModeUI();
        }
    } catch (error) {
        alert("Submission failed.");
    } finally {
        loadingOverlay.classList.add('hidden');
    }
});