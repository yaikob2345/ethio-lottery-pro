/* ============ GAME MODES ============ */
const GAME_MODES = {
  mini: {
    name: 'Mini', icon: '🎯', maxUsers: 20, ticketPrice: 100,
    prizes: [
      { label: '1,000 ETB', value: 1000, color: '#ff6b6b' },
      { label: '300 ETB',   value: 300,  color: '#4ecdc4' },
      { label: '200 ETB',   value: 200,  color: '#ffe66d' },
      { label: '100 ETB',   value: 100,  color: '#a8e6cf' }
    ]
  },
  standard: {
    name: 'Standard', icon: '🏆', maxUsers: 300, ticketPrice: 200,
    prizes: [
      { label: '30,000 ETB', value: 30000, color: '#ff6b6b' },
      { label: '10,000 ETB', value: 10000, color: '#4ecdc4' },
      { label: '5,000 ETB',  value: 5000,  color: '#ffe66d' },
      { label: '1,000 ETB',  value: 1000,  color: '#a8e6cf' }
    ]
  }
};

const ADMIN_PASSWORD = 'admin123';
const STORAGE_KEY = 'spinState5';

/* ============ STATE ============ */
let state = loadState();

function defaultState() {
  return {
    rounds: {
      mini:     { round: 1, collected: 0, status: 'collecting', ticketCounter: 1 },
      standard: { round: 1, collected: 0, status: 'collecting', ticketCounter: 1 }
    },
    registrations: [],
    tickets: [],
    winners: [],
    credits: [],
    messages: []
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {
    console.warn('Failed to load state:', e);
  }
  return defaultState();
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch(e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      alert('⚠️ Storage FULL! Please go to Admin → Data Management → Remove Old Screenshots to free space.');
    } else {
      console.error('Save failed:', e);
    }
  }
}

function getMode(mode) { return GAME_MODES[mode]; }
function getRound(mode) { return state.rounds[mode]; }
function getTarget(mode) { return getMode(mode).maxUsers * getMode(mode).ticketPrice; }
function getPrizes(mode) { return getMode(mode).prizes; }

function generateTicketId(mode) {
  const rnd = Math.floor(100000 + Math.random() * 900000);
  const prefix = mode === 'mini' ? 'M' : 'S';
  return `${prefix}${state.rounds[mode].round}-${rnd}`;
}

/* ============ STORAGE UTILITIES ============ */
function getStorageUsage() {
  let total = 0;
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += (localStorage[key].length * 2); // UTF-16 = 2 bytes per char
    }
  }
  return total; // bytes
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(2) + ' MB';
}

/* ============ EXPORT: CSV ============ */
function exportFullCSV() {
  let csv = '';

  // --- Registrations ---
  csv += '=== REGISTRATIONS ===\n';
  csv += 'ID,Mode,Round,Name,Phone,Amount,Status,Tickets Issued,Credit Issued,Reject Reason,Time\n';
  state.registrations.forEach(r => {
    csv += `"${r.id}","${r.mode}",${r.round},"${r.name}","${r.phone}",${r.amount},"${r.status}",${r.ticketsIssued||0},${r.creditIssued||0},"${r.rejectReason||''}","${r.timestamp}"\n`;
  });

  // --- Tickets ---
  csv += '\n=== TICKETS ===\n';
  csv += 'Ticket ID,Mode,Round,Name,Phone,Registration ID,Time\n';
  state.tickets.forEach(t => {
    csv += `"${t.id}","${t.mode}",${t.round},"${t.name}","${t.phone}","${t.regId}","${t.createdAt}"\n`;
  });

  // --- Winners ---
  csv += '\n=== WINNERS ===\n';
  csv += 'Mode,Round,Prize Rank,Prize Label,Prize Value,Winner Name,Winner Phone,Ticket ID\n';
  state.winners.forEach(w => {
    const rank = getPrizes(w.mode).findIndex(p => p.label === w.prize.label) + 1;
    csv += `"${w.mode}",${w.round},${rank},"${w.prize.label}",${w.prize.value},"${w.name}","${w.phone}","${w.ticket.id}"\n`;
  });

  // --- Credits ---
  csv += '\n=== CREDITS ===\n';
  csv += 'Name,Phone,Mode,Amount,From Round,Used,Note\n';
  state.credits.forEach(c => {
    csv += `"${c.name}","${c.phone}","${c.mode}",${c.amount},${c.fromRound},${c.used},"${c.note||''}"\n`;
  });

  return csv;
}

function exportWinnersCSV() {
  let csv = 'Mode,Round,Prize Rank,Prize Label,Prize Value (ETB),Winner Name,Winner Phone,Ticket ID\n';
  state.winners.forEach(w => {
    const prizes = getPrizes(w.mode);
    const rank = prizes.findIndex(p => p.label === w.prize.label) + 1;
    const ordinal = ['1st','2nd','3rd','4th'][rank - 1] || rank;
    csv += `"${w.mode}",${w.round},"${ordinal}","${w.prize.label}",${w.prize.value},"${w.name}","${w.phone}","${w.ticket.id}"\n`;
  });
  return csv;
}

