const APP = "badboy-barber-pages";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};
const TABLES = ["users", "branches", "items", "transactions", "transaction_items"];
const KEY = { transaction_items: "transactionItems" };
const COLS = {
  users: ["id", "username", "pin_salt", "pin_hash", "role", "is_active", "created_at"],
  branches: ["id", "name", "is_active", "created_at"],
  items: ["id", "name", "price", "category", "branch_id", "is_active", "is_hidden", "created_at"],
  transactions: ["id", "user_id", "branch_id", "total_amount", "cash_amount", "qris_amount", "change_amount", "notes", "date", "created_at"],
  transaction_items: ["id", "transaction_id", "item_id", "name", "category", "unit_price", "quantity"],
};
const BOOL = { users: ["is_active"], branches: ["is_active"], items: ["is_active", "is_hidden"] };

const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const int = (v) => (typeof v === "number" ? v : Number(v));
const hex = (buf) => Array.from(new Uint8Array(buf)).map((x) => x.toString(16).padStart(2, "0")).join("");

function toEntity(table, row) {
  const o = {};
  for (const c of COLS[table]) o[camel(c)] = row[c];
  for (const b of BOOL[table] || []) o[camel(b)] = o[camel(b)] === 1;
  return o;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS } });
}

async function authorized(req, env) {
  const token = env.SYNC_TOKEN;
  if (!token) return true;
  const h = req.headers.get("Authorization") || "";
  const p = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!p || p.length !== token.length) return false;
  const a = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(p));
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return hex(a) === hex(b);
}

async function readBackup(env) {
  const data = {};
  for (const t of TABLES) {
    const r = await env.DB.prepare(`SELECT * FROM ${t} ORDER BY id`).all();
    data[KEY[t] || t] = r.results.map((row) => toEntity(t, row));
  }
  const meta = {};
  const m = await env.DB.prepare("SELECT key, value FROM meta").all();
  for (const r of m.results) meta[String(r.key)] = String(r.value);
  let saved = [];
  try { saved = JSON.parse(meta.saved_barbers || "[]"); } catch (e) { saved = []; }
  data.settings = { savedBarbers: Array.isArray(saved) ? saved : [], syncEndpoint: "", syncToken: "", shopName: meta.shop_name || "Badboy Barber" };
  const updatedAt = meta.updated_at || "1970-01-01T00:00:00.000Z";
  return { backup: { app: APP, version: 1, exportedAt: new Date().toISOString(), data }, updatedAt };
}

async function writeBackup(env, backup, updatedAt) {
  const d = backup.data;
  for (const t of TABLES) {
    const key = KEY[t] || t;
    const rows = d[key] || [];
    await env.DB.prepare(`DELETE FROM ${t}`).run();
    if (!rows.length) continue;
    const cols = COLS[t];
    const placeholders = cols.map(() => "?").join(", ");
    const stmt = env.DB.prepare(`INSERT INTO ${t} (${cols.join(", ")}) VALUES (${placeholders})`);
    for (const e of rows) {
      const vals = cols.map((c) => {
        const name = camel(c);
        let v = e[name];
        if ((BOOL[t] || []).includes(c)) v = v === true || v === 1 ? 1 : 0;
        return v;
      });
      await stmt.bind(...vals).run();
    }
  }
  const saved = JSON.stringify(Array.isArray(d.settings?.savedBarbers) ? d.settings.savedBarbers : []);
  const shopName = d.settings?.shopName || "Badboy Barber";
  await env.DB.batch([
    env.DB.prepare("DELETE FROM meta"),
    env.DB.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").bind("updated_at", updatedAt),
    env.DB.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").bind("saved_barbers", saved),
    env.DB.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").bind("shop_name", shopName),
  ]);
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (!(await authorized(req, env))) return json({ ok: false, message: "Unauthorized" }, 401);
    const url = new URL(req.url);
    if (url.pathname === "/api/health") return json({ ok: true, db: "d1" });
    if (url.pathname === "/api/sync" && req.method === "GET") {
      const { backup, updatedAt } = await readBackup(env);
      return json({ updatedAt, backup });
    }
    if (url.pathname === "/api/sync" && req.method === "PUT") {
      let body;
      try { body = await req.json(); } catch (e) { return json({ ok: false, message: "Invalid JSON body." }, 400); }
      const b = body.backup;
      if (!b || b.app !== APP || !b.data) return json({ ok: false, message: "Not a Badboy Barber backup." }, 400);
      try {
        await writeBackup(env, b, body.updatedAt || new Date().toISOString());
      } catch (e) {
        return json({ ok: false, message: "Write failed: " + String(e) }, 500);
      }
      return json({ ok: true });
    }
    return json({ ok: false, message: "Not found" }, 404);
  },
};