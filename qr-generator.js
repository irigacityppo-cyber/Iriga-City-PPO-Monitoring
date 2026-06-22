// ============================================
// IRIGA PPO - QR CODE & ID CARD GENERATOR
// SHARES LOGIN SESSION WITH INDEX.HTML
// ============================================
// 🔧 FIXED: Batch Import Print Layout Now Uses Full Paper Space

let currentQRData = null;
let currentQRCanvas = null;
let batchQRs = [];
let currentClientDataForCard = null;
let currentUser = null;

const AUTHORIZED_EMAILS = [
    'iace2318i@gmail.com',
    'wq.rodalyn@gmail.com',
    'beta22926@gmail.com', 
    'johnrogerargarin@gmail.com',
    'irigacityppo@gmail.com'
];

const TEMPLATE_HEADERS = [
    'PS ID',
    'Full Name',
    'Gender',
    'Date of Birth',
    'Offense Category',
    'Criminal Case Number',
    'Start Date',
    'End Date',
    'Address',
    'Supervising Officer',
    'Cluster'
];

// ============================================
// SAFE STRING HELPER
// ============================================

function toSafeString(value) {
    if (value === undefined || value === null) return '';
    return String(value);
}

function escapeHtml(str) { 
    const safeStr = toSafeString(str);
    if (!safeStr) return ''; 
    return safeStr.replace(/[&<>]/g, function(m){ 
        if(m==='&') return '&amp;'; 
        if(m==='<') return '&lt;'; 
        if(m==='>') return '&gt;'; 
        return m;
    }); 
}

// ============================================
// ENHANCED DATE NORMALIZATION FUNCTION
// ============================================

function normalizeExcelDate(value) {
    if (!value || value === '') return '';

    // Already a Date object (from Excel with cellDates: true)
    if (value instanceof Date && !isNaN(value.getTime())) {
        return value.toISOString().split('T')[0];
    }

    // Excel serial number (number)
    if (typeof value === 'number' && value > 40000 && value < 60000) {
        try {
            if (typeof XLSX !== 'undefined' && XLSX.SSF && XLSX.SSF.parse_date_code) {
                const d = XLSX.SSF.parse_date_code(value);
                if (d && d.y && d.m && d.d) {
                    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
                }
            }
            // Fallback to JavaScript date
            const d = new Date((value - 25569) * 86400 * 1000);
            if (!isNaN(d.getTime())) {
                return d.toISOString().split('T')[0];
            }
        } catch(e) {
            console.warn('Excel serial conversion failed:', e);
        }
    }

    // String dates - use comprehensive parser
    if (typeof value === 'string') {
        return parseDateString(value);
    }

    return '';
}

function parseDateString(dateStr) {
    if (!dateStr || dateStr === '') return '';
    const str = String(dateStr).trim();
    if (!str) return '';

    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    
    // ISO with time: 1990-05-15T00:00:00.000Z
    if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return str.slice(0, 10);

    const MONTHS = { 
        jan:1, feb:2, mar:3, apr:4, may:5, jun:6,
        jul:7, aug:8, sep:9, oct:10, nov:11, dec:12
    };

    function pad(n) { return String(n).padStart(2, '0'); }
    function fixYear(y) {
        y = parseInt(y, 10);
        if (y >= 1900) return y;
        return y < 30 ? 2000 + y : 1900 + y;
    }
    function ymd(y, m, d) { 
        const year = parseInt(y, 10);
        const month = parseInt(m, 10);
        const day = parseInt(d, 10);
        if (year < 1900 || year > 2100) return '';
        if (month < 1 || month > 12) return '';
        if (day < 1 || day > 31) return '';
        return `${year}-${pad(month)}-${pad(day)}`;
    }

    let m;

    // Remove ordinal suffixes (st, nd, rd, th)
    const cleanStr = str.replace(/(\d)(st|nd|rd|th)/gi, '$1');

    // Try JavaScript Date parse for complex formats
    const jsDate = new Date(cleanStr);
    if (!isNaN(jsDate.getTime()) && jsDate.getFullYear() > 1900 && jsDate.getFullYear() < 2100) {
        return ymd(jsDate.getFullYear(), jsDate.getMonth() + 1, jsDate.getDate());
    }

    // MM/DD/YYYY or M/D/YYYY
    m = cleanStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
        // If first number > 12, assume DD/MM/YYYY
        if (parseInt(m[1]) > 12 && parseInt(m[2]) <= 12) {
            return ymd(m[3], m[2], m[1]);
        }
        return ymd(m[3], m[1], m[2]);
    }

    // MM-DD-YYYY or M-D-YYYY
    m = cleanStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (m) return ymd(m[3], m[1], m[2]);

    // DD/MM/YYYY (explicit day-first when day > 12)
    m = cleanStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m && parseInt(m[1]) > 12 && parseInt(m[2]) <= 12) {
        return ymd(m[3], m[2], m[1]);
    }

    // MM.DD.YYYY or DD.MM.YYYY
    m = cleanStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) {
        if (parseInt(m[1]) > 12 && parseInt(m[2]) <= 12) {
            return ymd(m[3], m[2], m[1]); // DD.MM.YYYY
        }
        return ymd(m[3], m[1], m[2]); // MM.DD.YYYY
    }

    // YYYY/MM/DD or YYYY.MM.DD
    m = cleanStr.match(/^(\d{4})[\/\.](\d{1,2})[\/\.](\d{1,2})$/);
    if (m) return ymd(m[1], m[2], m[3]);

    // Short year: MM/DD/YY
    m = cleanStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (m && parseInt(m[1]) <= 12 && parseInt(m[2]) <= 31) {
        return ymd(fixYear(m[3]), m[1], m[2]);
    }

    // Short year: MM-DD-YY
    m = cleanStr.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/);
    if (m && parseInt(m[1]) <= 12 && parseInt(m[2]) <= 31) {
        return ymd(fixYear(m[3]), m[1], m[2]);
    }

    // DD-MMM-YY or DD-MMM-YYYY format (e.g., "15-Aug-2024")
    m = cleanStr.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
    if (m) {
        const mo = MONTHS[m[2].toLowerCase()];
        if (mo) return ymd(fixYear(m[3]), mo, m[1]);
    }

    // Named month formats
    m = cleanStr.match(/([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i);
    if (m) {
        const mo = MONTHS[m[1].toLowerCase().slice(0, 3)];
        if (mo) return ymd(m[3], mo, m[2]);
    }

    m = cleanStr.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9}),?\s+(\d{4})$/i);
    if (m) {
        const mo = MONTHS[m[2].toLowerCase().slice(0, 3)];
        if (mo) return ymd(m[3], mo, m[1]);
    }

    return '';
}

