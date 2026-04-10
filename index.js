const express = require('express');
const { Pool } = require('pg');
const cron = require('node-cron');
const https = require('https');

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const SENDKEY = process.env.SENDKEY;
const CLAUDE_KEY = process.env.CLAUDE_KEY;
const CLAUDE_API = 'https://api.gemai.cc/v1/messages';

function sendWeChat(title, content) {
  const params = new URLSearchParams({ title, desp: content });
  const url = `https://sctapi.ftqq.com/${SENDKEY}.send?${params}`;
  https.get(url, () => {});
}

async function askClaude(events) {
  const summary = events.map(r => `${r.created_at.toLocaleString('zh-CN')}: ${r.type} - ${r.value}`).join('\n');
  const body = JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `苏清最近的手机使用记录：\n${summary}\n\n用一句话自然地评论一下她在干嘛，口吻像男友，简短。`
    }]
  });

  return new Promise((resolve) => {
    const req = https.request('https://api.gemai.cc/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_KEY,
        'anthropic-version': '2023-06-01'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
    const json = JSON.parse(data);
    console.log('API返回:', JSON.stringify(json));
    resolve(json.content[0].text);
} catch(e) {
    console.log('解析失败，原始data:', data);
    resolve('解析失败');
}
      });
    });
    req.write(body);
    req.end();
  });
}

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dream_events (
      id SERIAL PRIMARY KEY,
      type TEXT,
      value TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

app.get('/api/event', async (req, res) => {
  const { type, value } = req.query;
  await pool.query('INSERT INTO dream_events (type, value) VALUES ($1, $2)', [type, value]);
  res.json({ ok: true });
});

cron.schedule('0 * * * *', async () => {
  const result = await pool.query(
    `SELECT * FROM dream_events WHERE created_at > NOW() - INTERVAL '1 hour' ORDER BY created_at DESC LIMIT 5`
  );
  if (result.rows.length > 0) {
    const comment = await askClaude(result.rows);
    sendWeChat('苏清在干嘛', comment);
    console.log('[推送]', comment);
  }
});

app.listen(3000, async () => {
  await initDB();
  console.log('服务器启动');
});
