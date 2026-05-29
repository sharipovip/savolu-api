// api/generate.js — обновить на GitHub, Vercel сам перезапустится
export default async function handler(req, res) {

  // ===== CORS — разрешаем запросы из WebView/браузера =====
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Браузер сначала шлёт OPTIONS (preflight) — отвечаем OK
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Поддержка application/json и text/plain
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) { body = {}; }
  }

  const { text, type, count } = body || {};
  const API_KEY = process.env.ANTHROPIC_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in Vercel env variables' });
  }
  if (!text) {
    return res.status(400).json({ error: 'Missing text parameter' });
  }

  const API_URL = 'https://api.anthropic.com/v1/messages';
  const excerpt = text.substring(0, 12000);

  let prompt = '';
  if (type === 'test') {
    prompt = `Аз матни зерин маҳз ${count || 20} савол бо 3 вариант ҷавоб тайёр кун. Яке аз вариантҳо дуруст бошад. Ҷавоб ба забони тоҷикӣ бошад.

Матн:
${excerpt}

Дақиқан дар ин формати JSON ҷавоб деҳ — танҳо JSON, дигар ҳеҷ чиз:
[
  {"q": "матни савол", "opts": ["вариант А", "вариант Б", "вариант В"], "correct": 0}
]
correct — индекси ҷавоби дуруст (0, 1 ё 2).`;
  } else {
    prompt = `Аз матни зерин маҳз ${count || 20} савол бо ҷавоби муфассал тайёр кун. Ҳар ҷавоб камаш 2-3 ҷумла бошад. Ба забони тоҷикӣ бошад.

Матн:
${excerpt}

Дақиқан дар ин формати JSON ҷавоб деҳ — танҳо JSON:
[
  {"q": "матни савол", "a": "ҷавоби муфассал"}
]`;
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    const aiText = data.content?.[0]?.text || '';

    let raw = aiText.trim();
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');

    if (start === -1 || end === -1) {
      return res.status(502).json({ error: 'AI did not return valid JSON array', raw: aiText.substring(0, 500) });
    }

    const questions = JSON.parse(raw.substring(start, end + 1));
    if (!Array.isArray(questions)) {
      return res.status(502).json({ error: 'Parsed result is not an array' });
    }

    return res.status(200).json({ questions });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