function formatExcelDate(value) {
    return normalizeExcelDate(value);
}

function formatDateToMMDDYY(date) {
    if (!date) return '';
    const isoDate = normalizeExcelDate(date);
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return '';
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${month}/${day}/${year}`;
}

function formatDisplayDate(value) {
    if (!value || value === 'N/A') return 'N/A';
    const isoDate = normalizeExcelDate(value);
    if (!isoDate) return value;
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return value;
    return formatDateToMMDDYY(isoDate);
}

function calculateAge(dateOfBirth) {
    if (!dateOfBirth || dateOfBirth === 'N/A') return '';
    const iso = normalizeExcelDate(dateOfBirth);
    if (!iso) return '';
    const dob = new Date(iso);
    if (isNaN(dob.getTime())) return '';
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
}

// ============================================
// DATE HELPER FUNCTIONS
// ============================================

window.addYears = function(years) {
    const startDate = document.getElementById('startDate').value;
    if (startDate) {
        const date = new Date(startDate);
        date.setFullYear(date.getFullYear() + years);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        document.getElementById('endDate').value = `${year}-${month}-${day}`;
    } else {
        alert('Please select a start date first');
    }
};

window.addMonths = function(months) {
    const startDate = document.getElementById('startDate').value;
    if (startDate) {
        const date = new Date(startDate);
        date.setMonth(date.getMonth() + months);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        document.getElementById('endDate').value = `${year}-${month}-${day}`;
    } else {
        alert('Please select a start date first');
    }
};

window.setEndOfYear = function() {
    const startDate = document.getElementById('startDate').value;
    if (startDate) {
        const date = new Date(startDate);
        const year = date.getFullYear();
        document.getElementById('endDate').value = `${year}-12-31`;
    } else {
        alert('Please select a start date first');
    }
};

window.clearDates = function() {
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
};

// ============================================
// SESSION CHECK - FIXED WITH TRY/CATCH
// ============================================

function checkSession() {
    try {
        const saved = localStorage.getItem('loggedInUser');
        if (!saved) {
            const sessionExpired = document.getElementById('sessionExpired');
            const mainContent = document.getElementById('mainContent');
            if (sessionExpired) sessionExpired.style.display = 'block';
            if (mainContent) mainContent.style.display = 'none';
            return false;
        }
        
        const user = JSON.parse(saved);
        if (!user || !user.email || !AUTHORIZED_EMAILS.includes(user.email)) {
            throw new Error("Invalid session");
        }
        
        currentUser = user;
        const sessionExpired = document.getElementById('sessionExpired');
        const mainContent = document.getElementById('mainContent');
        const userNameDisplay = document.getElementById('userNameDisplay');
        const userEmailDisplay = document.getElementById('userEmailDisplay');
        const userAvatar = document.getElementById('userAvatar');
        
        if (sessionExpired) sessionExpired.style.display = 'none';
        if (mainContent) mainContent.style.display = 'block';
        if (userNameDisplay) userNameDisplay.textContent = user.name || user.email;
        if (userEmailDisplay) userEmailDisplay.textContent = user.email;
        if (userAvatar && user.picture) userAvatar.src = user.picture;
        
        return true;
    } catch (e) {
        console.warn("Session corrupted:", e);
        localStorage.removeItem('loggedInUser');
        
        const sessionExpired = document.getElementById('sessionExpired');
        const mainContent = document.getElementById('mainContent');
        if (sessionExpired) sessionExpired.style.display = 'block';
        if (mainContent) mainContent.style.display = 'none';
        return false;
    }
}

function logout() {
    localStorage.removeItem('loggedInUser');
    currentUser = null;
    window.location.href = 'index.html';
}

// ============================================
// QR CODE GENERATION FUNCTIONS
// ============================================

async function generateQRCode(data, size = 300) {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        QRCode.toCanvas(canvas, data, { 
            width: size, 
            margin: 2, 
            color: { dark: '#000000', light: '#ffffff' } 
        }, function(error) {
            if (error) reject(error);
            else resolve(canvas);
        });
    });
}

function createSingleIDCardHTML(pusId, pusName, startDate, endDate, cluster, qrImageData) {
    const issueDate = new Date().toLocaleDateString();
    const displayName = toSafeString(pusName) || "N/A";
    const displayCluster = toSafeString(cluster) || "N/A";
    const displayStartDate = formatDisplayDate(startDate);
    const displayEndDate = formatDisplayDate(endDate);
    return `
        <div class="official-id-card" style="width:337px; height:212px; background:white; border-radius:12px; overflow:hidden; font-family:'Segoe UI', Arial, sans-serif; box-shadow:0 2px 5px rgba(0,0,0,0.1); position:relative; display:flex; flex-direction:column;">
            <div style="background:linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); color:white; padding:6px 0; text-align:center; flex-shrink:0;">
                <h3 style="font-size:10px; font-weight:600; letter-spacing:0.5px;">IRIGA CITY PAROLE AND PROBATION OFFICE</h3>
            </div>
            <div style="display:flex; padding:10px 12px; gap:12px; flex:1; align-items:center;">
                <div style="width:100px; text-align:center; flex-shrink:0;">
                    <img src="${qrImageData}" style="width:95px; height:95px; border:1px solid #ddd; border-radius:8px; background:white; padding:3px;" alt="QR Code">
                    <div style="font-size:6px; color:#666; margin-top:2px;">Scan for Attendance</div>
                </div>
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:bold; font-size:9px; color:#1e3c72; border-bottom:1px solid #ddd; margin-bottom:6px; padding-bottom:2px;">PAROLEE</div>
                    <div style="margin-bottom:5px;">
                        <div style="font-size:7px; font-weight:bold; color:#555;">NAME</div>
                        <div style="font-size:9px; font-weight:600; color:#2c3e50; line-height:1.2; word-wrap:break-word;">${escapeHtml(displayName)}</div>
                    </div>
                    <div style="margin-bottom:5px;">
                        <div style="font-size:7px; font-weight:bold; color:#555;">CLUSTER</div>
                        <div style="font-size:9px; font-weight:600; color:#2c3e50;">${escapeHtml(displayCluster)}</div>
                    </div>
                    <div>
                        <div style="font-size:7px; font-weight:bold; color:#555;">SUPERVISION PERIOD</div>
                        <div style="font-size:8px; color:#333;">${displayStartDate} to ${displayEndDate}</div>
                    </div>
                </div>
                <div style="width:75px; text-align:center; flex-shrink:0;">
                    <div style="width:68px; height:78px; border:1.5px solid #ccc; border-radius:8px; background:#f9f9f9; display:flex; align-items:center; justify-content:center; margin:0 auto;">
                        <div style="text-align:center; color:#aaa; font-size:10px;">📷<br><span style="font-size:6px;">Photo</span></div>
                    </div>
                    <div style="font-size:5px; color:#aaa; text-align:center; margin-top:1px;">(Paste/glue photo)</div>
                </div>
            </div>
            <div style="background:#f0f0f0; padding:5px 10px; display:flex; justify-content:space-between; font-size:6px; color:#666; border-top:1px solid #ddd; flex-shrink:0;">
                <span>Issued: ${issueDate}</span>
                <span>irigacityppo@gmail.com</span>
            </div>
        </div>
    `;
}

async function generateIDCardCanvas(pusId, pusName, startDate, endDate, cluster, qrImageData) {
    const container = document.getElementById('idCardContainer');
    if (!container) return null;
    
    const cardHTML = createSingleIDCardHTML(pusId, pusName, startDate, endDate, cluster, qrImageData);
    container.innerHTML = cardHTML;
    await new Promise(r => setTimeout(r, 100));
    const cardElement = container.querySelector('.official-id-card');
    if (!cardElement) return null;
    const canvas = await html2canvas(cardElement, { 
        scale: 3, 
        backgroundColor: '#ffffff', 
        logging: false, 
        useCORS: true 
    });
    container.innerHTML = '';
    return canvas;
}

async function downloadIDCard(pusId, pusName, startDate, endDate, cluster, qrImageData, filename) {
    const canvas = await generateIDCardCanvas(pusId, pusName, startDate, endDate, cluster, qrImageData);
    if (canvas) { 
        const link = document.createElement('a'); 
        link.download = filename; 
        link.href = canvas.toDataURL('image/png'); 
        link.click(); 
        return true; 
    }
    return false;
}

function showQRModal(qrCanvas, clientData) {
    const modal = document.getElementById('qrModal');
    const modalQrcode = document.getElementById('modalQrcode');
    const modalClientInfo = document.getElementById('modalClientInfo');
    
    if (!modal) return;
    
    document.body.style.overflow = 'hidden';
    if (modalQrcode) modalQrcode.innerHTML = '';
    
    const canvas = document.createElement('canvas');
    canvas.width = 180;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(qrCanvas, 0, 0, 180, 180);
    if (modalQrcode) modalQrcode.appendChild(canvas);
    
    const ageValue = clientData.dateOfBirth ? calculateAge(clientData.dateOfBirth) : '';
    const ageDisplay = ageValue ? `${ageValue} years` : 'N/A';
    const displayDOB = formatDisplayDate(clientData.dateOfBirth);
    const displayStartDate = formatDisplayDate(clientData.startDate);
    const displayEndDate = formatDisplayDate(clientData.endDate);
    
    if (modalClientInfo) {
        modalClientInfo.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px;">
                <div><strong>📋 PS ID:</strong></div>
                <div>${escapeHtml(clientData.pusId)}</div>
                <div><strong>👤 Full Name:</strong></div>
                <div>${escapeHtml(clientData.pusName)}</div>
                <div><strong>⚥ Gender:</strong></div>
                <div>${escapeHtml(clientData.gender)}</div>
                <div><strong>🎂 Date of Birth:</strong></div>
                <div>${escapeHtml(displayDOB)}</div>
                <div><strong>📊 Age:</strong></div>
                <div>${escapeHtml(ageDisplay)}</div>
                <div><strong>⚖️ Offense:</strong></div>
                <div>${escapeHtml(clientData.offenseCategory)}</div>
                <div><strong>⚖️ Case No.:</strong></div>
                <div>${escapeHtml(clientData.caseNumber || 'N/A')}</div>
                <div><strong>📅 Start Date:</strong></div>
                <div>${escapeHtml(displayStartDate)}</div>
                <div><strong>📅 End Date:</strong></div>
                <div>${escapeHtml(displayEndDate)}</div>
                <div><strong>🏠 Address:</strong></div>
                <div>${escapeHtml(clientData.address || 'N/A')}</div>
                <div><strong>👮 Officer:</strong></div>
                <div>${escapeHtml(clientData.supervisingOfficer || 'N/A')}</div>
                <div><strong>📍 Cluster:</strong></div>
                <div>${escapeHtml(clientData.cluster || 'N/A')}</div>
            </div>
        `;
    }
    
    modal.style.display = 'block';
    currentClientDataForCard = clientData;
    currentQRCanvas = qrCanvas;
}

