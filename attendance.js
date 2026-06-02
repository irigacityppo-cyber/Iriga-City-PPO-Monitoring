// ============================================
// IRIGA PPO - ATTENDANCE SYSTEM
// ============================================

const GOOGLE_CLIENT_ID = '615931175551-cnd4ocg43ktu56jpmhdm9ulmbn5tedq1.apps.googleusercontent.com';
const APPS_SCRIPT_URL_DEFAULT = 'https://script.google.com/macros/s/AKfycby1pL6I5pA0lxnWg6674cBNmpiyW5oh1IWl2nwdAfJDKqm3wmL3BxzNX4aG1C_pKJzD/exec';

const AUTHORIZED_EMAILS = [
    'iace2318i@gmail.com',
    'wq.rodalyn@gmail.com',
    'beta22926@gmail.com',
    'johnrogerargarin@gmail.com',
    'irigacityppo@gmail.com'
];

// ============================================
// UNIVERSAL DATE NORMALIZER
// Handles: Date objects, Excel serials, any
// string format (MM/DD/YY, DD-Mon-YYYY, ISO, etc.)
// ============================================

function normalizeAnyDate(value) {
    if (!value || value === 'N/A' || value === '') return '';

    // Already a Date object
    if (value instanceof Date && !isNaN(value.getTime())) {
        return value.toISOString().split('T')[0];
    }

    // Excel serial number
    if (typeof value === 'number' && value > 40000 && value < 60000) {
        const d = new Date((value - 25569) * 86400 * 1000);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }

    const str = String(value).trim();
    if (!str) return '';

    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

    // ISO with time
    if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return str.slice(0, 10);

    // MM/DD/YY (your QR codes store this format)
    const mmddyy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (mmddyy) {
        const yr = parseInt(mmddyy[3]) < 30 ? 2000 + parseInt(mmddyy[3]) : 1900 + parseInt(mmddyy[3]);
        return `${yr}-${mmddyy[1].padStart(2, '0')}-${mmddyy[2].padStart(2, '0')}`;
    }

    // MM/DD/YYYY
    const mmddyyyy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mmddyyyy) {
        if (parseInt(mmddyyyy[1]) > 12) // day-first: DD/MM/YYYY
            return `${mmddyyyy[3]}-${mmddyyyy[2].padStart(2, '0')}-${mmddyyyy[1].padStart(2, '0')}`;
        return `${mmddyyyy[3]}-${mmddyyyy[1].padStart(2, '0')}-${mmddyyyy[2].padStart(2, '0')}`;
    }

    // DD-Mon-YYYY or DD-Mon-YY e.g. 15-Aug-2024
    const MONTHS = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
    const ddmonyyyy = str.match(/^(\d{1,2})[-\/\s]([A-Za-z]{3,9})[-\/\s,\s]*(\d{2,4})$/);
    if (ddmonyyyy) {
        const mo = MONTHS[ddmonyyyy[2].toLowerCase().slice(0, 3)];
        if (mo) {
            let yr = parseInt(ddmonyyyy[3]);
            if (yr < 100) yr = yr < 30 ? 2000 + yr : 1900 + yr;
            return `${yr}-${String(mo).padStart(2, '0')}-${ddmonyyyy[1].padStart(2, '0')}`;
        }
    }

    // Month DD, YYYY e.g. "August 15, 1990"
    const monddyyyy = str.match(/([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/);
    if (monddyyyy) {
        const mo = MONTHS[monddyyyy[1].toLowerCase().slice(0, 3)];
        if (mo) return `${monddyyyy[3]}-${String(mo).padStart(2, '0')}-${monddyyyy[2].padStart(2, '0')}`;
    }

    // Last resort: native Date parse (handles many locale formats)
    const d = new Date(str);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1900 && d.getFullYear() < 2100) {
        return d.toISOString().split('T')[0];
    }

    return str; // return as-is if nothing worked
}

// ============================================
// UNIVERSAL AGE CALCULATOR
// ============================================

function calculateAgeFromDOB(dateOfBirth) {
    if (!dateOfBirth || dateOfBirth === 'N/A') return 'N/A';
    const iso = normalizeAnyDate(dateOfBirth);
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'N/A';
    const dob = new Date(iso);
    if (isNaN(dob.getTime())) return 'N/A';
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
}

// ============================================
// UNIVERSAL DATE DISPLAY FORMATTER
// ============================================

