let currentUserChatPhone = null;
let currentUserChatName = null;
let currentAdminChatPhone = null;

/* ============ USER CHAT ============ */
function openUserChat() {
  const phone = document.getElementById('chatPhone').value.trim();
  const name = document.getElementById('chatName').value.trim();
  if (!phone) { alert('⚠️ Please enter your phone number.'); return; }

  currentUserChatPhone = phone;
  const existingReg = state.registrations.find(r => r.phone === phone);
  const existingMsg = state.messages.find(m => m.phone === phone && m.from === 'user');
  currentUserChatName = name || existingReg?.name || existingMsg?.name || 'Guest';

  const hasHistory = state.messages.some(m => m.phone === phone);
  if (!hasHistory) {
    state.messages.push({
      id: 'MSG-' + Date.now(),
      phone, name: currentUserChatName,
      text: `Hi admin, this is ${currentUserChatName}. I'd like to ask something.`,
      from: 'user', timestamp: new Date().toISOString(), read: false
    });
    save();
  }

  renderUserChat();
  if (window._userChatInterval) clearInterval(window._userChatInterval);
  window._userChatInterval = setInterval(renderUserChat, 10000);
}

function renderUserChat() {
  if (!currentUserChatPhone) return;
  const area = document.getElementById('chatArea');
  const msgs = state.messages.filter(m => m.phone === currentUserChatPhone)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const unreadFromAdmin = msgs.filter(m => m.from === 'admin' && !m.read).length;
  if (unreadFromAdmin > 0) {
    msgs.forEach(m => { if (m.from === 'admin') m.read = true; });
    save();
  }

  let html = `
    <div class="chat-info">
      <span>📱 ${currentUserChatPhone} • 👤 ${currentUserChatName}</span>
      <span class="count">${msgs.length} message(s)</span>
    </div>
    <div class="chat-messages">`;

  if (msgs.length === 0) {
    html += `<p style="opacity:.6; text-align:center; padding:20px;">
      No messages yet. Type below to start chatting!</p>`;
  } else {
    msgs.forEach(m => {
      html += `<div class="chat-msg ${m.from}">
        ${escapeHtml(m.text)}
        <span class="time">${new Date(m.timestamp).toLocaleString()}</span>
      </div>`;
    });
  }

  html += `</div>
    <div class="chat-input">
      <input type="text" id="userMsgInput" placeholder="Type your message..." 
        maxlength="2000"
        onkeypress="if(event.key==='Enter')sendUserMessage()" />
      <button class="btn btn-sm" onclick="sendUserMessage()">📤 Send</button>
    </div>
    <p style="font-size:11px; opacity:.6; margin-top:5px;">
      💬 No message limit • Auto-refresh every 7s
    </p>`;
  area.innerHTML = html;

  const box = area.querySelector('.chat-messages');
  if (box) box.scrollTop = box.scrollHeight;
}

function sendUserMessage() {
  const input = document.getElementById('userMsgInput');
  const text = input.value.trim();
  if (!text || !currentUserChatPhone) return;
  if (text.length > 2000) { alert('⚠️ Message too long (max 2000 chars).'); return; }

  state.messages.push({
    id: 'MSG-' + Date.now() + '-' + Math.floor(Math.random()*1000),
    phone: currentUserChatPhone,
    name: currentUserChatName,
    text, from: 'user',
    timestamp: new Date().toISOString(),
    read: false
  });
  save();
  input.value = '';
  renderUserChat();
}

