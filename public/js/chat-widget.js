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

  function getSessionId() {
    try {
      var key = 'thl_chat_session';
      var id = localStorage.getItem(key);
      if (!id) {
        id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random();
        localStorage.setItem(key, id);
      }
      return id;
    } catch (e) {
      return String(Date.now()) + Math.random();
    }
  }
  var sessionId = getSessionId();

  function addMessage(role, text, extraClass) {
    var div = document.createElement('div');
    div.className = 'chat-msg ' + (role === 'user' ? 'user' : 'bot') + (extraClass ? ' ' + extraClass : '');
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function openChat() {
    win.hidden = false;
    if (!opened) {
      opened = true;
      addMessage('bot', 'Xin chào! Mình là trợ lý tự động của Tân Hưng Lợi, có thể hỗ trợ bạn về sản phẩm, cách đặt hàng, chính sách giao hàng... Câu nào mình chưa chắc, mình sẽ chuyển cho chị Lan hỗ trợ trực tiếp nhé! 🙂');
    }
    input.focus();
  }

  fab.addEventListener('click', function () {
    if (win.hidden) openChat();
    else win.hidden = true;
  });
  closeBtn.addEventListener('click', function () { win.hidden = true; });

  // Chờ chị Lan trả lời qua Telegram: hỏi định kỳ xem đã có câu trả lời
  // chưa, tối đa ~30 phút thì tự dừng (khách vẫn có thể hỏi tiếp bình
  // thường, chỉ là không còn tự động chờ nữa).
  function waitForHumanReply(escalationId) {
    var attempts = 0;
    var maxAttempts = 300;
    var timer = setInterval(function () {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(timer);
        return;
      }
      fetch('/api/tro-chuyen/cho-tra-loi/' + escalationId)
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data && data.replied && data.answer) {
            clearInterval(timer);
            addMessage('bot', data.answer, 'human');
            history.push({ role: 'assistant', text: data.answer });
            if (history.length > 20) history = history.slice(-20);
          }
        })
        .catch(function () {});
    }, 6000);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    addMessage('user', text);

    var typingEl = document.createElement('div');
    typingEl.className = 'chat-msg bot typing';
    typingEl.textContent = 'Đang trả lời...';
    messagesEl.appendChild(typingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    sending = true;
    fetch('/api/tro-chuyen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: history, sessionId: sessionId })
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
          if (result.data.waitingForHuman && result.data.escalationId) {
            waitForHumanReply(result.data.escalationId);
          }
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