function formatReadableDate(dateStr) {
    if (!dateStr || dateStr === 'N/A') return 'N/A';
    const iso = normalizeAnyDate(dateStr);
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return dateStr;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ============================================
// UNIVERSAL QR PARSER
// Handles your JSON format AND any other format
// ============================================

function parseQRData(rawText) {
    const text = rawText.trim();

    // ── 1. Your PPO JSON format (primary) ──────────────────────────
    try {
        const json = JSON.parse(text);
        if (json && typeof json === 'object') {
            // Normalize every date field regardless of how it was stored
            const dateFields = ['dateOfBirth', 'startDate', 'endDate', 'dob', 'birthDate'];
            dateFields.forEach(f => {
                if (json[f]) json[f] = normalizeAnyDate(json[f]);
            });
            return {
                source: 'json',
                pusId:             json.pusId    || json.clientId   || json.id          || '',
                pusName:           json.pusName  || json.clientName || json.name        || json.fullName || '',
                gender:            json.gender   || '',
                dateOfBirth:       json.dateOfBirth || json.dob     || json.birthDate   || '',
                offenseCategory:   json.offenseCategory || json.offense || '',
                caseNumber:        json.caseNumber || json.caseNo  || json.case        || '',
                startDate:         json.startDate || '',
                endDate:           json.endDate   || '',
                address:           json.address   || '',
                supervisingOfficer: json.supervisingOfficer || json.officer || '',
                cluster:           json.cluster   || '',
                raw:               text
            };
        }
    } catch (e) { /* not JSON, continue */ }

    // ── 2. URL with query params  e.g. https://ppo.gov/?id=PS-001&name=Juan ──
    if (/^https?:\/\//i.test(text)) {
        try {
            const url = new URL(text);
            const p = url.searchParams;
            return {
                source: 'url',
                pusId:           p.get('id')     || p.get('pusId')    || p.get('clientId') || '',
                pusName:         p.get('name')   || p.get('pusName')  || p.get('fullName') || '',
                gender:          p.get('gender') || '',
                dateOfBirth:     normalizeAnyDate(p.get('dob') || p.get('dateOfBirth') || ''),
                offenseCategory: p.get('offense') || p.get('offenseCategory') || '',
                caseNumber:      p.get('case')   || p.get('caseNumber') || '',
                startDate:       normalizeAnyDate(p.get('start') || p.get('startDate') || ''),
                endDate:         normalizeAnyDate(p.get('end')   || p.get('endDate')   || ''),
                address:         p.get('address') || '',
                supervisingOfficer: p.get('officer') || '',
                cluster:         p.get('cluster') || '',
                raw:             text
            };
        } catch (e) { /* bad URL */ }
    }

    // ── 3. vCard format  (BEGIN:VCARD ... END:VCARD) ──
    if (/BEGIN:VCARD/i.test(text)) {
        const get = (tag) => {
            const m = text.match(new RegExp(tag + '[^:]*:([^\\r\\n]+)', 'i'));
            return m ? m[1].trim() : '';
        };
        const fn  = get('FN')  || get('N').replace(/;/g, ' ').trim();
        const bday = get('BDAY');
        return {
            source: 'vcard',
            pusId:           get('UID') || get('NOTE'),
            pusName:         fn,
            gender:          '',
            dateOfBirth:     normalizeAnyDate(bday),
            offenseCategory: '',
            caseNumber:      '',
            startDate:       '',
            endDate:         '',
            address:         get('ADR').replace(/;/g, ' ').trim(),
            supervisingOfficer: '',
            cluster:         '',
            raw:             text
        };
    }

    // ── 4. Key:Value plain text  e.g. "Name: Juan\nID: PS-001" ──
    if (/\w+\s*[:=]\s*.+/m.test(text)) {
        const lines = text.split(/[\r\n]+/);
        const kv = {};
        lines.forEach(line => {
            const m = line.match(/^([^:=]+)[:=]\s*(.+)$/);
            if (m) kv[m[1].trim().toLowerCase().replace(/\s+/g, '_')] = m[2].trim();
        });
        return {
            source: 'keyvalue',
            pusId:           kv['ps_id'] || kv['id'] || kv['client_id'] || '',
            pusName:         kv['full_name'] || kv['name'] || kv['client_name'] || '',
            gender:          kv['gender'] || '',
            dateOfBirth:     normalizeAnyDate(kv['date_of_birth'] || kv['dob'] || kv['birth_date'] || ''),
            offenseCategory: kv['offense'] || kv['offense_category'] || '',
            caseNumber:      kv['case_number'] || kv['case_no'] || kv['criminal_case_number'] || '',
            startDate:       normalizeAnyDate(kv['start_date'] || kv['start'] || ''),
            endDate:         normalizeAnyDate(kv['end_date']   || kv['end']   || ''),
            address:         kv['address'] || '',
            supervisingOfficer: kv['supervising_officer'] || kv['officer'] || '',
            cluster:         kv['cluster'] || '',
            raw:             text
        };
    }

    // ── 5. Bare text fallback — show whatever was scanned ──
    return {
        source: 'unknown',
        pusId:            '',
        pusName:          text.length < 80 ? text : text.slice(0, 80) + '…',
        gender:           '',
        dateOfBirth:      '',
        offenseCategory:  '',
        caseNumber:       '',
        startDate:        '',
        endDate:          '',
        address:          '',
        supervisingOfficer: '',
        cluster:          '',
        raw:              text
    };
}

let savedUrl = localStorage.getItem('appsScriptUrl');
if (savedUrl && savedUrl !== APPS_SCRIPT_URL_DEFAULT) {
    localStorage.removeItem('appsScriptUrl');
    savedUrl = null;
}
let APPS_SCRIPT_URL = savedUrl || APPS_SCRIPT_URL_DEFAULT;

let currentUser = null;
let currentPUSData = null;
let videoStream = null;
let scanning = false;

// DOM Elements
const loginSection = document.getElementById('loginSection');
const userInfo = document.getElementById('userInfo');
const mainContent = document.getElementById('mainContent');
const userEmailDisplay = document.getElementById('userEmailDisplay');
const userNameDisplay = document.getElementById('userNameDisplay');
const userAvatar = document.getElementById('userAvatar');
const logoutBtn = document.getElementById('logoutBtn');
const scannerTrigger = document.getElementById('scannerTrigger');
const scannerModal = document.getElementById('scannerModal');
const scannerVideo = document.getElementById('scannerVideo');
const pusInfoSection = document.getElementById('pusInfoSection');
const attendanceForm = document.getElementById('attendanceForm');
const submitBtn = document.getElementById('submitBtn');
const messageArea = document.getElementById('messageArea');
const configSection = document.getElementById('configSection');
const scriptUrlInput = document.getElementById('scriptUrlInput');
const saveUrlBtn = document.getElementById('saveUrlBtn');
const resetUrlBtn = document.getElementById('resetUrlBtn');
const adminLink = document.getElementById('adminLink');

function initGoogleSignIn() {
    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false
    });
    
    google.accounts.id.renderButton(
        document.getElementById('g_id_signin'),
        { 
            type: 'standard', 
            theme: 'outline', 
            size: 'large', 
            text: 'signin_with',
            shape: 'rectangular',
            width: 280
        }
    );
}

