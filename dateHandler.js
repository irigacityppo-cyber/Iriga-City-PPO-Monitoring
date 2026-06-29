// ============================================
// IRIGA PPO - UNIVERSAL DATE HANDLER
// Used by: index.html (scanner), qr-generator.html (QR creator)
// Supports: Excel dates, QR codes, batch imports, all string formats
// ============================================

const MONTH_MAP = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    january: 1, february: 2, march: 3, april: 4, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
};

/**
 * MASTER DATE NORMALIZER - Handles ANY date format
 * Returns ISO format (YYYY-MM-DD) or empty string
 * 
 * Supports:
 * - Date objects
 * - Excel serial numbers (40000-60000)
 * - ISO strings (YYYY-MM-DD, YYYY-MM-DDTHH:MM:SS)
 * - US format (MM/DD/YYYY, MM/DD/YY, MM-DD-YYYY)
 * - International (DD/MM/YYYY, DD.MM.YYYY)
 * - Named months (15-Aug-2024, August 15, 2024, 15th August 2024)
 * - Various separators (/, -, ., space)
 * - Ordinal suffixes (1st, 2nd, 3rd, 4th, etc)
 */
function normalizeDate(value) {
    if (!value || value === 'N/A' || value === '') return '';

    // Handle Date objects
    if (value instanceof Date && !isNaN(value.getTime())) {
        return value.toISOString().split('T')[0];
    }

    // Handle Excel serial numbers (40000-60000 = 1909-2079)
    if (typeof value === 'number' && value > 40000 && value < 60000) {
        try {
            // Try XLSX library first if available
            if (typeof XLSX !== 'undefined' && XLSX.SSF && XLSX.SSF.parse_date_code) {
                const d = XLSX.SSF.parse_date_code(value);
                if (d && d.y && d.m && d.d) {
                    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
                }
            }
            // Fallback: manual conversion
            const d = new Date((value - 25569) * 86400 * 1000);
            if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
        } catch (e) {
            console.warn('Excel serial conversion failed:', e);
        }
    }

    // Convert to string and clean
    const str = String(value).trim();
    if (!str) return '';

    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

    // ISO with time (YYYY-MM-DDTHH:MM:SS.SSSZ)
    if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return str.slice(0, 10);

    // Remove ordinal suffixes (1st, 2nd, 3rd, 4th, etc)
    const cleanStr = str.replace(/(\d)(st|nd|rd|th)/gi, '$1');

    // === PATTERN MATCHING SECTION ===

    let m;

    // ─── Pattern 1: MM/DD/YYYY or M/D/YYYY ───
    m = cleanStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
        const month = parseInt(m[1]), day = parseInt(m[2]), year = parseInt(m[3]);
        // If first number > 12, assume DD/MM/YYYY
        if (month > 12 && day <= 12) {
            return formatYMD(year, day, month);
        }
        return formatYMD(year, month, day);
    }

    // ─── Pattern 2: MM-DD-YYYY or M-D-YYYY ───
    m = cleanStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (m) {
        const month = parseInt(m[1]), day = parseInt(m[2]), year = parseInt(m[3]);
        if (month > 12 && day <= 12) {
            return formatYMD(year, day, month);
        }
        return formatYMD(year, month, day);
    }

    // ─── Pattern 3: YYYY/MM/DD or YYYY-MM-DD (already handled) ───
    m = cleanStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (m) {
        return formatYMD(parseInt(m[1]), parseInt(m[2]), parseInt(m[3]));
    }

    // ─── Pattern 4: DD.MM.YYYY or MM.DD.YYYY ───
    m = cleanStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) {
        const first = parseInt(m[1]), second = parseInt(m[2]), year = parseInt(m[3]);
        if (first > 12 && second <= 12) {
            return formatYMD(year, second, first); // DD.MM.YYYY
        }
        return formatYMD(year, first, second); // MM.DD.YYYY
    }

    // ─── Pattern 5: MM/DD/YY (short year) ───
    m = cleanStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (m) {
        const month = parseInt(m[1]), day = parseInt(m[2]);
        if (month <= 12 && day <= 31) {
            const year = fixShortYear(m[3]);
            return formatYMD(year, month, day);
        }
    }

    // ─── Pattern 6: MM-DD-YY (short year with dash) ───
    m = cleanStr.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/);
    if (m) {
        const month = parseInt(m[1]), day = parseInt(m[2]);
        if (month <= 12 && day <= 31) {
            const year = fixShortYear(m[3]);
            return formatYMD(year, month, day);
        }
    }

    // ─── Pattern 7: DD-MMM-YY or DD-MMM-YYYY (15-Aug-2024) ───
    m = cleanStr.match(/^(\d{1,2})-([A-Za-z]{3,})-(\d{2,4})$/);
    if (m) {
        const day = parseInt(m[1]);
        const month = getMonthNumber(m[2]);
        if (month) {
            const year = m[3].length === 2 ? fixShortYear(m[3]) : parseInt(m[3]);
            return formatYMD(year, month, day);
        }
    }

    // ─── Pattern 8: DD/MMM/YYYY or DD/MMM/YY ───
    m = cleanStr.match(/^(\d{1,2})\/([A-Za-z]{3,})\/(\d{2,4})$/);
    if (m) {
        const day = parseInt(m[1]);
        const month = getMonthNumber(m[2]);
        if (month) {
            const year = m[3].length === 2 ? fixShortYear(m[3]) : parseInt(m[3]);
            return formatYMD(year, month, day);
        }
    }

    // ─── Pattern 9: MMM DD, YYYY (August 15, 2024) ───
    m = cleanStr.match(/^([A-Za-z]{3,})\s+(\d{1,2}),?\s+(\d{4})$/);
    if (m) {
        const month = getMonthNumber(m[1]);
        if (month) {
            return formatYMD(parseInt(m[3]), month, parseInt(m[2]));
        }
    }

    // ─── Pattern 10: DD MMM YYYY (15 August 2024) ───
    m = cleanStr.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
    if (m) {
        const month = getMonthNumber(m[2]);
        if (month) {
            return formatYMD(parseInt(m[3]), month, parseInt(m[1]));
        }
    }

    // ─── Pattern 11: Fallback - Try JavaScript Date parser ───
    try {
        const jsDate = new Date(cleanStr);
        if (!isNaN(jsDate.getTime()) && jsDate.getFullYear() > 1900 && jsDate.getFullYear() < 2100) {
            return formatYMD(jsDate.getFullYear(), jsDate.getMonth() + 1, jsDate.getDate());
        }
    } catch (e) {
        // Silent fail, return original
    }

    return ''; // Return empty if nothing matched
}

