let adminLoggedIn = false;
let currentAdminPendingMode = 'mini';
let currentAdminApprovedMode = 'mini';
let currentAdminWinnersMode = 'mini';

function adminLogin() {
  if (document.getElementById('adminPass').value === ADMIN_PASSWORD) {
    adminLoggedIn = true;
    document.getElementById('adminLogin').classList.add('hidden');
    document.getElementById('adminDash').classList.remove('hidden');
    renderAdmin();
  } else {
    alert('❌ Wrong password');
  }
}

function showAdminMode(mode, btn) {
  currentAdminPendingMode = mode;
  btn.parentElement.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderPendingList();
}

function showApprovedMode(mode, btn) {
  currentAdminApprovedMode = mode;
  btn.parentElement.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderApprovedList();
}

function showWinnersMode(mode, btn) {
  currentAdminWinnersMode = mode;
  btn.parentElement.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderWinners();
}

function renderAdmin() {
  if (!adminLoggedIn) return;
  updateStorageMonitor();

  ['mini', 'standard'].forEach(mode => {
    const r = state.rounds[mode];
    const target = getTarget(mode);
    document.getElementById('adminRound-' + mode).textContent = r.round;
    document.getElementById('adminCollected-' + mode).textContent = r.collected.toLocaleString();
    document.getElementById('adminTickets-' + mode).textContent =
      state.tickets.filter(t => t.mode === mode && t.round === r.round).length;
    const pending = state.registrations.filter(x => x.mode === mode && x.status === 'pending' && x.round === r.round);
    document.getElementById('adminPending-' + mode).textContent = pending.length;
    document.getElementById('adminStatus-' + mode).textContent = r.status.toUpperCase();
    const pct = Math.min(100, (r.collected / target) * 100);
    const bar = document.getElementById('adminProgress-' + mode);
    bar.style.width = pct + '%';
    bar.textContent = pct.toFixed(1) + '%';
    document.getElementById('startSpinBtn-' + mode).disabled =
      !(r.collected >= target && r.status === 'collecting' &&
        state.tickets.filter(t => t.mode === mode && t.round === r.round).length >= 4);
  });

  const unread = getUnreadMessageCount();
const totalChats = new Set(state.messages.map(m => m.phone)).size;
document.getElementById('adminMessages').innerHTML = 
  `<span style="color:#ffcc00;">${unread}</span> unread / ${totalChats} chats`;
  renderPendingList();
  renderAdminChatList();
  renderUserList();
  renderCreditLedger();
  renderApprovedList();
  renderWinners();
}

function renderPendingList() {
  const mode = currentAdminPendingMode;
  const r = state.rounds[mode];
  const pending = state.registrations.filter(x => x.mode === mode && x.status === 'pending' && x.round === r.round);
  const pl = document.getElementById('pendingList');
  const price = getMode(mode).ticketPrice;

  if (pending.length === 0) {
    pl.innerHTML = `<p style="opacity:.6;">No pending in ${getMode(mode).name} mode.</p>`;
    return;
  }
  pl.innerHTML = pending.map(x => {
    const suggested = Math.floor(x.amount / price);
    const remainder = x.amount - suggested * price;
    const isOdd = remainder > 0;
    const hasScreenshot = x.screenshot && !x.screenshot.startsWith('[');
    const userCredits = state.credits.filter(c => c.phone === x.phone && !c.used);
    const totalCredit = userCredits.reduce((s, c) => s + c.amount, 0);

    return `
    <div class="pending-item ${isOdd ? 'warning' : ''}">
      <div class="top">
        <div class="thumb" onclick="${hasScreenshot ? `viewImage('${x.id}')` : ''}">
          ${hasScreenshot
            ? `<img src="${x.screenshot}" alt="Screenshot" />`
            : `<div style="display:flex;align-items:center;justify-content:center;height:100%;opacity:.5;font-size:12px;">No image</div>`}
        </div>
        <div class="details">
          <div><strong>Name:</strong> <input type="text" id="name-${x.id}" value="${escapeHtml(x.name)}" /></div>
          <div><strong>Phone:</strong> <input type="tel" id="phone-${x.id}" value="${escapeHtml(x.phone)}" /></div>
          <div><strong>Claimed:</strong> ${x.amount.toLocaleString()} ETB</div>
          <div><strong>Note:</strong> ${escapeHtml(x.note || '—')}</div>
          <div><strong>ID:</strong> <code>${x.id}</code></div>
          <div><strong>Time:</strong> ${new Date(x.timestamp).toLocaleString()}</div>
          ${totalCredit > 0 ? `<div style="color:#c39bd3;">💜 User has <strong>${totalCredit} ETB</strong> credit</div>` : ''}
          ${isOdd
            ? `<div class="amount-warn">⚠️ ${x.amount} ETB = ${suggested} ticket(s) + ${remainder} ETB remainder</div>`
            : `<div class="amount-ok">✅ Exact: ${suggested} ticket(s)</div>`}
        </div>
      </div>
      <div class="admin-actions">
        <div class="row">
          <label>🎫 Tickets:</label>
          <input type="number" id="tickets-${x.id}" value="${suggested}" min="0" max="500" oninput="updateAdminSummary('${x.id}','${mode}')" />
          <span id="summary-${x.id}" style="font-size:13px;"></span>
        </div>
        <div class="row">
          <label>💜 Credit:</label>
          <input type="number" id="credit-${x.id}" value="${remainder}" min="0" style="width:100px;" />
          <span style="font-size:12px; opacity:.7;">ETB for next round</span>
        </div>
        <div class="row">
          <label>📝 Note:</label>
          <input type="text" id="note-${x.id}" placeholder="Optional" />
        </div>
        <div class="row">
          <button class="btn btn-sm" onclick="approveReg('${x.id}','${mode}')">✅ Approve & Cut</button>
          <button class="btn btn-sm btn-danger" onclick="rejectReg('${x.id}','${mode}')">❌ Reject</button>
          <button class="btn btn-sm btn-warning" onclick="openAdminChat('${x.phone}')">💬 Chat</button>
        </div>
      </div>
    </div>`;
  }).join('');
  pending.forEach(x => updateAdminSummary(x.id, mode));
}

