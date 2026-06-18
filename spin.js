/* ============ WHEEL DRAWING (per mode) ============ */
const wheelCanvases = {};
const wheelRotations = { mini: 0, standard: 0 };

function initWheel(mode) {
  const canvas = document.getElementById('wheel-' + mode);
  const ctx = canvas.getContext('2d');
  wheelCanvases[mode] = { canvas, ctx, size: canvas.width, center: canvas.width / 2 };
  drawWheel(mode, 0);
}

function drawWheel(mode, rotation) {
  const w = wheelCanvases[mode];
  if (!w) return;
  const prizes = getPrizes(mode);
  const segAngle = (2 * Math.PI) / prizes.length;
  const radius = w.center - 10;
  w.ctx.clearRect(0, 0, w.size, w.size);
  w.ctx.save();
  w.ctx.translate(w.center, w.center);
  w.ctx.rotate(rotation);
  for (let i = 0; i < prizes.length; i++) {
    const start = i * segAngle;
    const end = start + segAngle;
    w.ctx.beginPath();
    w.ctx.moveTo(0, 0);
    w.ctx.arc(0, 0, radius, start, end);
    w.ctx.closePath();
    w.ctx.fillStyle = prizes[i].color;
    w.ctx.fill();
    w.ctx.strokeStyle = '#fff';
    w.ctx.lineWidth = 3;
    w.ctx.stroke();

    w.ctx.save();
    w.ctx.rotate(start + segAngle / 2);
    w.ctx.textAlign = 'right';
    w.ctx.fillStyle = '#222';
    w.ctx.font = 'bold 22px Segoe UI';
    w.ctx.fillText(prizes[i].label, radius - 20, 8);
    w.ctx.restore();
  }
  w.ctx.restore();
}

/* ============ LIVE VIEW (per mode) ============ */
function updateLiveView(mode) {
  const r = state.rounds[mode];
  const target = getTarget(mode);
  document.getElementById('liveTarget-' + mode).textContent = target.toLocaleString() + ' ETB';
  document.getElementById('liveCollected-' + mode).textContent = r.collected.toLocaleString();
  document.getElementById('liveTickets-' + mode).textContent = 
    state.tickets.filter(t => t.mode === mode && t.round === r.round).length;
  document.getElementById('liveStatus-' + mode).textContent = r.status.toUpperCase();
  const pct = Math.min(100, (r.collected / target) * 100);
  const bar = document.getElementById('liveProgress-' + mode);
  bar.style.width = pct + '%';
  bar.textContent = pct.toFixed(1) + '%';

  const winners = state.winners.filter(w => w.mode === mode && w.round === r.round);
  const wl = document.getElementById('roundWinners-' + mode);
  if (winners.length > 0) {
    wl.innerHTML = '<h3 style="color:#ffcc00; margin:12px 0 8px;">🏆 Winners</h3>' +
      winners.map((w, i) => `
        <div class="winner-row">
          <div>🏆 <strong>${['1st','2nd','3rd','4th'][i]}</strong> — ${w.name}</div>
          <div style="color:#ffcc00;">${w.prize.label}</div>
        </div>
      `).join('');
  } else {
    wl.innerHTML = '';
  }

  const msg = document.getElementById('spinMessage-' + mode);
  if (r.status === 'collecting') {
    msg.textContent = r.collected >= target
      ? '✅ Round full! Waiting for admin...'
      : `Collecting... ${r.collected.toLocaleString()} / ${target.toLocaleString()} ETB`;
  } else if (r.status === 'spinning') {
    msg.textContent = `🎰 Drawing...`;
  } else if (r.status === 'completed') {
    msg.textContent = '🎉 Round completed!';
  }
}