function handleCredentialResponse(response) {
    try {
        const payload = JSON.parse(atob(response.credential.split('.')[1]));
        const userEmail = payload.email;
        
        if (AUTHORIZED_EMAILS.includes(userEmail)) {
            currentUser = {
                email: userEmail,
                name: payload.name,
                picture: payload.picture
            };
            
            userNameDisplay.textContent = currentUser.name || currentUser.email;
            userEmailDisplay.textContent = currentUser.email;
            if (currentUser.picture) userAvatar.src = currentUser.picture;
            
            userInfo.style.display = 'flex';
            loginSection.style.display = 'none';
            mainContent.style.display = 'block';
            
            localStorage.setItem('loggedInUser', JSON.stringify(currentUser));
            showMessage(`Welcome, ${currentUser.name || currentUser.email}!`, 'success');
        } else {
            showMessage('Unauthorized: Your email is not registered in the PPO system.', 'error');
            google.accounts.id.disableAutoSelect();
        }
    } catch (e) {
        showMessage('Login failed. Please try again.', 'error');
    }
}

// ============================================
// FIXED checkSession() with try/catch
// ============================================

function checkSession() {
    try {
        const saved = localStorage.getItem('loggedInUser');
        if (!saved) return;
        
        const user = JSON.parse(saved);
        if (AUTHORIZED_EMAILS.includes(user.email)) {
            currentUser = user;
            userNameDisplay.textContent = user.name || user.email;
            userEmailDisplay.textContent = user.email;
            if (user.picture) userAvatar.src = user.picture;
            userInfo.style.display = 'flex';
            loginSection.style.display = 'none';
            mainContent.style.display = 'block';
        } else {
            localStorage.removeItem('loggedInUser');
        }
    } catch (e) {
        console.warn('Session corrupted, clearing:', e);
        localStorage.removeItem('loggedInUser');
    }
}