function closeModal() {
    const modal = document.getElementById('qrModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

document.getElementById('qrForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();

    const btn = document.getElementById('generateQrBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = "Generating...";
    }

    try {
        const pusId = document.getElementById('pusId')?.value.trim() || '';
        const pusName = document.getElementById('pusName')?.value.trim() || '';
        let dateOfBirth = document.getElementById('dateOfBirth')?.value || '';

        if (!pusId || !pusName || !dateOfBirth) {
            alert('Please fill in PS ID, Full Name, and Date of Birth');
            return;
        }

        const startDateElem = document.getElementById('startDate');
        const endDateElem = document.getElementById('endDate');
        
        const formattedDOB = normalizeExcelDate(dateOfBirth);
        
        const pusData = { 
            pusId, 
            pusName, 
            gender: document.getElementById('gender')?.value || 'Female', 
            dateOfBirth: formattedDOB || dateOfBirth,
            offenseCategory: document.getElementById('offenseCategory')?.value || 'Drug Offense',
            caseNumber: document.getElementById('caseNumber')?.value || '',
            startDate: startDateElem ? startDateElem.value : '', 
            endDate: endDateElem ? endDateElem.value : '',
            address: document.getElementById('address')?.value || '',
            supervisingOfficer: document.getElementById('officer')?.value || '', 
            cluster: document.getElementById('cluster')?.value || '' 
        };

        currentQRData = JSON.stringify(pusData);

        const canvas = await generateQRCode(currentQRData, 300);
        currentQRCanvas = canvas;

        showQRModal(canvas, pusData);
        saveToLocalStorage(pusData);

    } catch (error) {
        console.error(error);
        alert("QR generation failed: " + error.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "🔲 Generate QR Code";
        }
    }
});

document.getElementById('modalDownloadQrBtn')?.addEventListener('click', function() {
    if (currentQRCanvas) {
        const pusId = document.getElementById('pusId')?.value || 'unknown';
        const pusName = (document.getElementById('pusName')?.value || 'unknown').replace(/[^a-z0-9]/gi, '_');
        const link = document.createElement('a');
        link.download = `QR_${pusId}_${pusName}.png`;
        link.href = currentQRCanvas.toDataURL('image/png');
        link.click();
    }
});

document.getElementById('modalDownloadCardBtn')?.addEventListener('click', async function() {
    if (!currentClientDataForCard) { alert('Generate QR first'); return; }
    if (!currentQRCanvas) return;
    
    const qrImageData = currentQRCanvas.toDataURL('image/png');
    const pusId = currentClientDataForCard.pusId;
    const pusName = currentClientDataForCard.pusName;
    const startDate = currentClientDataForCard.startDate;
    const endDate = currentClientDataForCard.endDate;
    const cluster = currentClientDataForCard.cluster;
    
    await downloadIDCard(pusId, pusName, startDate, endDate, cluster, qrImageData, `ID_Card_${pusId}_${pusName.replace(/[^a-z0-9]/gi, '_')}.png`);
});

document.getElementById('modalPrintBtn')?.addEventListener('click', function() {
    if (!currentClientDataForCard) { alert('Generate QR first'); return; }
    if (!currentQRCanvas) return;
    
    const qrImageData = currentQRCanvas.toDataURL('image/png');
    const pusId = currentClientDataForCard.pusId;
    const pusName = currentClientDataForCard.pusName;
    const startDate = currentClientDataForCard.startDate;
    const endDate = currentClientDataForCard.endDate;
    const cluster = currentClientDataForCard.cluster;
    
    printSingleCard(pusId, pusName, startDate, endDate, cluster, qrImageData);
});

document.getElementById('modalCloseBtn')?.addEventListener('click', closeModal);
document.querySelector('.modal-close')?.addEventListener('click', closeModal);

window.addEventListener('click', function(event) {
    const modal = document.getElementById('qrModal');
    if (event.target === modal) {
        closeModal();
        document.body.style.overflow = '';
    }
});

function printSingleCard(pusId, pusName, startDate, endDate, cluster, qrImageData) {
    const cardHTML = createSingleIDCardHTML(pusId, pusName, startDate, endDate, cluster, qrImageData);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(`<!DOCTYPE html><html><head><title>ID Card - ${pusName}</title><style>*{margin:0;padding:0;box-sizing:border-box;} body{background:white;display:flex;justify-content:center;align-items:center;min-height:100vh;} @media print{body{margin:0;padding:0;}}</style></head><body><div style="margin:20px;">${cardHTML}</div><script>setTimeout(()=>{window.print();window.close();},200);<\/script></body></html>`);
        printWindow.document.close();
    }
}

