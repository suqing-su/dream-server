const express = require('express');
const app = express();
app.use(express.json());

app.get('/api/event', (req, res) => {
  const { type, value } = req.query;
  console.log(`[事件] ${type}: ${value}`);
  res.json({ ok: true, type, value });
});

app.listen(3000, () => {
  console.log('服务器启动，端口3000');
});