function updateAdminSummary(regId, mode) {
  const reg = state.registrations.find(r => r.id === regId);
  if (!reg) return;
  const t = parseInt(document.getElementById('tickets-' + regId)?.value) || 0;
  const c = parseInt(document.getElementById('credit-' + regId)?.value) || 0;
  const price = getMode(mode).ticketPrice;
  const total = t * price + c;
  const diff = reg.amount - total;
  const el = document.getElementById('summary-' + regId);
  if (!el) return;
  if (diff === 0) el.innerHTML = `<span style="color:#4ecdc4;">✅ ${t} ticket(s) + ${c} credit = ${total} ETB</span>`;
  else if (diff > 0) el.innerHTML = `<span style="color:#f39c12;">⚠️ ${diff} ETB unaccounted</span>`;
  else el.innerHTML = `<span style="color:#ff6b6b;">❌ Exceeds by ${-diff} ETB</span>`;
}

function viewImage(regId) {
  const reg = state.registrations.find(r => r.id === regId);
  if (!reg || !reg.screenshot || reg.screenshot.startsWith('[')) return;
  document.getElementById('imgModalSrc').src = reg.screenshot;
  document.getElementById('imgModal').classList.add('show');
}

function approveReg(regId, mode) {
  const reg = state.registrations.find(r => r.id === regId);
  if (!reg) return;
  const newName = document.getElementById('name-' + regId).value.trim();
  const newPhone = document.getElementById('phone-' + regId).value.trim();
  const ticketCount = parseInt(document.getElementById('tickets-' + regId).value);
  const creditAmt = parseInt(document.getElementById('credit-' + regId).value) || 0;
  const adminNote = document.getElementById('note-' + regId).value.trim();
  const price = getMode(mode).ticketPrice;
  const r = state.rounds[mode];

  if (!newName || !newPhone) { alert('⚠️ Name and phone required.'); return; }
  if (isNaN(ticketCount) || ticketCount < 0) { alert('⚠️ Invalid ticket count.'); return; }

  if (ticketCount === 0 && creditAmt === 0) {
    if (!confirm('Issue 0 tickets?')) return;
    reg.status = 'rejected';
    reg.rejectReason = adminNote || 'Admin issued 0 tickets';
    save(); renderAdmin(); return;
  }

  reg.status = 'approved';
  reg.name = newName;
  reg.phone = newPhone;
  reg.ticketsIssued = ticketCount;
  reg.creditIssued = creditAmt;

  for (let i = 0; i < ticketCount; i++) {
    state.tickets.push({
      id: generateTicketId(mode), mode,
      name: newName, phone: newPhone,
      regId: reg.id, round: r.round,
      createdAt: new Date().toISOString()
    });
    r.ticketCounter++;
  }
  r.collected += ticketCount * price;

  if (creditAmt > 0) {
    state.credits.push({
      phone: newPhone, name: newName, mode,
      amount: creditAmt, fromRound: r.round,
      note: adminNote || `Extra from ${reg.amount} ETB`,
      used: false, createdAt: new Date().toISOString()
    });
  }

  // 🧹 Auto-remove screenshot after approval to save storage
  reg.screenshot = '[removed after approval]';

  state.messages.push({
    id: 'MSG-' + Date.now(),
    phone: newPhone, name: newName, mode,
    text: `✅ Approved! ${ticketCount} ticket(s) in ${getMode(mode).name} mode.${creditAmt > 0 ? ` ${creditAmt} ETB credit saved.` : ''} Good luck!`,
    from: 'admin', timestamp: new Date().toISOString(), read: false
  });

  save(); renderAdmin(); updateLiveView(mode);
}