// ============================================
// BATCH IMPORT FUNCTIONS
// ============================================

document.getElementById('downloadTemplateBtn')?.addEventListener('click', function() {
    // Create template with actual Date objects for better Excel compatibility
    const templateData = [
        TEMPLATE_HEADERS,
        [
            'PS-2024-001',
            'Dela Cruz, Juan A.',
            'Male',
            new Date(1990, 4, 15),  // May 15, 1990 (month is 0-indexed in JS)
            'Drug Offense',
            'RTC-2024-00123',
            new Date(2023, 7, 15),  // Aug 15, 2023
            new Date(2026, 7, 15),  // Aug 15, 2026
            '123 Purok 1, Brgy. San Juan, Iriga City',
            'SSPO JANET B. PAVIA',
            'IRIGA'
        ],
        [
            'PS-2024-002',
            'Reyes, Maria S.',
            'Female',
            new Date(1982, 8, 20),  // Sep 20, 1982
            'Non-Drug Offense',
            'RTC-2024-00456',
            new Date(2023, 8, 1),   // Sep 1, 2023
            new Date(2026, 8, 1),   // Sep 1, 2026
            '456 Mabini St., Iriga City',
            'SSPO JANET B. PAVIA',
            'NABUA'
        ]
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const colWidths = templateData[0].map((_, colIndex) => {
        const maxLength = Math.max(
            ...templateData.map(row => {
                const val = row[colIndex];
                if (val instanceof Date) return 10;
                return val ? val.toString().length : 10;
            })
        );
        return { wch: Math.min(maxLength + 2, 30) };
    });
    ws['!cols'] = colWidths;

    const headerRange = XLSX.utils.decode_range(ws['!ref']);
    for (let C = headerRange.s.c; C <= headerRange.e.c; C++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
        if (!ws[cellAddress]) continue;
        ws[cellAddress].s = {
            font: { bold: true },
            fill: { fgColor: { rgb: "D9E1F2" } },
            alignment: { horizontal: "center" }
        };
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PUS_Template');
    XLSX.writeFile(wb, 'Iriga_PPO_QR_Template.xlsx');
});

async function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try { 
                const data = new Uint8Array(e.target.result); 
                const workbook = XLSX.read(data, { 
                    type: 'array', 
                    cellDates: true,
                    raw: true
                }); 
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]]; 
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
                console.log('Parsed Excel data:', jsonData);
                resolve(jsonData); 
            } catch (error) { 
                console.error('Excel parsing error:', error);
                reject(error); 
            }
        }; 
        reader.onerror = (error) => {
            console.error('FileReader error:', error);
            reject(error);
        }; 
        reader.readAsArrayBuffer(file);
    });
}

