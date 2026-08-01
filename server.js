const express = require("express");

const app = express();
app.use(express.json());

// --- Хранилище в памяти: uuid -> время последнего "я тут" (мс) ---
// Ничего сложного вроде базы данных не нужно: клиент репортит каждые ~30 сек,
// мы просто помним последний timestamp и отдаём только "свежих" (см. FRESH_MS).
const lastSeen = new Map();

const FRESH_MS = 5 * 60 * 1000;       // считаем пользователя "онлайн", если он был <5 мин назад
const CLEANUP_INTERVAL_MS = 60 * 1000; // раз в минуту чистим устаревшие записи

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// Health-check — Render дёргает "/" сам, полезно для отладки в браузере
app.get("/", (req, res) => {
  res.json({ ok: true, service: "darkvisuals-usertab", online: lastSeen.size });
});

// POST /usertab/report { "uuid": "..." } — "я тут, у меня клиент установлен"
app.post("/usertab/report", (req, res) => {
  const uuid = req.body && req.body.uuid;
  if (typeof uuid !== "string" || !UUID_RE.test(uuid)) {
    return res.status(400).json({ error: "invalid uuid" });
  }
  lastSeen.set(uuid.toLowerCase(), Date.now());
  res.status(204).end();
});

// GET /usertab/list -> { "users": ["uuid1", "uuid2", ...] } — только свежие
app.get("/usertab/list", (req, res) => {
  const now = Date.now();
  const users = [];
  for (const [uuid, ts] of lastSeen) {
    if (now - ts <= FRESH_MS) users.push(uuid);
  }
  res.json({ users });
});

setInterval(() => {
  const now = Date.now();
  for (const [uuid, ts] of lastSeen) {
    if (now - ts > FRESH_MS) lastSeen.delete(uuid);
  }
}, CLEANUP_INTERVAL_MS).unref();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[usertab] listening on :${PORT}`);
});