/* ============ 👥 USER LIST (Admin clicks to chat) ============ */
function renderUserList() {
  const container = document.getElementById('userListContainer');
  if (!container) return;

  const search = (document.getElementById('userSearchInput')?.value || '').toLowerCase().trim();

  // Build unique user list from registrations
  const userMap = {};
  state.registrations.forEach(r => {
    if (!userMap[r.phone]) {
      userMap[r.phone] = {
        name: r.name,
        phone: r.phone,
        modes: new Set(),
        totalAmount: 0,
        tickets: 0,
        status: r.status,
        lastTime: r.timestamp
      };
    }
    const u = userMap[r.phone];
    u.modes.add(r.mode);
    u.totalAmount += r.amount;
    if (r.status === 'approved') {
      u.tickets += (r.ticketsIssued || 0);
    }
    if (new Date(r.timestamp) > new Date(u.lastTime)) {
      u.lastTime = r.timestamp;
      u.status = r.status;
      u.name = r.name; // use latest name
    }
  });

  // Also include users who have chatted but never registered
  state.messages.forEach(m => {
    if (m.from === 'user' && !userMap[m.phone]) {
      userMap[m.phone] = {
        name: m.name,
        phone: m.phone,
        modes: new Set(),
        totalAmount: 0,
        tickets: 0,
        status: 'chat-only',
        lastTime: m.timestamp
      };
    }
  });

  let users = Object.values(userMap);

  // Filter by search
  if (search) {
    users = users.filter(u =>
      u.name.toLowerCase().includes(search) ||
      u.phone.includes(search)
    );
  }

  // Sort: most recent first
  users.sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));

  if (users.length === 0) {
    container.innerHTML = `<p style="opacity:.6; padding:10px;">
      ${search ? 'No users match your search.' : 'No registered users yet.'}</p>`;
    return;
  }

  container.innerHTML = `
    <div class="user-count">👥 ${users.length} user(s)</div>
    <div class="user-list">
      ${users.map(u => {
        const modeIcons = Array.from(u.modes).map(m => getMode(m)?.icon || '').join(' ');
        const unread = state.messages.filter(m => m.phone === u.phone && m.from === 'user' && !m.read).length;
        const statusBadge = {
          'pending': '<span class="status-badge pending">⏳ Pending</span>',
          'approved': '<span class="status-badge approved">✅ Approved</span>',
          'rejected': '<span class="status-badge rejected">❌ Rejected</span>',
          'chat-only': '<span class="status-badge chat-only">💬 Chat only</span>'
        }[u.status] || '';

        return `
        <div class="user-list-item" onclick="adminChatWithUser('${u.phone}', '${escapeHtml(u.name).replace(/'/g, "\\'")}')">
          <div class="user-avatar">${u.name.charAt(0).toUpperCase()}</div>
          <div class="user-info">
            <div class="user-name">
              ${escapeHtml(u.name)}
              ${unread > 0 ? `<span class="unread-dot">${unread}</span>` : ''}
            </div>
            <div class="user-meta">
              📱 ${u.phone} ${modeIcons} ${statusBadge}
            </div>
            <div class="user-stats">
              💰 ${u.totalAmount.toLocaleString()} ETB • 🎫 ${u.tickets} ticket(s)
              <span style="opacity:.6; font-size:10px;">• ${timeAgo(u.lastTime)}</span>
            </div>
          </div>
          <div class="user-action">💬</div>
        </div>`;
      }).join('')}
    </div>
  `;
}

/* Admin clicks a user → open chat instantly */
function adminChatWithUser(phone, name) {
  // If no conversation exists yet, create a welcome message from admin
  const hasHistory = state.messages.some(m => m.phone === phone);
  if (!hasHistory) {
    state.messages.push({
      id: 'MSG-' + Date.now(),
      phone, name,
      text: `Hello ${name}, this is admin. How can I help you?`,
      from: 'admin',
      timestamp: new Date().toISOString(),
      read: true
    });
    save();
  }
  openAdminChat(phone);
}

/* ============ ADMIN CHAT ============ */
function adminStartNewChat() {
  const phone = document.getElementById('adminNewChatPhone').value.trim();
  const name = document.getElementById('adminNewChatName').value.trim() || 'User';
  if (!phone) { alert('⚠️ Enter a phone number.'); return; }

  state.messages.push({
    id: 'MSG-' + Date.now(),
    phone, name,
    text: `Hello ${name}, this is admin. How can I help you?`,
    from: 'admin',
    timestamp: new Date().toISOString(),
    read: true
  });
  save();

  document.getElementById('adminNewChatPhone').value = '';
  document.getElementById('adminNewChatName').value = '';
  renderAdminChatList();
  renderUserList();
  openAdminChat(phone);
}