document.getElementById('importBtn')?.addEventListener('click', async function() {
    const fileInput = document.getElementById('excelFile');
    const file = fileInput?.files[0];
    const statusDiv = document.getElementById('importStatus'); 
    const progressBar = document.getElementById('progressBar'); 
    const progressFill = document.getElementById('progressFill');
    
    if (!file) { 
        if (statusDiv) {
            statusDiv.style.display = 'block'; 
            statusDiv.className = 'status-message status-error'; 
            statusDiv.textContent = 'Select an Excel file'; 
        }
        return; 
    }
    
    if (statusDiv) {
        statusDiv.style.display = 'block'; 
        statusDiv.className = 'status-message status-info'; 
        statusDiv.textContent = 'Reading Excel file...';
    }
    
    try {
        const data = await readExcelFile(file);
        
        if (!data || data.length === 0) {
            throw new Error('No data found in Excel file');
        }
        
        if (statusDiv) statusDiv.textContent = `Found ${data.length} records. Generating...`;
        if (progressBar) progressBar.style.display = 'block';
        batchQRs = [];
        
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            if (progressFill) progressFill.style.width = `${((i+1)/data.length)*100}%`;
            
            let dateOfBirth = row['Date of Birth'] || row['dateOfBirth'] || row['DOB'] || row['Birth Date'] || '';
            let startDate = row['Start Date'] || row['startDate'] || '';
            let endDate = row['End Date'] || row['endDate'] || '';
            
            console.log(`Row ${i} - Raw DOB:`, dateOfBirth);
            
            dateOfBirth = normalizeExcelDate(dateOfBirth);
            startDate = normalizeExcelDate(startDate);
            endDate = normalizeExcelDate(endDate);
            
            console.log(`Row ${i} - Normalized DOB: ${dateOfBirth}, Start: ${startDate}, End: ${endDate}`);
            
            if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
                console.warn(`Row ${i} - Invalid DOB format: ${dateOfBirth}`);
                dateOfBirth = '';
            }
            
            const pusData = {
                pusId: String(row['PS ID'] || row['pusId'] || `PS-${Date.now()}-${i}`),
                pusName: String(row['Full Name'] || row['pusName'] || row['NAME OF CLIENT'] || 'Unknown'),
                gender: String(row['Gender'] || row['gender'] || 'Female'),
                dateOfBirth: dateOfBirth,
                offenseCategory: String(row['Offense Category'] || row['offenseCategory'] || 'Drug Offense'),
                startDate: startDate,
                endDate: endDate,
                address: row['Address'] ? String(row['Address']).trim() : '',
                caseNumber: row['Criminal Case Number'] ? String(row['Criminal Case Number']).trim() : '',
                supervisingOfficer: String(row['Supervising Officer'] || row['supervisingOfficer'] || ''),
                cluster: String(row['Cluster'] || row['cluster'] || '')
            };
            
            console.log(`Row ${i} - Processed PUS: ${pusData.pusName}, DOB: ${pusData.dateOfBirth}`);
            
            const qrData = JSON.stringify(pusData);
            const canvas = await generateQRCode(qrData, 300);
            const qrImageData = canvas.toDataURL('image/png');
            batchQRs.push({ data: pusData, canvas, imageUrl: qrImageData });
            saveToLocalStorage(pusData);
        }
        
        if (progressBar) progressBar.style.display = 'none';
        if (statusDiv) {
            statusDiv.className = 'status-message status-success';
            statusDiv.innerHTML = `✅ Successfully generated ${batchQRs.length} QR codes!`;
        }
        displayBatchResults(batchQRs);
        
        if (typeof openBatchModal === 'function') {
            openBatchModal();
        }
    } catch (error) {
        console.error('Import error:', error);
        if (statusDiv) {
            statusDiv.className = 'status-message status-error'; 
            statusDiv.textContent = 'Error: ' + error.message; 
        }
        if (progressBar) progressBar.style.display = 'none';
        alert('Import failed: ' + error.message);
    }
});

