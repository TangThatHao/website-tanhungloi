(function () {
  var fab = document.getElementById('chatFab');
  var win = document.getElementById('chatWindow');
  var closeBtn = document.getElementById('chatCloseBtn');
  var messagesEl = document.getElementById('chatMessages');
  var form = document.getElementById('chatForm');
  var input = document.getElementById('chatInput');
  if (!fab || !win || !form) return;

  var history = [];
  var opened = false;
  var sending = false;

  function addMessage(role, text) {
    var div = document.createElement('div');
    div.className = 'chat-msg ' + (role === 'user' ? 'user' : 'bot');
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function openChat() {
    win.hidden = false;
    if (!opened) {
      opened = true;
      addMessage('bot', 'Chào bạn, Chị Lan đây! Chị có thể tư vấn giúp bạn về sản phẩm bánh pía Tân Hưng Lợi, cách đặt hàng, hoặc câu chuyện thương hiệu. Bạn cần hỏi gì nào? 🙂');
    }
    input.focus();
  }

  fab.addEventListener('click', function () {
    if (win.hidden) openChat();
    else win.hidden = true;
  });
  closeBtn.addEventListener('click', function () { win.hidden = true; });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    addMessage('user', text);

    var typingEl = document.createElement('div');
    typingEl.className = 'chat-msg bot typing';
    typingEl.textContent = 'Chị Lan đang trả lời...';
    messagesEl.appendChild(typingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    sending = true;
    fetch('/api/tro-chuyen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: history })
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        typingEl.remove();
        if (result.ok && result.data.reply) {
          addMessage('bot', result.data.reply);
          history.push({ role: 'user', text: text });
          history.push({ role: 'assistant', text: result.data.reply });
          if (history.length > 20) history = history.slice(-20);
        } else {
          addMessage('bot', result.data.error || 'Có lỗi xảy ra, vui lòng thử lại.');
        }
      })
      .catch(function () {
        typingEl.remove();
        addMessage('bot', 'Không kết nối được, vui lòng thử lại hoặc gọi hotline 0919 454 484.');
      })
      .finally(function () {
        sending = false;
      });
  });
})();