function rejectReg(regId, mode) {
  const reason = prompt('Reason for rejection:');
  if (reason === null) return;
  const reg = state.registrations.find(r => r.id === regId);
  if (!reg) return;
  reg.status = 'rejected';
  reg.rejectReason = reason || 'Not verified';
  reg.screenshot = '[removed after rejection]';

  state.messages.push({
    id: 'MSG-' + Date.now(),
    phone: reg.phone, name: reg.name, mode,
    text: `❌ Rejected in ${getMode(mode).name} mode: ${reason || 'Payment not verified'}`,
    from: 'admin', timestamp: new Date().toISOString(), read: false
  });

  save(); renderAdmin();
}

function renderCreditLedger() {
  const active = state.credits.filter(c => !c.used);
  const cl = document.getElementById('creditLedger');
  if (active.length === 0) { cl.innerHTML = '<p style="opacity:.6;">No active credits.</p>'; return; }
  cl.innerHTML = active.map(c => `
    <div class="ledger-item">
      <div>💜 <strong>${c.name}</strong> (${c.phone}) — <strong>${c.amount} ETB</strong> [${c.mode}]</div>
      <div style="opacity:.8;">From Round ${c.fromRound}</div>
    </div>
  `).join('');
}

function renderApprovedList() {
  const mode = currentAdminApprovedMode;
  const r = state.rounds[mode];
  const approved = state.tickets.filter(t => t.mode === mode && t.round === r.round);
  const al = document.getElementById('approvedList');
  if (approved.length === 0) {
    al.innerHTML = `<p style="opacity:.6;">No tickets in ${getMode(mode).name} mode.</p>`; return;
  }
  al.innerHTML = approved.map(t => `
    <div class="ticket" style="margin-bottom:5px; padding:10px;">
      <div>🎫 ${t.name} • ${t.phone}</div><div class="id">${t.id}</div>
    </div>
  `).join('');
}

function renderWinners() {
  const mode = currentAdminWinnersMode;
  const r = state.rounds[mode];
  const roundWinners = state.winners.filter(w => w.mode === mode && w.round === r.round);
  const wl = document.getElementById('adminWinners');
  if (roundWinners.length === 0) {
    wl.innerHTML = `<p style="opacity:.6;">No winners in ${getMode(mode).name} mode.</p>`; return;
  }
  wl.innerHTML = roundWinners.map((w, i) => `
    <div class="winner-row">
      <div>🏆 <strong>${['1st','2nd','3rd','4th'][i]} Prize</strong><br>${w.name} (${w.phone})</div>
      <div style="text-align:right;">
        <div style="color:#ffcc00; font-weight:bold;">${w.prize.label}</div>
        <div style="font-family:monospace; font-size:12px;">${w.ticket.id}</div>
      </div>
    </div>
  `).join('');
}

function adminResetRound(mode) {
  if (!confirm(`Reset ${getMode(mode).name} round?`)) return;
  const r = state.rounds[mode].round;
  state.registrations = state.registrations.filter(x => !(x.mode === mode && x.round === r));
  state.tickets = state.tickets.filter(t => !(t.mode === mode && t.round === r));
  state.winners = state.winners.filter(w => !(w.mode === mode && w.round === r));
  state.rounds[mode].collected = 0;
  state.rounds[mode].status = 'collecting';
  save(); renderAdmin(); updateLiveView(mode);
}