function logout() {
    if (window.google && google.accounts) {
        google.accounts.id.disableAutoSelect();
    }

    localStorage.removeItem('loggedInUser');
    currentUser = null;

    mainContent.style.display = 'none';
    loginSection.style.display = 'block';
    userInfo.style.display = 'none';
    pusInfoSection.style.display = 'none';
    attendanceForm.style.display = 'none';

    currentPUSData = null;

    attendanceForm?.reset();

    showMessage('You have been signed out.', 'info');
}

logoutBtn?.addEventListener('click', logout);

async function openScanner() {
    if (!APPS_SCRIPT_URL) {
        showMessage('Please configure Google Apps Script URL in Settings', 'error');
        configSection.style.display = 'block';
        return;
    }
    
    scannerModal.style.display = 'flex';
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        scannerVideo.srcObject = stream;
        videoStream = stream;
        await scannerVideo.play();
        scanning = true;
        scanQR();
    } catch (err) {
        showMessage('Camera access denied. Please allow camera permissions.', 'error');
        closeScanner();
    }
}

function scanQR() {
    if (!scanning) return;

    if (scannerVideo.readyState === scannerVideo.HAVE_ENOUGH_DATA) {
        const canvas = document.createElement('canvas');
        canvas.width = scannerVideo.videoWidth;
        canvas.height = scannerVideo.videoHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(scannerVideo, 0, 0);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        if (typeof jsQR !== 'function') {
            showMessage('QR scanner library not loaded.', 'error');
            scanning = false;
            return;
        }

        const code = jsQR(imgData.data, canvas.width, canvas.height);

        if (code) {
            scanning = false;
            closeScanner();
            processQR(code.data);
            return;
        }
    }

    requestAnimationFrame(scanQR);
}

function closeScanner() {
    scanning = false;

    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }

    if (scannerVideo) {
        scannerVideo.srcObject = null;
    }

    scannerModal.style.display = 'none';
}

// ============================================
// DROP-IN REPLACEMENT FOR processQR()
// ============================================

async function processQR(qrData) {
    showMessage('Processing QR code...', 'info');

    const data = parseQRData(qrData);
    currentPUSData = data;

    // Warn user if format wasn't the standard PPO one
    if (data.source !== 'json') {
        showMessage(`⚠️ Non-standard QR format detected (${data.source}). Some fields may be missing.`, 'info');
    }

    const ageVal = data.dateOfBirth ? calculateAgeFromDOB(data.dateOfBirth) : 'N/A';
    const ageDisplay = (ageVal !== 'N/A') ? `${ageVal} years` : 'N/A';

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value || 'N/A';
    };

    setText('displayPUSId',      data.pusId);
    setText('displayPUSName',    data.pusName);
    setText('displayGenderAge',  `${data.gender || 'N/A'} / Age: ${ageDisplay}`);
    setText('displayOffense',    data.offenseCategory);
    setText('displayCaseNumber', data.caseNumber);
    setText('displayAddress',    data.address);
    setText('displayOfficer',    data.supervisingOfficer);
    setText('displayCluster',    data.cluster);

    const startFormatted = formatReadableDate(data.startDate);
    const endFormatted   = formatReadableDate(data.endDate);
    setText('displayPeriod', `${startFormatted} to ${endFormatted}`);

    if (pusInfoSection)  pusInfoSection.style.display  = 'block';
    if (attendanceForm)  attendanceForm.style.display  = 'block';

    const label = data.source === 'json'
        ? '✓ Person Under Supervision loaded. Record attendance.'
        : `✓ QR scanned (${data.source} format). Verify details before submitting.`;
    showMessage(label, 'success');
}

// ============================================
// FIXED showMessage() with unique IDs and safe removal
// ============================================

function showMessage(msg, type) {
    const id = Date.now() + '-' + Math.random().toString(36).substr(2, 8);
    const escapedMsg = msg.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
    
    messageArea.innerHTML += `<div class="message message-${type}" data-id="${id}">${escapedMsg}</div>`;
    
    setTimeout(() => {
        const el = messageArea.querySelector(`[data-id="${id}"]`);
        if (el) el.remove();
        
        // Clean up empty container
        if (messageArea.children.length === 0) {
            messageArea.innerHTML = '';
        }
    }, 4000);
}