/* ============ SPIN TABS (user) ============ */
let currentSpinMode = 'mini';
function showSpinMode(mode, btn) {
  currentSpinMode = mode;
  document.querySelectorAll('.spin-mode-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.spin-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('spin-' + mode).classList.add('active');
  btn.classList.add('active');
  updateLiveView(mode);
}

/* ============ SPIN LOGIC (per mode) ============ */
const spinState = { mini: {}, standard: {} };

function adminStartSpin(mode) {
  const r = state.rounds[mode];
  if (r.status !== 'collecting') return;
  const tickets = state.tickets.filter(t => t.mode === mode && t.round === r.round);
  if (tickets.length < 4) { alert('Need at least 4 tickets.'); return; }
  r.status = 'spinning';
  spinState[mode] = { drawIndex: 0, eligible: [...tickets] };
  save();
  renderAdmin();
  updateLiveView(mode);
  drawNextPrize(mode);
}

function drawNextPrize(mode) {
  const ss = spinState[mode];
  if (ss.drawIndex >= 4) {
    state.rounds[mode].status = 'completed';
    save(); renderAdmin(); updateLiveView(mode);
    document.getElementById('spinMessage-' + mode).textContent = '🎉 Round complete!';
    return;
  }
  const prize = getPrizes(mode)[ss.drawIndex];
  const winnerIdx = Math.floor(Math.random() * ss.eligible.length);
  const winner = ss.eligible[winnerIdx];
  const r = state.rounds[mode];

  spinWheelToSegment(mode, ss.drawIndex, () => {
    state.winners.push({
      mode, prize, ticket: winner,
      name: winner.name, phone: winner.phone,
      round: r.round
    });
    state.messages.push({
      id: 'MSG-' + Date.now(),
      phone: winner.phone, name: winner.name, mode,
      text: `🎉 CONGRATULATIONS! You won ${prize.label} in ${getMode(mode).name} mode, Round ${r.round}! Ticket: ${winner.id}`,
      from: 'admin',
      timestamp: new Date().toISOString(),
      read: false
    });
    ss.eligible.splice(winnerIdx, 1);
    save();
    showWinnerModal(mode, prize, winner, ss.drawIndex);
  });
}

function spinWheelToSegment(mode, targetIndex, onDone) {
  const ss = spinState[mode];
  if (ss.spinning) return;
  ss.spinning = true;
  const prizes = getPrizes(mode);
  const segAngle = (2 * Math.PI) / prizes.length;
  const fullSpins = 6 + Math.floor(Math.random() * 3);
  const targetCenter = targetIndex * segAngle + segAngle / 2;
  const jitter = (Math.random() - 0.5) * segAngle * 0.6;
  const targetRotation = -Math.PI / 2 - targetCenter + fullSpins * 2 * Math.PI;
  const finalRotation = wheelRotations[mode] + targetRotation + jitter;
  const startRotation = wheelRotations[mode];
  const delta = finalRotation - startRotation;
  const duration = 5000;
  const startTime = performance.now();

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function animate(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    const eased = easeOutCubic(t);
    wheelRotations[mode] = startRotation + delta * eased;
    drawWheel(mode, wheelRotations[mode]);
    if (t < 1) requestAnimationFrame(animate);
    else { ss.spinning = false; onDone(); }
  }
  requestAnimationFrame(animate);
}

function showWinnerModal(mode, prize, ticket, drawIdx) {
  document.getElementById('modalTitle').textContent = `🎉 ${['1st','2nd','3rd','4th'][drawIdx]} PRIZE — ${getMode(mode).name} Mode!`;
  document.getElementById('modalPrize').textContent = prize.label;
  document.getElementById('modalWinner').textContent = `👤 ${ticket.name}`;
  document.getElementById('modalTicket').textContent = `🎫 ${ticket.id} • ${ticket.phone}`;
  document.getElementById('modalMode').textContent = `${getMode(mode).icon} ${getMode(mode).name} Mode — Round ${state.rounds[mode].round}`;
  document.getElementById('modalBtn').textContent = drawIdx < 3 ? '🎯 Next Draw' : '🏁 Finish Round';
  document.getElementById('winnerModal').classList.add('show');
  spinState[mode].lastMode = mode;
}

function closeWinnerModal() {
  const mode = spinState[Object.keys(spinState).find(m => spinState[m].lastMode)]?.lastMode || 'mini';
  const actualMode = Object.keys(spinState).find(m => spinState[m].lastMode) || 'mini';
  document.getElementById('winnerModal').classList.remove('show');
  const ss = spinState[actualMode];
  ss.drawIndex++;
  renderAdmin();
  updateLiveView(actualMode);
  if (ss.drawIndex < 4) setTimeout(() => drawNextPrize(actualMode), 500);
  else {
    state.rounds[actualMode].status = 'completed';
    save(); renderAdmin(); updateLiveView(actualMode);
    if (confirm(`🎉 ${getMode(actualMode).name} round complete! Start a new round?`)) {
      startNewRound(actualMode);
    }
  }
}

function startNewRound(mode) {
  state.rounds[mode].round++;
  state.rounds[mode].collected = 0;
  state.rounds[mode].status = 'collecting';
  state.rounds[mode].ticketCounter = 1;
  save(); renderAdmin(); updateLiveView(mode);
}