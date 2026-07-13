// Thử lần lượt các model theo thứ tự ưu tiên - tài khoản/API key khác nhau có thể
// bị giới hạn quota=0 trên model cũ (vd. gemini-2.0-flash) nhưng dùng được model mới hơn.
const CANDIDATE_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash'
];

// Nhớ lại model đầu tiên gọi thành công để các lần sau khỏi phải dò lại từ đầu.
let workingModel = process.env.GEMINI_MODEL || null;

async function callModel(model, apiKey, systemPrompt, contents) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature: 0.6, maxOutputTokens: 500 }
    })
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    const err = new Error('GEMINI_HTTP_' + resp.status + ': ' + errText.slice(0, 300));
    err.status = resp.status;
    throw err;
  }

  const data = await resp.json();
  const reply = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  if (!reply) throw new Error('EMPTY_REPLY');
  return reply;
}

async function askGemini({ systemPrompt, history, message }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('MISSING_API_KEY');
  }

  const contents = [
    ...history.map((h) => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.text }]
    })),
    { role: 'user', parts: [{ text: message }] }
  ];

  if (workingModel) {
    try {
      return await callModel(workingModel, apiKey, systemPrompt, contents);
    } catch (err) {
      // Model đã từng chạy được nhưng giờ lỗi (vd. hết quota tạm thời) - dò lại từ đầu.
      workingModel = null;
    }
  }

  let lastErr;
  for (const model of CANDIDATE_MODELS) {
    try {
      const reply = await callModel(model, apiKey, systemPrompt, contents);
      workingModel = model;
      return reply;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

module.exports = { askGemini };
