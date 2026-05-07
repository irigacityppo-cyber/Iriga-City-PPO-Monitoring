// ============================================
// IRIGA PPO ATTENDANCE SYSTEM – EMAIL ONLY WHEN 60 DAYS OR LESS REMAINING
// FULLY UPDATED FOR YYYY-MM-DD DATE FORMAT
// ============================================

const SPREADSHEET_ID = '1yvSK06QRekXYitYpE8iG_v1jYt1uyPlgM06xCzRHmlE';
const SHEET_NAME = 'Test Sheet';
const TRACKING_SHEET_NAME = 'Supervision_Tracking';

// ============================================
// AUTHORIZED EMPLOYEES
// ============================================
const AUTHORIZED_EMPLOYEES = [
  'iace2318i@gmail.com',
  'wq.rodalyn@gmail.com',
  'beta22926@gmail.com',
  'johnrogerargarin@gmail.com'
];

// ============================================
// EMAIL CONFIGURATION
// ============================================
const MAIN_OFFICE_EMAIL = 'iace2318i@gmail.com';
const SEND_EMAIL_NOTIFICATIONS = true;
const EMAIL_THRESHOLD_DAYS = 60; // Only send email when 60 days or less remaining

// ============================================
// CORS HELPERS
// ============================================
function createCorsOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doOptions(e) {
  return createCorsOutput({ success: true });
}

// ============================================
// DATE PARSING HELPER - HANDLES BOTH YYYY-MM-DD AND MM-DD-YYYY
// ============================================
function parseDate(dateStr) {
  if (!dateStr || dateStr === 'N/A' || dateStr === '') return null;
  
  try {
    const dateString = String(dateStr).trim();
    
    // Format: YYYY-MM-DD (new format from date picker)
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const parts = dateString.split('-');
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    // Format: MM-DD-YYYY (old format)
    else if (dateString.match(/^\d{2}-\d{2}-\d{4}$/)) {
      const parts = dateString.split('-');
      return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
    }
    // Try regular date parsing
    else {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) return date;
    }
  } catch(e) {
    console.error(`Date parsing error for ${dateStr}:`, e.message);
  }
  
  return null;
}

// ============================================
// TIME CALCULATION (remaining + served only)
// ============================================
function calculateTimeRemaining(endDateStr) {
  if (!endDateStr || endDateStr === 'N/A' || endDateStr === '') {
    return { text: 'No end date specified', days: null };
  }
  
  try {
    const endDate = parseDate(endDateStr);
    if (!endDate) return { text: 'Invalid date format', days: null };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (endDate < today) {
      return { text: 'EXPIRED - Supervision period has ended', days: 0 };
    }
    
    const diffDays = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    const days = diffDays % 30;
    
    let text = '';
    if (years > 0) text = `${years} year(s), ${months} month(s), ${days} day(s) remaining`;
    else if (months > 0) text = `${months} month(s), ${days} day(s) remaining`;
    else text = `${diffDays} day(s) remaining`;
    
    console.log(`Date calculation - End Date: ${endDateStr}, Days remaining: ${diffDays}`);
    
    return { text: text, days: diffDays };
  } catch(e) { 
    console.error(`Error calculating time remaining for ${endDateStr}:`, e.message);
    return { text: 'Unable to calculate', days: null };
  }
}

function calculateTimeServed(startDateStr) {
  if (!startDateStr || startDateStr === 'N/A' || startDateStr === '') {
    return 'No start date specified';
  }
  
  try {
    const startDate = parseDate(startDateStr);
    if (!startDate) return 'Invalid date format';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (startDate > today) return 'Supervision has not started yet';
    
    const diffDays = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24));
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    const days = diffDays % 30;
    
    if (years > 0) return `${years} year(s), ${months} month(s), ${days} day(s) served`;
    if (months > 0) return `${months} month(s), ${days} day(s) served`;
    return `${diffDays} day(s) served`;
  } catch(e) { 
    console.error(`Error calculating time served for ${startDateStr}:`, e.message);
    return 'Unable to calculate';
  }
}

