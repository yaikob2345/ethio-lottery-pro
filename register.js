function getSelectedMode() {
  return document.querySelector('input[name="regMode"]:checked').value;
}

function updateRegisterNotice() {
  const mode = getSelectedMode();
  const m = getMode(mode);
  const target = getTarget(mode);
  const notice = document.getElementById('registerNotice');
  notice.innerHTML = `💡 <strong>${m.icon} ${m.name} Mode:</strong> Each ticket = <strong>${m.ticketPrice} ETB</strong>.<br>
    Target: ${m.maxUsers} users × ${m.ticketPrice} ETB = <strong>${target.toLocaleString()} ETB</strong><br>
    Prizes: ${m.prizes.map(p => p.label).join(' • ')}<br>
    <em>⚠️ Pay exact multiples of ${m.ticketPrice} ETB.</em>`;
  showAmountHint();
}

function showAmountHint() {
  const amt = parseInt(document.getElementById('userAmount').value);
  const hint = document.getElementById('amountHint');
  const price = getMode(getSelectedMode()).ticketPrice;
  if (!amt || amt <= 0) { hint.innerHTML = ''; return; }
  if (amt < price) {
    hint.innerHTML = `<div class="amount-warn">⚠️ Minimum is ${price} ETB</div>`;
  } else if (amt % price !== 0) {
    const tickets = Math.floor(amt / price);
    const remainder = amt - tickets * price;
    hint.innerHTML = `<div class="amount-warn">⚠️ ${amt} ETB = ${tickets} ticket(s) + ${remainder} ETB remainder.<br>
      Admin will issue ${tickets} ticket(s) and keep ${remainder} ETB as credit.</div>`;
  } else {
    const tickets = amt / price;
    hint.innerHTML = `<div class="amount-ok">✅ ${amt} ETB = ${tickets} ticket(s). Perfect!</div>`;
  }
}

function previewImage(e) {
  const file = e.target.files[0];
  const preview = document.getElementById('previewImg');
  if (!file) { preview.style.display = 'none'; return; }
  if (file.size > 2 * 1024 * 1024) {
    alert('⚠️ Image too large. Please use under 2MB.');
    e.target.value = '';
    preview.style.display = 'none';
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => { preview.src = ev.target.result; preview.style.display = 'block'; };
  reader.readAsDataURL(file);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function submitRegistration() {
  const mode = getSelectedMode();
  const name = document.getElementById('userName').value.trim();
  const phone = document.getElementById('userPhone').value.trim();
  const amount = parseInt(document.getElementById('userAmount').value);
  const note = document.getElementById('userNote').value.trim();
  const fileInput = document.getElementById('userScreenshot');
  const msg = document.getElementById('regMsg');
  const price = getMode(mode).ticketPrice;

  if (!name || !phone || !amount || !fileInput.files[0]) {
    msg.innerHTML = '<p style="color:#ff6b6b;">⚠️ Please fill all fields and upload screenshot.</p>';
    return;
  }
  if (amount < price) {
    msg.innerHTML = `<p style="color:#ff6b6b;">⚠️ Minimum payment is ${price} ETB for ${mode} mode.</p>`;
    return;
  }
  if (state.rounds[mode].status !== 'collecting') {
    msg.innerHTML = '<p style="color:#ff6b6b;">⚠️ This mode is not accepting registrations right now.</p>';
    return;
  }

  const screenshot = await fileToBase64(fileInput.files[0]);
  const reg = {
    id: 'REG-' + Date.now(),
    mode, name, phone, amount, note, screenshot,
    status: 'pending',
    round: state.rounds[mode].round,
    timestamp: new Date().toISOString()
  };
  state.registrations.push(reg);

  state.messages.push({
    id: 'MSG-' + Date.now(),
    phone, name, mode,
    text: `Hi, I just registered for ${getMode(mode).name} mode with ${amount} ETB. Please verify.`,
    from: 'user',
    timestamp: new Date().toISOString(),
    read: false
  });
  save();

  const suggestedTickets = Math.floor(amount / price);
  const remainder = amount - suggestedTickets * price;
  let extraNote = '';
  if (remainder > 0) {
    extraNote = `<br>⚠️ ${remainder} ETB remainder will be kept as credit.`;
  }
  msg.innerHTML = `<p style="color:#4ecdc4;">✅ Submitted to <strong>${getMode(mode).name} mode</strong>!<br>
    Reference: <strong>${reg.id}</strong><br>
    Chat with admin in 💬 Chat tab.${extraNote}</p>`;

  document.getElementById('userName').value = '';
  document.getElementById('userPhone').value = '';
  document.getElementById('userAmount').value = '';
  document.getElementById('userNote').value = '';
  document.getElementById('amountHint').innerHTML = '';
  fileInput.value = '';
  document.getElementById('previewImg').style.display = 'none';
}

function lookupTickets() {
  const phone = document.getElementById('lookupPhone').value.trim();
  const list = document.getElementById('ticketList');
  if (!phone) { list.innerHTML = '<p style="color:#ff6b6b;">Enter your phone.</p>'; return; }

  const myCredits = state.credits.filter(c => c.phone === phone && !c.used);
  const myPending = state.registrations.filter(r => r.phone === phone && r.status === 'pending');
  const myRejected = state.registrations.filter(r => r.phone === phone && r.status === 'rejected');

  let html = '';

  if (myCredits.length > 0) {
    html += '<h3 style="color:#9b59b6; margin-bottom:8px;">💜 Your Credits</h3>';
    myCredits.forEach(c => {
      html += `<div class="ledger-item">
        <div>💜 <strong>${c.amount} ETB</strong> from Round ${c.fromRound} (${c.mode})</div>
      </div>`;
    });
  }

  ['mini', 'standard'].forEach(mode => {
    const m = getMode(mode);
    const r = state.rounds[mode].round;
    const tickets = state.tickets.filter(t => t.phone === phone && t.mode === mode && t.round === r);
    const pending = myPending.filter(p => p.mode === mode);
    const rejected = myRejected.filter(p => p.mode === mode);

    html += `<h3 style="color:#ffcc00; margin:15px 0 8px;">${m.icon} ${m.name} Mode — Round ${r}</h3>`;

    if (pending.length > 0) {
      pending.forEach(p => {
        html += `<div class="ticket" style="background:linear-gradient(135deg,#f39c12,#e67e22);">
          <div>⏳ ${p.amount} ETB claimed</div><div class="id">${p.id}</div></div>`;
      });
    }
    if (rejected.length > 0) {
      rejected.forEach(p => {
        html += `<div class="ticket" style="background:linear-gradient(135deg,#ff6b6b,#c0392b);">
          <div>❌ ${p.amount} ETB — ${p.rejectReason || 'Not verified'}</div></div>`;
      });
    }
    if (tickets.length > 0) {
      tickets.forEach(t => {
        html += `<div class="ticket">
          <div>🎫 ${t.name}</div><div class="id">${t.id}</div></div>`;
      });
    }
    if (pending.length === 0 && rejected.length === 0 && tickets.length === 0) {
      html += '<p style="opacity:.6;">No activity in this mode.</p>';
    }
  });

  list.innerHTML = html;
}