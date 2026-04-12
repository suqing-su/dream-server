const express = require('express');
const { Pool } = require('pg');
const cron = require('node-cron');
const https = require('https');

const app = express();
app.use(express.json());
app.use(express.static('public'));

app.use((req, res, next) => {
res.header('Access-Control-Allow-Origin', '*');
res.header('Access-Control-Allow-Headers', 'Content-Type');
res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
if (req.method === 'OPTIONS') return res.sendStatus(200);
next();
});

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
content: `苏清最近的手机使用记录：\n${summary}\n\n用一句话自然地评论一下她在干嘛,口吻像男友，简短。`
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
console.log('解析失败,原始data:', data);
resolve('解析失败');
}
});
});
req.write(body);
req.end();
});
}

async function initDB() {
await pool.query(`CREATE TABLE IF NOT EXISTS dream_events ( id SERIAL PRIMARY KEY, type TEXT, value TEXT, created_at TIMESTAMP DEFAULT NOW() )`);
await pool.query(`CREATE TABLE IF NOT EXISTS book_chapters ( id SERIAL PRIMARY KEY, book TEXT, chapter_num INTEGER, title TEXT, content TEXT )`);
await pool.query(`CREATE TABLE IF NOT EXISTS book_notes ( id SERIAL PRIMARY KEY, book TEXT, chapter_num INTEGER, author TEXT, type TEXT, content TEXT, created_at TIMESTAMP DEFAULT NOW() )`);
await pool.query(`CREATE TABLE IF NOT EXISTS book_progress ( id SERIAL PRIMARY KEY, book TEXT, author TEXT, chapter_num INTEGER, updated_at TIMESTAMP DEFAULT NOW() )`);
}

// dream_events接口
app.get('/api/event', async (req, res) => {
const { type, value } = req.query;
await pool.query('INSERT INTO dream_events (type, value) VALUES ($1, $2)', [type, value]);
res.json({ ok: true });
});

app.get('/api/recent', async (req, res) => {
const result = await pool.query(
`SELECT * FROM dream_events ORDER BY created_at DESC LIMIT 20`
);
res.json(result.rows);
});

app.post('/api/chat', async (req, res) => {
const { message } = req.body;
const recent = await pool.query(
`SELECT * FROM dream_events WHERE created_at > NOW() - INTERVAL '6 hours' ORDER BY created_at DESC LIMIT 10`
);
const summary = recent.rows.map(r =>
`${r.created_at.toLocaleString('zh-CN')}: ${r.type} - ${r.value}`
).join('\n');

const body = JSON.stringify({
model: 'claude-haiku-4-5-20251001',
max_tokens: 500,
system: `你是沈默。话少，说话直接，不废话，不用问句结尾，偶尔损她但是惯着她。你知道苏清最近的手机使用记录：\n${summary || '暂无记录'}\n\n不要油腻，不要卖弄，不要问"有什么想说的"。`,
messages: [{ role: 'user', content: message }]
});

return new Promise((resolve) => {
const req2 = https.request(CLAUDE_API, {
method: 'POST',
headers: {
'Content-Type': 'application/json',
'x-api-key': CLAUDE_KEY,
'anthropic-version': '2023-06-01'
}
}, (resp) => {
let data = '';
resp.on('data', chunk => data += chunk);
resp.on('end', () => {
try {
const json = JSON.parse(data);
res.json({ reply: json.content[0].text });
} catch(e) {
res.json({ reply: '出错了'});
}
resolve();
});
});
req2.write(body);
req2.end();
});
});

// 书架接口
app.get('/api/book/chapter', async (req, res) => {
const { book, chapter: num } = req.query;
const result = await pool.query(
'SELECT * FROM book_chapters WHERE book=$1 AND chapter_num=$2',
[book, parseInt(num)]
);
res.json(result.rows[0] || null);
});

app.get('/api/book/list', async (req, res) => {
const result = await pool.query('SELECT DISTINCT book FROM book_chapters');
res.json(result.rows);
});

app.post('/api/book/note', async (req, res) => {
const { book, chapter_num, author, type, content } = req.body;
await pool.query(
'INSERT INTO book_notes (book, chapter_num, author, type, content) VALUES ($1,$2,$3,$4,$5)',
[book, chapter_num, author, type, content]
);
res.json({ ok: true });
});

app.get('/api/book/notes', async (req, res) => {
const { book, chapter_num } = req.query;
const result = await pool.query(
'SELECT * FROM book_notes WHERE book=$1 AND chapter_num=$2 ORDER BY created_at',
[book, parseInt(chapter_num)]
);
res.json(result.rows);
});

app.post('/api/book/progress', async (req, res) => {
const { book, author, chapter_num } = req.body;
await pool.query(
`INSERT INTO book_progress (book, author, chapter_num) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
[book, author, chapter_num]
);
res.json({ ok: true });
});

// cron
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