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

function sendWeChat(title, content) {
  const params = new URLSearchParams({ title, desp: content });
  const url = `https://sctapi.ftqq.com/${SENDKEY}.send?${params}`;
  https.get(url, () => {});
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
  console.log('数据库初始化完成');
}

app.get('/api/event', async (req, res) => {
  const { type, value } = req.query;
  await pool.query(
    'INSERT INTO dream_events (type, value) VALUES ($1, $2)',
    [type, value]
  );
  console.log(`[存入] ${type}: ${value}`);
  res.json({ ok: true, type, value });
});

// 每小时检查一次
cron.schedule('0 * * * *', async () => {
  const result = await pool.query(
    `SELECT * FROM dream_events WHERE created_at > NOW() - INTERVAL '1 hour' ORDER BY created_at DESC LIMIT 5`
  );
  if (result.rows.length > 0) {
    const summary = result.rows.map(r => `${r.type}: ${r.value}`).join('\n');
    sendWeChat('苏清最近在做什么', summary);
    console.log('[推送]', summary);
  }
});

app.listen(3000, async () => {
  await initDB();
  console.log('服务器启动，端口3000');
});