// ============================================
// IMPROVED submitAttendance() with better error handling
// ============================================

async function submitAttendance(e) {
    e.preventDefault();
    if (!APPS_SCRIPT_URL) {
        showMessage('Please configure Google Apps Script URL in Settings', 'error');
        configSection.style.display = 'block';
        return;
    }
    if (!currentUser) {
        showMessage('Please sign in first.', 'error');
        return;
    }
    if (!currentPUSData) {
        showMessage('Please scan a QR code first.', 'error');
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    
    let calculatedAge = '';
    if (currentPUSData.dateOfBirth) {
        const age = calculateAgeFromDOB(currentPUSData.dateOfBirth);
        calculatedAge = age !== 'N/A' ? age.toString() : '';
    }
    
    const attendanceData = {
        employeeEmail: currentUser.email,
        clientName: currentPUSData.pusName || currentPUSData.clientName,
        clientId: currentPUSData.pusId || currentPUSData.clientId,
        gender: currentPUSData.gender,
        age: calculatedAge,
        offenseCategory: currentPUSData.offenseCategory,
        caseNumber: currentPUSData.caseNumber,
        address: currentPUSData.address,
        startDate: normalizeAnyDate(currentPUSData.startDate),
        endDate: normalizeAnyDate(currentPUSData.endDate),
        supervisingOfficer: currentPUSData.supervisingOfficer,
        cluster: currentPUSData.cluster,
        remarks: document.getElementById('remarks')?.value || '',
        familySupport: document.getElementById('familySupport')?.value || '',
        notes: document.getElementById('notes')?.value || '',
        timestamp: new Date().toISOString(),
        qrSource: currentPUSData.source || 'json'
    };
    
    try {
        // Add timeout to fetch to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(attendanceData),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // With no-cors, we can't read response, so we assume success
        // The Apps Script should log errors to its own sheet
        showMessage('✓ Attendance recorded successfully!', 'success');
        
        // Clear form after successful submission
        setTimeout(() => {
            if (pusInfoSection) pusInfoSection.style.display = 'none';
            if (attendanceForm) attendanceForm.style.display = 'none';
            attendanceForm?.reset();
            currentPUSData = null;
        }, 2000);
    } catch (err) {
        console.error('Fetch error:', err);
        if (err.name === 'AbortError') {
            showMessage('Request timeout. Please check your connection and try again.', 'error');
        } else {
            showMessage('Connection error. Please try again.', 'error');
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '✅ Record Attendance';
    }
}

adminLink?.addEventListener('click', (e) => {
    e.preventDefault();
    if (configSection) {
        configSection.style.display =
            configSection.style.display === 'none' ? 'block' : 'none';
    }

    if (scriptUrlInput) {
        scriptUrlInput.value = APPS_SCRIPT_URL;
    }
});

if (saveUrlBtn) {
    saveUrlBtn.onclick = () => {
        const url = scriptUrlInput.value.trim();
        if (url) {
            APPS_SCRIPT_URL = url;
            localStorage.setItem('appsScriptUrl', url);
            showMessage('✓ URL saved successfully!', 'success');
            if (configSection) configSection.style.display = 'none';
        } else {
            showMessage('Please enter a valid URL', 'error');
        }
    };
}

if (resetUrlBtn) {
    resetUrlBtn.onclick = () => {
        localStorage.removeItem('appsScriptUrl');
        APPS_SCRIPT_URL = APPS_SCRIPT_URL_DEFAULT;
        if (scriptUrlInput) {
            scriptUrlInput.value = APPS_SCRIPT_URL_DEFAULT;
        }
        showMessage('✓ URL reset to default. Click "Save URL" to confirm.', 'success');
    };
}

scannerTrigger?.addEventListener('click', openScanner);
attendanceForm?.addEventListener('submit', submitAttendance);
window.closeScanner = closeScanner;

checkSession();

if (typeof google !== 'undefined' && google.accounts) {
    initGoogleSignIn();
} else {
    window.addEventListener('load', () => setTimeout(initGoogleSignIn, 500));
}

if (scriptUrlInput) {
    scriptUrlInput.value = APPS_SCRIPT_URL;
}