function displayBatchResults(qrs) {
    const batchList = document.getElementById('batchListModal');
    if (!batchList) return;
    
    batchList.innerHTML = qrs.map((qr, index) => {
        const ageDisplay = qr.data.dateOfBirth ? calculateAge(qr.data.dateOfBirth) : '';
        const ageText = ageDisplay ? ` | Age: ${ageDisplay}` : '';
        const displayDOB = formatDisplayDate(qr.data.dateOfBirth);
        return `
            <div class="batch-item-modal">
                <div class="batch-info-modal">
                    <div class="batch-name-modal">${escapeHtml(qr.data.pusName)}</div>
                    <div class="batch-details-modal">ID: ${escapeHtml(qr.data.pusId)} | DOB: ${escapeHtml(displayDOB)}${ageText}</div>
                </div>
                <div class="batch-actions-modal">
                    <button class="btn-small" onclick="downloadSingleBatch(${index})">📥 QR</button>
                    <button class="btn-small" onclick="downloadSingleBatchCard(${index})">🆔 Card</button>
                    <button class="btn-small" onclick="printSingleBatchCard(${index})">🖨️ Print</button>
                </div>
            </div>
        `;
    }).join('');
}

window.downloadSingleBatch = function(index) { 
    const qr = batchQRs[index]; 
    if(qr && qr.imageUrl){ 
        const link = document.createElement('a'); 
        link.download = `QR_${qr.data.pusId}_${qr.data.pusName.replace(/[^a-z0-9]/gi, '_')}.png`; 
        link.href = qr.imageUrl;
        link.click(); 
    } 
};

window.downloadSingleBatchCard = async function(index) { 
    const qr = batchQRs[index]; 
    if(qr) await downloadIDCard(qr.data.pusId, qr.data.pusName, qr.data.startDate, qr.data.endDate, qr.data.cluster, qr.imageUrl, `ID_Card_${qr.data.pusId}_${qr.data.pusName.replace(/[^a-z0-9]/gi, '_')}.png`); 
};

window.printSingleBatchCard = function(index) { 
    const qr = batchQRs[index]; 
    if(qr) printSingleCard(qr.data.pusId, qr.data.pusName, qr.data.startDate, qr.data.endDate, qr.data.cluster, qr.imageUrl); 
};

document.getElementById('massDownloadQrsBtnModal')?.addEventListener('click', async function() {
    if(batchQRs.length === 0) { 
        alert('No QR codes to download'); 
        return; 
    }
    const zip = new JSZip();
    for(let qr of batchQRs) { 
        const base64Data = qr.imageUrl.split(',')[1];
        const safeName = qr.data.pusName.replace(/[^a-z0-9]/gi, '_'); 
        zip.file(`QR_${qr.data.pusId}_${safeName}.png`, base64Data, { base64: true }); 
    }
    const blob = await zip.generateAsync({ type: 'blob' }); 
    const link = document.createElement('a'); 
    link.href = URL.createObjectURL(blob); 
    link.download = `All_QR_Codes_${Date.now()}.zip`;
    document.body.appendChild(link);
    link.click(); 
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
});