/**
 * Helper: Format date to YYYY-MM-DD with validation
 */
function formatYMD(year, month, day) {
    year = parseInt(year);
    month = parseInt(month);
    day = parseInt(day);

    // Validate ranges
    if (year < 1900 || year > 2100) return '';
    if (month < 1 || month > 12) return '';
    if (day < 1 || day > 31) return '';

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Helper: Convert 2-digit year to 4-digit
 */
function fixShortYear(yr) {
    const y = parseInt(yr);
    return y < 30 ? 2000 + y : 1900 + y;
}

/**
 * Helper: Get month number from name (case-insensitive)
 */
function getMonthNumber(monthName) {
    const lower = monthName.toLowerCase().slice(0, 3);
    return MONTH_MAP[lower] || (MONTH_MAP[monthName.toLowerCase()] || null);
}

/**
 * Display formatter - converts YYYY-MM-DD to MM/DD/YYYY
 */
function formatDateDisplay(value) {
    if (!value || value === 'N/A') return 'N/A';
    const iso = normalizeDate(value);
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return value;
    
    try {
        const d = new Date(iso + 'T00:00:00Z'); // Force UTC
        if (isNaN(d.getTime())) return value;
        
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        const year = String(d.getUTCFullYear()).slice(-2);
        return `${month}/${day}/${year}`;
    } catch (e) {
        return value;
    }
}

/**
 * Readable date formatter - "August 15, 2024"
 */
function formatDateReadable(value) {
    if (!value || value === 'N/A') return 'N/A';
    const iso = normalizeDate(value);
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return value;
    
    try {
        const d = new Date(iso + 'T00:00:00Z');
        if (isNaN(d.getTime())) return value;
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) {
        return value;
    }
}

/**
 * Calculate age from date of birth
 */
function calculateAge(dateOfBirth) {
    if (!dateOfBirth || dateOfBirth === 'N/A') return '';
    
    const iso = normalizeDate(dateOfBirth);
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
    
    try {
        const dob = new Date(iso + 'T00:00:00Z');
        if (isNaN(dob.getTime())) return '';
        
        const today = new Date();
        let age = today.getUTCFullYear() - dob.getUTCFullYear();
        const m = today.getUTCMonth() - dob.getUTCMonth();
        
        if (m < 0 || (m === 0 && today.getUTCDate() < dob.getUTCDate())) {
            age--;
        }
        
        return age >= 0 ? age : '';
    } catch (e) {
        return '';
    }
}

/**
 * Get age display string for UI
 */
function getAgeDisplay(dateOfBirth) {
    const age = calculateAge(dateOfBirth);
    return age ? `${age} years` : 'N/A';
}

// ============================================
// EXPORT FOR USE IN BOTH FILES
// ============================================

// Browser environment
if (typeof module === 'undefined') {
    window.normalizeDate = normalizeDate;
    window.formatDateDisplay = formatDateDisplay;
    window.formatDateReadable = formatDateReadable;
    window.calculateAge = calculateAge;
    window.getAgeDisplay = getAgeDisplay;
}

// Node/module environment (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        normalizeDate,
        formatDateDisplay,
        formatDateReadable,
        calculateAge,
        getAgeDisplay
    };
}
