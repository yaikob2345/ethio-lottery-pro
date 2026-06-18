function showTab(id, btn) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  btn.classList.add('active');
  if (id === 'spin') { updateLiveView('mini'); updateLiveView('standard'); }
  if (id === 'admin') renderAdmin();
  if (id === 'chat' && currentUserChatPhone) renderUserChat();
}

function init() {
  initWheel('mini');
  initWheel('standard');
  updateRegisterNotice();
  updateLiveView('mini');
  updateLiveView('standard');
  updateStorageMonitor();

  setInterval(() => {
    if (document.getElementById('spin').classList.contains('active')) {
      updateLiveView('mini');
      updateLiveView('standard');
    }
  }, 5000);
}

init();