document.getElementById('massDownloadCardsBtnModal')?.addEventListener('click', async function() {
    if (batchQRs.length === 0) { 
        alert('No batch QR codes'); 
        return; 
    }
    const massProgress = document.getElementById('massProgressModal'); 
    const massProgressFill = document.getElementById('massProgressFillModal'); 
    const massStatus = document.getElementById('massStatusModal');
    if (massProgress) massProgress.style.display = 'block'; 
    if (massStatus) massStatus.textContent = `Generating ${batchQRs.length} ID cards...`; 
    if (massProgressFill) massProgressFill.style.width = '0%';
    const zip = new JSZip();
    for (let i = 0; i < batchQRs.length; i++) {
        const qr = batchQRs[i];
        if (massProgressFill) massProgressFill.style.width = `${((i+1)/batchQRs.length)*100}%`; 
        if (massStatus) massStatus.textContent = `Processing ${i+1}/${batchQRs.length}: ${qr.data.pusName}`;
        const canvas = await generateIDCardCanvas(qr.data.pusId, qr.data.pusName, qr.data.startDate, qr.data.endDate, qr.data.cluster, qr.imageUrl);
        if(canvas){ 
            const base64Data = canvas.toDataURL('image/png').split(',')[1]; 
            zip.file(`ID_Card_${qr.data.pusId}_${qr.data.pusName.replace(/[^a-z0-9]/gi, '_')}.png`, base64Data, { base64: true }); 
        }
        await new Promise(r => setTimeout(r, 50));
    }
    const blob = await zip.generateAsync({ type: 'blob' }); 
    const link = document.createElement('a'); 
    link.href = URL.createObjectURL(blob); 
    link.download = `All_ID_Cards_${Date.now()}.zip`;
    document.body.appendChild(link);
    link.click(); 
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
    if (massStatus) massStatus.textContent = '✅ All cards ready!'; 
    if (massProgress) setTimeout(()=>{ massProgress.style.display='none'; }, 2000);
});

// ============================================
// 🔧 FIXED BATCH PRINT CARDS - FULL PAPER SPACE
// ============================================
document.getElementById('massPrintCardsBtnModal')?.addEventListener('click', function() {
    if (batchQRs.length === 0) { alert('No batch QR codes to print'); return; }
    
    const cardsPerPage = 6;
    let pagesHtml = '';
    for (let i = 0; i < batchQRs.length; i += cardsPerPage) {
        const pageCards = batchQRs.slice(i, i + cardsPerPage);
        let gridItems = '';
        for (let j = 0; j < pageCards.length; j++) {
            const qr = pageCards[j];
            gridItems += `<div class="print-card-item"><div>${createSingleIDCardHTML(qr.data.pusId, qr.data.pusName, qr.data.startDate, qr.data.endDate, qr.data.cluster, qr.imageUrl)}</div></div>`;
        }
        pagesHtml += `<div class="print-page"><div class="print-id-grid">${gridItems}</div></div>`;
    }
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(`<!DOCTYPE html><html><head><title>Iriga PPO ID Cards</title><style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html { height: 100%; }
            body { 
                background: white; 
                margin: 0; 
                font-family: 'Segoe UI', Arial, sans-serif; 
                padding: 0.25in; 
            }
            .print-id-grid { 
                display: grid; 
                grid-template-columns: repeat(2, 1fr); 
                gap: 12px 16px; 
                width: 100%; 
                height: 100%;
            }
            .print-card-item { 
                width: 100%; 
                height: auto; 
                page-break-inside: avoid; 
                break-inside: avoid;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .print-card-item > div {
                width: 100%;
            }
            .print-page { 
                page-break-after: always; 
                break-after: page; 
                margin-bottom: 0; 
                padding: 0;
                min-height: 11in;
                display: flex;
                flex-direction: column;
            }
            .print-page:last-child { 
                page-break-after: auto; 
                break-after: auto; 
            }
            @media print { 
                html { 
                    margin: 0; 
                    padding: 0; 
                }
                body { 
                    padding: 0.2in; 
                    margin: 0; 
                }
                .print-page { 
                    min-height: 11in;
                    margin: 0; 
                    padding: 0; 
                }
                .print-id-grid { 
                    gap: 10px 14px;
                }
                @page { 
                    size: portrait; 
                    margin: 0.4in; 
                }
            }
        </style></head><body>${pagesHtml}</body></html>`);
        printWindow.document.close();
        setTimeout(() => { printWindow.print(); }, 300);
    }
});

document.getElementById('clearBatchBtnModal')?.addEventListener('click', function() { 
    if(confirm('Clear all batch generated QR codes?')){ 
        batchQRs = []; 
        const batchList = document.getElementById('batchListModal');
        if (batchList) batchList.innerHTML = '';
        if (typeof closeBatchModal === 'function') {
            closeBatchModal();
        }
    } 
});

// ============================================
// LOCAL STORAGE FUNCTIONS
// ============================================

function saveToLocalStorage(pusData) {
    try {
        let records = JSON.parse(localStorage.getItem('iriga_ppo_pus') || '[]');
        const idx = records.findIndex(r => r.pusId === pusData.pusId);
        if (idx >= 0) records[idx] = pusData; else records.push(pusData);
        localStorage.setItem('iriga_ppo_pus', JSON.stringify(records));
        displayPUSList(records);
    } catch (e) {
        console.warn('Storage error, resetting:', e);
        localStorage.setItem('iriga_ppo_pus', JSON.stringify([pusData]));
    }
}