function renderAdminChatList() {
  const list = document.getElementById('adminChatList');
  if (!list) return;

  const grouped = {};
  state.messages.forEach(m => {
    if (!grouped[m.phone]) grouped[m.phone] = { name: m.name, msgs: [], unread: 0 };
    grouped[m.phone].msgs.push(m);
    if (m.from === 'user' && !m.read) grouped[m.phone].unread++;
  });

  const phones = Object.keys(grouped);
  const totalUnread = phones.reduce((s, p) => s + grouped[p].unread, 0);

  if (phones.length === 0) {
    list.innerHTML = `<p style="opacity:.6; padding:10px;">No conversations yet. Click a user above to start.</p>`;
    return;
  }

  phones.sort((a, b) => {
    if (grouped[a].unread !== grouped[b].unread) return grouped[b].unread - grouped[a].unread;
    return new Date(grouped[b].msgs[grouped[b].msgs.length-1].timestamp) -
           new Date(grouped[a].msgs[grouped[a].msgs.length-1].timestamp);
  });

  list.innerHTML = `
    <div class="chat-info" style="margin-bottom:12px;">
      <span>💬 ${phones.length} conversation(s)</span>
      <span class="count">${totalUnread} unread</span>
    </div>
  ` + phones.map(phone => {
    const g = grouped[phone];
    const last = g.msgs[g.msgs.length - 1];
    return `<div class="user-chat-item ${g.unread > 0 ? 'unread' : ''}" onclick="openAdminChat('${phone}')">
      <div class="info">
        <strong>${escapeHtml(g.name)}</strong> • ${phone}
        <small>${escapeHtml(last.text.substring(0, 60))}${last.text.length > 60 ? '...' : ''}</small>
        <small style="opacity:.5;">${g.msgs.length} messages • ${timeAgo(last.timestamp)}</small>
      </div>
      <div style="display:flex; flex-direction:column; align-items:flex-end; gap:5px;">
        ${g.unread > 0 ? `<div class="badge">${g.unread}</div>` : ''}
        <button class="btn btn-sm btn-danger" style="padding:3px 8px; font-size:10px;" 
          onclick="event.stopPropagation(); deleteConversation('${phone}')">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function deleteConversation(phone) {
  if (!confirm(`Delete all messages with ${phone}?`)) return;
  state.messages = state.messages.filter(m => m.phone !== phone);
  save();
  renderAdminChatList();
  renderUserList();
}

function openAdminChat(phone) {
  currentAdminChatPhone = phone;
  state.messages.forEach(m => {
    if (m.phone === phone && m.from === 'user') m.read = true;
  });
  save();
  renderAdminChatList();
  renderUserList();
  renderAdminChatMessages();
  document.getElementById('adminChatModal').classList.add('show');
  if (window._adminChatInterval) clearInterval(window._adminChatInterval);
  window._adminChatInterval = setInterval(renderAdminChatMessages, 2000);
}

function renderAdminChatMessages() {
  if (!currentAdminChatPhone) return;
  const box = document.getElementById('adminChatMessages');
  const msgs = state.messages.filter(m => m.phone === currentAdminChatPhone)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const userMsgs = msgs.filter(m => m.from === 'user');
  const userName = userMsgs.length > 0 ? userMsgs[0].name : 'User';

  document.getElementById('adminChatTitle').innerHTML = 
    `💬 ${escapeHtml(userName)} (${currentAdminChatPhone}) <span class="unlimited-badge">∞ UNLIMITED</span>`;

  box.innerHTML = msgs.map(m => `
    <div class="chat-msg ${m.from}">
      ${escapeHtml(m.text)}
      <span class="time">${new Date(m.timestamp).toLocaleString()}</span>
    </div>
  `).join('');
  box.scrollTop = box.scrollHeight;
}

function sendAdminReply() {
  const input = document.getElementById('adminReplyInput');
  const text = input.value.trim();
  if (!text || !currentAdminChatPhone) return;
  if (text.length > 2000) { alert('⚠️ Message too long (max 2000 chars).'); return; }

  const userMsgs = state.messages.filter(m => m.phone === currentAdminChatPhone && m.from === 'user');
  const name = userMsgs.length > 0 ? userMsgs[0].name : 'User';

  state.messages.push({
    id: 'MSG-' + Date.now() + '-' + Math.floor(Math.random()*1000),
    phone: currentAdminChatPhone,
    name,
    text, from: 'admin',
    timestamp: new Date().toISOString(),
    read: false
  });
  save();
  input.value = '';
  renderAdminChatMessages();
  renderAdminChatList();
  renderUserList();
}

function closeAdminChat() {
  document.getElementById('adminChatModal').classList.remove('show');
  if (window._adminChatInterval) clearInterval(window._adminChatInterval);
  currentAdminChatPhone = null;
}

/* ============ HELPERS ============ */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function getUnreadMessageCount() {
  return state.messages.filter(m => m.from === 'user' && !m.read).length;
}

function timeAgo(timestamp) {
  const diff = (Date.now() - new Date(timestamp).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff/60) + 'm ago';
  if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
  return Math.floor(diff/86400) + 'd ago';
}