// ============================================
// FORMAT DATE FOR DISPLAY (YYYY-MM-DD to readable)
// ============================================
function formatReadableDate(dateStr) {
  if (!dateStr || dateStr === 'N/A') return 'N/A';
  
  const date = parseDate(dateStr);
  if (!date) return dateStr;
  
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

// ============================================
// EMAIL NOTIFICATION - ONLY SENT WHEN <= 60 DAYS REMAINING
// ============================================
function sendAttendanceNotification(data, clientName, clientId) {
  if (!SEND_EMAIL_NOTIFICATIONS) return;
  if (!MAIN_OFFICE_EMAIL || MAIN_OFFICE_EMAIL === 'mainoffice@irigappo.gov.ph') return;
  
  try {
    const endDate = data.endDate || 'N/A';
    const startDate = data.startDate || 'N/A';
    const timeRemainingObj = calculateTimeRemaining(endDate);
    const timeRemaining = timeRemainingObj.text;
    const daysRemaining = timeRemainingObj.days;
    const timeServed = calculateTimeServed(startDate);
    
    // Format dates for readable display in email
    const formattedStartDate = formatReadableDate(startDate);
    const formattedEndDate = formatReadableDate(endDate);
    
    // Only send email if days remaining is 60 or less (and not expired)
    if (daysRemaining !== null && daysRemaining <= EMAIL_THRESHOLD_DAYS && daysRemaining > 0) {
      
      let statusEmoji = '🟡';
      let statusText = 'Approaching End Date';
      if (timeRemaining.includes('EXPIRED')) { 
        statusEmoji = '🔴'; 
        statusText = 'EXPIRED'; 
      }
      
      const body = `
🏢 IRIGA CITY PROBATION AND PAROLE OFFICE
==========================================
⚠️ ATTENTION: SUPERVISION ENDING SOON ⚠️
${statusEmoji} Status: ${statusText}

👤 PERSON UNDER SUPERVISION
─────────────────────────────────────────
PS ID: ${clientId || 'N/A'}
Full Name: ${clientName || 'N/A'}
Gender: ${data.gender || 'N/A'}
Age: ${data.age || 'N/A'}
Offense: ${data.offenseCategory || 'N/A'}
Criminal Case No.: ${data.caseNumber || 'N/A'}
Address: ${data.address || 'N/A'}
Officer: ${data.supervisingOfficer || 'N/A'}
Cluster: ${data.cluster || 'N/A'}

⏰ SUPERVISION TIMELINE
─────────────────────────────────────────
Start: ${formattedStartDate}
End:   ${formattedEndDate}
✅ Time served: ${timeServed}
⏳ Remaining:   ${timeRemaining}

⚠️ ONLY ${daysRemaining} DAYS REMAINING IN SUPERVISION PERIOD ⚠️

📝 ATTENDANCE DETAILS
─────────────────────────────────────────
Date/Time: ${new Date().toLocaleString()}
REMARKS: ${data.remarks || 'N/A'}
Family Support: ${data.familySupport || 'N/A'}
NOTES: ${data.notes || 'No notes'}

👮 Officer Email: ${data.employeeEmail || 'N/A'}
==========================================
This is an automated alert from the Iriga PPO Attendance System.
Please review this case as the supervision period is ending soon.`;
      
      MailApp.sendEmail({ 
        to: MAIN_OFFICE_EMAIL, 
        subject: `⚠️ ALERT: Supervision Ending Soon - ${clientName} (${clientId}) - ${daysRemaining} days left`, 
        body: body 
      });
      console.log(`✅ Alert email sent for ${clientName} - ${daysRemaining} days remaining`);
    } else if (daysRemaining !== null && daysRemaining > EMAIL_THRESHOLD_DAYS) {
      console.log(`ℹ️ No email sent for ${clientName} - ${daysRemaining} days remaining (threshold: ${EMAIL_THRESHOLD_DAYS})`);
    } else if (daysRemaining === 0) {
      console.log(`ℹ️ Supervision already expired for ${clientName}`);
    } else {
      console.log(`ℹ️ Could not calculate days remaining for ${clientName}`);
    }
  } catch(e) { 
    console.error('Email error:', e.message); 
  }
}

// ============================================
// SUPERVISION TRACKING SHEET
// ============================================
function updateSupervisionTracking(data, clientName, clientId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(TRACKING_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(TRACKING_SHEET_NAME);
    sheet.getRange(1,1,1,12).setValues([[
      'PS ID', 'PS Name', 'Start Date', 'End Date', 'Time Remaining', 'Days Left', 
      'Status', 'Last Attendance', 'Officer Email', 'Criminal Case No.', 'Address', 'Last Updated'
    ]]);
    sheet.getRange(1,1,1,12).setFontWeight('bold');
  }
  
  const pusId = clientId || data.clientId || data.pusId || `PS${new Date().getTime()}`;
  const pusName = clientName || data.clientName || data.pusName || 'N/A';
  const startDate = data.startDate || 'N/A';
  const endDate = data.endDate || 'N/A';
  const caseNumber = data.caseNumber || 'N/A';
  const address = data.address || 'N/A';
  
  const timeRemainingObj = calculateTimeRemaining(endDate);
  const timeRemaining = timeRemainingObj.text;
  const daysLeft = timeRemainingObj.days;
  
  let status = 'Active';
  if (daysLeft !== null && daysLeft <= 60 && daysLeft > 0) status = '⚠️ Ending Soon';
  else if (daysLeft !== null && daysLeft <= 0) status = 'Expired';
  
  const existing = sheet.getDataRange().getValues();
  let rowIdx = -1;
  for (let i = 1; i < existing.length; i++) {
    if (existing[i][0] === pusId) { 
      rowIdx = i + 1; 
      break; 
    }
  }
  
  const newRow = [
    pusId, 
    pusName, 
    startDate, 
    endDate, 
    timeRemaining, 
    daysLeft !== null ? daysLeft : 'N/A', 
    status, 
    new Date(), 
    data.employeeEmail || '', 
    caseNumber, 
    address,
    new Date()
  ];
  
  if (rowIdx === -1) {
    sheet.appendRow(newRow);
  } else {
    for (let i = 0; i < newRow.length; i++) {
      sheet.getRange(rowIdx, i + 1).setValue(newRow[i]);
    }
  }
  console.log(`✅ Tracking sheet updated for ${pusId} - Days left: ${daysLeft}`);
}

// ============================================
// doPost – MAIN ENTRY POINT
// ============================================
function doPost(e) {
  try {
    let data = (e && e.postData && e.postData.contents) ? JSON.parse(e.postData.contents) : {};
    
    console.log('Received data:', JSON.stringify(data));
    
    const employeeEmail = data.employeeEmail || data.email;
    if (!employeeEmail) {
      return createCorsOutput({ success: false, error: 'No email provided' });
    }
    
    if (!AUTHORIZED_EMPLOYEES.includes(employeeEmail)) {
      return createCorsOutput({ success: false, error: 'Unauthorized' });
    }
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
    
    // Add headers if empty - MATCHING YOUR EXACT SHEET STRUCTURE
    if (sheet.getLastRow() === 0) {
      const headers = [
        'Timestamp',
        'NAME OF CLIENT',
        'GENDER',
        'OFFENSE CATEGORY',
        'CRIMINAL CASE NUMBER',
        'ADDRESS',
        'START OF SUPERVISION PERIOD',
        'END OF SUPERVISION PERIOD',
        'NAME OF SUPERVISING OFFICER',
        'CLUSTER',
        'REMARKS',
        'WITH FAMILY SUPPORT GROUP',
        'NOTES',
        'Email Address Of employee',
        'AGE'
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    }
    
    const clientName = data.clientName || data.pusName || 'N/A';
    const clientId = data.clientId || data.pusId || '';
    
    const row = [
      new Date(),                                    // Timestamp
      clientName,                                    // NAME OF CLIENT
      data.gender || 'N/A',                          // GENDER
      data.offenseCategory || 'N/A',                 // OFFENSE CATEGORY
      data.caseNumber || 'N/A',                      // CRIMINAL CASE NUMBER
      data.address || 'N/A',                         // ADDRESS
      data.startDate || 'N/A',                       // START DATE
      data.endDate || 'N/A',                         // END DATE
      data.supervisingOfficer || 'N/A',              // SUPERVISING OFFICER
      data.cluster || 'N/A',                         // CLUSTER
      data.remarks || 'N/A',                         // REMARKS
      data.familySupport || 'N/A',                   // FAMILY SUPPORT
      data.notes || '',                              // NOTES
      employeeEmail,                                 // OFFICER EMAIL
      data.age || 'N/A'                              // AGE
    ];
    
    sheet.appendRow(row);
    console.log(`✅ Row added at row ${sheet.getLastRow()}`);
    
    // Small delay to ensure sheet write completes
    Utilities.sleep(500);
    
    // Send email notification (only if within 60 days)
    sendAttendanceNotification(data, clientName, clientId);
    
    // Update tracking sheet
    updateSupervisionTracking(data, clientName, clientId);
    
    return createCorsOutput({ 
      success: true, 
      row: sheet.getLastRow(), 
      message: 'Attendance recorded successfully'
    });
    
  } catch(err) {
    console.error('Error in doPost:', err);
    return createCorsOutput({ success: false, error: err.toString() });
  }
}

// ============================================
// doGet – ONLY from QR code JSON (no master sheet)
// ============================================
function doGet(e) {
  try {
    const qrData = e.parameter.qr || e.parameter.pusId || e.parameter.clientId;
    const employeeEmail = e.parameter.email;
    
    if (!AUTHORIZED_EMPLOYEES.includes(employeeEmail)) {
      return createCorsOutput({ success: false, error: 'Unauthorized' });
    }
    
    if (!qrData) {
      return createCorsOutput({ success: false, error: 'No QR data' });
    }
    
    let clientData;
    try { 
      clientData = JSON.parse(qrData); 
    } catch(parseErr) { 
      return createCorsOutput({ success: false, error: 'Invalid QR code' }); 
    }
    
    return createCorsOutput({
      success: true,
      client: {
        clientName: clientData.pusName || clientData.clientName,
        clientId: clientData.pusId || clientData.clientId,
        gender: clientData.gender,
        age: clientData.age,
        offenseCategory: clientData.offenseCategory,
        caseNumber: clientData.caseNumber,
        address: clientData.address,
        startDate: clientData.startDate,
        endDate: clientData.endDate,
        supervisingOfficer: clientData.supervisingOfficer,
        cluster: clientData.cluster
      }
    });
  } catch(err) {
    return createCorsOutput({ success: false, error: err.toString() });
  }
}

// ============================================
// TEST FUNCTIONS
// ============================================
function testEmailOnly() {
  MailApp.sendEmail({ 
    to: MAIN_OFFICE_EMAIL, 
    subject: 'Test Email - Iriga PPO System', 
    body: 'Email works! The system is properly configured.' 
  });
  console.log('✅ Test email sent');
}

function testDateParsing() {
  // Test with YYYY-MM-DD format (new)
  const testDate1 = "2026-06-15";
  const result1 = calculateTimeRemaining(testDate1);
  console.log(`Test YYYY-MM-DD (${testDate1}): ${result1.days} days remaining, Text: ${result1.text}`);
  
  // Test with MM-DD-YYYY format (old)
  const testDate2 = "06-15-2026";
  const result2 = calculateTimeRemaining(testDate2);
  console.log(`Test MM-DD-YYYY (${testDate2}): ${result2.days} days remaining, Text: ${result2.text}`);
  
  // Test with date within 45 days (should trigger alert)
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + 45);
  const futureDateStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`;
  const result3 = calculateTimeRemaining(futureDateStr);
  console.log(`Test 45 days out (${futureDateStr}): ${result3.days} days remaining`);
  
  return { result1, result2, result3 };
}

function testThresholdAlert() {
  // Test with a date that is 45 days from now (should trigger alert)
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + 45);
  const futureDateStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`;
  
  const testData = {
    employeeEmail: 'iace2318i@gmail.com',
    clientName: 'TEST - Threshold Alert',
    clientId: 'TEST001',
    gender: 'Male',
    age: '35',
    offenseCategory: 'Drug Offense',
    caseNumber: 'RTC-2024-00123',
    address: '123 Test St., Iriga City',
    startDate: '2024-01-01',
    endDate: futureDateStr,
    supervisingOfficer: 'SSPO TEST',
    cluster: 'IRIGA',
    remarks: 'Test',
    familySupport: 'Yes',
    notes: 'This should trigger an alert email'
  };
  
  sendAttendanceNotification(testData, 'TEST - Threshold Alert', 'TEST001');
  console.log('✅ Test threshold alert sent if applicable');
  return '✅ Test threshold alert sent if applicable';
}

function testWrite() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  
  if (sheet.getLastRow() === 0) {
    const headers = [
      'Timestamp',
      'NAME OF CLIENT',
      'GENDER',
      'OFFENSE CATEGORY',
      'CRIMINAL CASE NUMBER',
      'ADDRESS',
      'START OF SUPERVISION PERIOD',
      'END OF SUPERVISION PERIOD',
      'NAME OF SUPERVISING OFFICER',
      'CLUSTER',
      'REMARKS',
      'WITH FAMILY SUPPORT GROUP',
      'NOTES',
      'Email Address Of employee',
      'AGE'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  
  sheet.appendRow([
    new Date(),
    'TEST – Works!',
    'Male',
    'Drug Offense',
    'RTC-2024-00123',
    '123 Test St., Iriga City',
    '2024-01-01',
    '2024-12-31',
    'SSPO JANET B. PAVIA',
    'IRIGA',
    'Test',
    'Yes',
    'Test row',
    'test@example.com',
    '35'
  ]);
  
  return '✅ Test row added.';
}

function testFullWorkflow() {
  const testData = {
    employeeEmail: 'iace2318i@gmail.com',
    clientName: 'FULL WORKFLOW TEST',
    clientId: 'TEST002',
    gender: 'Female',
    age: '42',
    offenseCategory: 'Non-Drug Offense',
    caseNumber: 'RTC-2024-00456',
    address: '456 Mabini St., Iriga City',
    startDate: '2024-01-01',
    endDate: '2026-12-31',
    supervisingOfficer: 'SSPO JANET B. PAVIA',
    cluster: 'NABUA',
    remarks: 'Individual Reporting',
    familySupport: 'Yes',
    notes: 'Full workflow test'
  };
  
  const result = doPost({ postData: { contents: JSON.stringify(testData) } });
  console.log('Full workflow test result:', result.getContent());
  return result;
}