function displayPUSList(records) {
    const container = document.getElementById('pusList');
    if(!container) return;
    
    if(!records.length){ 
        container.innerHTML = '<p>No records yet. Generate QR codes to add persons.</p>'; 
        return; 
    }
    container.innerHTML = records.map(record => {
        const ageDisplay = record.dateOfBirth ? calculateAge(record.dateOfBirth) : '';
        const ageText = ageDisplay ? ` | Age: ${ageDisplay}` : '';
        const displayDOB = formatDisplayDate(record.dateOfBirth);
        return `<div class="batch-item" onclick="loadPUS('${record.pusId}')"><div class="batch-info"><div class="batch-name">${escapeHtml(record.pusName)} <span style="font-size:9px; background:#2a5298; color:white; padding:2px 6px; border-radius:10px;">${escapeHtml(record.pusId)}</span></div><div class="batch-details">${record.offenseCategory} | DOB: ${escapeHtml(displayDOB)}${ageText} | ${record.cluster||'No Cluster'}</div></div><button class="btn-small" onclick="event.stopPropagation(); regenerateQR('${record.pusId}')">🔄 Regenerate</button></div>`;
    }).join('');
}

window.loadPUS = function(pusId) { 
    const records = JSON.parse(localStorage.getItem('iriga_ppo_pus')||'[]'); 
    const record = records.find(r=>r.pusId===pusId); 
    if(record){ 
        const pusIdElem = document.getElementById('pusId');
        const pusNameElem = document.getElementById('pusName');
        const genderElem = document.getElementById('gender');
        const dateOfBirthElem = document.getElementById('dateOfBirth');
        const offenseElem = document.getElementById('offenseCategory');
        const caseNumElem = document.getElementById('caseNumber');
        const startDateElem = document.getElementById('startDate');
        const endDateElem = document.getElementById('endDate');
        const addressElem = document.getElementById('address');
        const officerElem = document.getElementById('officer');
        const clusterElem = document.getElementById('cluster');
        
        if (pusIdElem) pusIdElem.value = record.pusId; 
        if (pusNameElem) pusNameElem.value = record.pusName; 
        if (genderElem) genderElem.value = record.gender; 
        if (dateOfBirthElem) dateOfBirthElem.value = record.dateOfBirth || '';
        if (offenseElem) offenseElem.value = record.offenseCategory; 
        if (caseNumElem) caseNumElem.value = record.caseNumber || '';
        if (startDateElem) startDateElem.value = record.startDate || ''; 
        if (endDateElem) endDateElem.value = record.endDate || ''; 
        if (addressElem) addressElem.value = record.address || '';
        if (officerElem) officerElem.value = record.supervisingOfficer || ''; 
        if (clusterElem) clusterElem.value = record.cluster || ''; 
        
        const qrForm = document.getElementById('qrForm');
        if (qrForm) qrForm.dispatchEvent(new Event('submit')); 
    } 
};

window.regenerateQR = function(pusId) { loadPUS(pusId); };

window.exportAllPUS = function() { 
    const records = JSON.parse(localStorage.getItem('iriga_ppo_pus')||'[]'); 
    if(!records.length){ alert('No records'); return; } 
    const blob = new Blob([JSON.stringify(records,null,2)], {type:'application/json'}); 
    const link = document.createElement('a'); 
    link.download = `iriga_ppo_pus_${new Date().toISOString().split('T')[0]}.json`; 
    link.href = URL.createObjectURL(blob);
    document.body.appendChild(link);
    link.click(); 
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
};

window.clearAllPUS = function() { 
    if(confirm('Delete ALL records?')){ 
        localStorage.removeItem('iriga_ppo_pus'); 
        displayPUSList([]); 
        clearForm(); 
    } 
};

function clearForm() { 
    const qrForm = document.getElementById('qrForm');
    if (qrForm) qrForm.reset(); 
    currentQRData=null; 
    currentClientDataForCard=null; 
}

document.getElementById('templateHelpLink')?.addEventListener('click',(e)=>{ 
    e.preventDefault(); 
    alert("📋 Required headers: PS ID, Full Name, Gender, Date of Birth, Offense Category, Criminal Case Number, Start Date, End Date, Address, Supervising Officer, Cluster\n\n📅 The Excel template uses actual date fields. You can enter dates in any format (MM/DD/YYYY, DD/MM/YYYY, Month DD, YYYY, etc.) and they will be automatically converted!"); 
});

document.getElementById('logoutBtn')?.addEventListener('click', function() {
    logout();
});

// ============================================
// BATCH MODAL FUNCTIONS
// ============================================

window.openBatchModal = function() {
    const batchModal = document.getElementById('batchModal');
    if (batchModal) {
        batchModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
};

window.closeBatchModal = function() {
    const batchModal = document.getElementById('batchModal');
    if (batchModal) {
        batchModal.style.display = 'none';
        document.body.style.overflow = '';
    }
};

// ============================================
// INITIALIZATION
// ============================================

checkSession();

const saved = JSON.parse(localStorage.getItem('iriga_ppo_pus')||'[]');
displayPUSList(saved);