function exportTicketsCSV() {
  let csv = 'Ticket ID,Mode,Round,Name,Phone,Registration ID,Created At\n';
  state.tickets.forEach(t => {
    csv += `"${t.id}","${t.mode}",${t.round},"${t.name}","${t.phone}","${t.regId}","${t.createdAt}"\n`;
  });
  return csv;
}

function triggerDownload(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadCSV() {
  const csv = exportFullCSV();
  const ts = new Date().toISOString().slice(0,10);
  triggerDownload(csv, `spin-draw-report-${ts}.csv`, 'text/csv');
  showDataMsg('✅ Full CSV report downloaded!', '#4ecdc4');
}

function downloadWinnersCSV() {
  const csv = exportWinnersCSV();
  const ts = new Date().toISOString().slice(0,10);
  triggerDownload(csv, `spin-draw-winners-${ts}.csv`, 'text/csv');
  showDataMsg('✅ Winners CSV downloaded!', '#4ecdc4');
}

function downloadTicketsCSV() {
  const csv = exportTicketsCSV();
  const ts = new Date().toISOString().slice(0,10);
  triggerDownload(csv, `spin-draw-tickets-${ts}.csv`, 'text/csv');
  showDataMsg('✅ Tickets CSV downloaded!', '#4ecdc4');
}

/* ============ EXPORT/IMPORT: JSON BACKUP ============ */
function downloadJSON() {
  // Create a clean copy without screenshots for smaller file
  const backup = JSON.parse(JSON.stringify(state));
  backup.registrations.forEach(r => {
    if (r.status === 'approved' || r.status === 'rejected') {
      r.screenshot = '[removed to save space]';
    }
  });
  const json = JSON.stringify(backup, null, 2);
  const ts = new Date().toISOString().slice(0,16).replace(/[:T]/g, '-');
  triggerDownload(json, `spin-draw-backup-${ts}.json`, 'application/json');
  showDataMsg('✅ Full JSON backup downloaded!', '#4ecdc4');
}

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!confirm('⚠️ This will REPLACE all current data with the backup. Continue?')) {
    event.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      // Validate basic structure
      if (!imported.rounds || !imported.tickets || !imported.registrations) {
        throw new Error('Invalid backup file structure');
      }
      state = imported;
      save();
      showDataMsg('✅ Backup restored successfully! Refreshing...', '#4ecdc4');
      setTimeout(() => location.reload(), 1500);
    } catch(err) {
      showDataMsg('❌ Invalid file: ' + err.message, '#ff6b6b');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

/* ============ CLEANUP ============ */
function cleanupScreenshots() {
  const before = getStorageUsage();
  let count = 0;
  state.registrations.forEach(r => {
    if ((r.status === 'approved' || r.status === 'rejected') && r.screenshot && !r.screenshot.startsWith('[')) {
      r.screenshot = '[removed after ' + r.status + ']';
      count++;
    }
  });
  save();
  const after = getStorageUsage();
  const freed = before - after;
  showDataMsg(`🧹 Removed ${count} screenshot(s). Freed ${formatBytes(freed)}.`, '#f39c12');
  updateStorageMonitor();
  if (adminLoggedIn) renderAdmin();
}

function clearCompletedRounds() {
  const modes = ['mini', 'standard'];
  let cleared = false;
  modes.forEach(mode => {
    const r = state.rounds[mode];
    if (r.status === 'completed') {
      const roundNum = r.round;
      state.registrations = state.registrations.filter(x => !(x.mode === mode && x.round === roundNum));
      state.tickets = state.tickets.filter(t => !(t.mode === mode && t.round === roundNum));
      cleared = true;
    }
  });
  if (!cleared) {
    showDataMsg('⚠️ No completed rounds to clear.', '#f39c12');
    return;
  }
  save();
  showDataMsg('✅ Completed round data cleared!', '#4ecdc4');
  updateStorageMonitor();
  if (adminLoggedIn) renderAdmin();
}

function clearAllData() {
  if (!confirm('💣 FACTORY RESET: This will delete ALL data permanently. Are you sure?')) return;
  if (!confirm('⚠️ LAST CHANCE: Download a backup first! Really delete everything?')) return;
  state = defaultState();
  save();
  showDataMsg('🗑️ All data deleted.', '#ff6b6b');
  setTimeout(() => location.reload(), 1500);
}

function showDataMsg(text, color) {
  const el = document.getElementById('dataMsg');
  if (el) el.innerHTML = `<p style="color:${color}; font-weight:bold;">${text}</p>`;
}

function updateStorageMonitor() {
  const used = getStorageUsage();
  const limit = 5 * 1024 * 1024; // 5MB
  const pct = Math.min(100, (used / limit) * 100);
  const fill = document.getElementById('storageFill');
  const text = document.getElementById('storageText');
  if (fill && text) {
    fill.style.width = pct + '%';
    fill.className = 'storage-fill ' + (pct < 50 ? 'low' : pct < 80 ? 'medium' : 'high');
    text.textContent = `${formatBytes(used)} / 5 MB (${pct.toFixed(1)}%)`;
  }
}