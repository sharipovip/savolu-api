export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, type, count } = req.body;
  
  // Ключ берётся из переменных окружения (ты вставишь в панели Vercel)
  const API_KEY = process.env.ANTHROPIC_API_KEY;
  
  if (!API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const API_URL = 'https://api.anthropic.com/v1/messages';

  let prompt = '';
  if (type === 'test') {
    prompt = `Аз матни зерин маҳз ${count} савол бо 3 вариант ҷавоб тайёр кун. Яке аз вариантҳо дуруст бошад. Ҷавоб ба забони тоҷикӣ бошад.

Матн:
${text.substring(0, 12000)}

Дақиқан дар ин формати JSON ҷавоб деҳ — танҳо JSON:
[
  {"q": "матни савол", "opts": ["вариант А", "вариант Б", "вариант В"], "correct": 0}
]`;
  } else {
    prompt = `Аз матни зерин маҳз ${count} савол бо ҷавоби муфассал тайёр кун. Ҳар ҷавоб камаш 2-3 ҷумла бошад. Ба забони тоҷикӣ бошад.

Матн:
${text.substring(0, 12000)}

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
      return res.status(502).json({ error: 'Invalid JSON from AI', raw: aiText.substring(0, 500) });
    }

    const questions = JSON.parse(raw.substring(start, end + 1));
    res.status(200).json({ questions });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
