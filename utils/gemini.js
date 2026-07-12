const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
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
    throw new Error('GEMINI_HTTP_' + resp.status + ': ' + errText.slice(0, 300));
  }

  const data = await resp.json();
  const reply = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  if (!reply) throw new Error('EMPTY_REPLY');
  return reply;
}

module.exports = { askGemini };
