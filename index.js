const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

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

app.listen(3000, async () => {
  await initDB();
  console.log('服务器启动，端口3000');
});

