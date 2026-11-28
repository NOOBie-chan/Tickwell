const http = require("http"),
  fs = require("fs"),
  path = require("path"),
  crypto = require("crypto");
const FILE = process.env.DATA || "tickwell-data.json",
  PORT = process.env.PORT || 8787,
  PUB = path.join(__dirname, "public");
let D = { dev: {}, groups: {}, inv: {} };
try {
  D = JSON.parse(fs.readFileSync(FILE, "utf8"));
} catch (e) {}
Object.values(D.groups).forEach((g) => {
  for (const k in g.m) {
    if (typeof g.m[k] === "string")
      g.m[k] = { n: g.m[k], r: k === g.owner ? "admin" : "member" };
  }
  g.tasks.forEach((t) => {
    if (!t.st) t.st = "ok";
    if (t.as === undefined) t.as = "";
  });
});
let tm;
const save = () => {
  clearTimeout(tm);
  tm = setTimeout(() => fs.writeFile(FILE, JSON.stringify(D), () => {}), 300);
};
const hash = (s) => crypto.createHash("sha256").update(s).digest("hex"),
  rid = () => crypto.randomBytes(6).toString("hex");
const cut = (s, n) => String(s == null ? "" : s).slice(0, n);
const nid = (s) => {
  s = cut(s, 24)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return s.length === 8 ? s.slice(0, 4) + "-" + s.slice(4) : s;
};
const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json",
};
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
};
function serve(q, r) {
  let u;
  try {
    u = decodeURIComponent((q.url || "/").split("?")[0]);
  } catch (e) {
    u = "/";
  }
  if (u === "/health") {
    r.writeHead(200, H);
    return r.end('{"ok":true}');
  }
  const f = path.join(PUB, path.normalize(u === "/" ? "/index.html" : u));
  if (f !== PUB && !f.startsWith(PUB + path.sep)) {
    r.writeHead(403);
    return r.end();
  }
  fs.readFile(f, (e, d) => {
    if (e) {
      r.writeHead(404, { "Content-Type": "text/plain" });
      return r.end("Not found");
    }
    const x = path.extname(f),
      html = path.basename(f) === "index.html";
    r.writeHead(200, {
      "Content-Type": MIME[x] || "application/octet-stream",
      "Cache-Control":
        html || f.endsWith("sw.js") ? "no-cache" : "public, max-age=3600",
    });
    r.end(
      html
        ? d.toString().replace("%%SERVER_URL%%", process.env.SERVER_URL || "")
        : d,
    );
  });
}
http
  .createServer((q, r) => {
    if (q.method === "OPTIONS") {
      r.writeHead(204, H);
      return r.end();
    }
    if (q.method === "GET" || q.method === "HEAD") return serve(q, r);
    if ((q.url || "").split("?")[0] !== "/api") {
      r.writeHead(404, H);
      return r.end('{"error":"Not found"}');
    }
    let b = "";
    q.on("data", (c) => {
      b += c;
      if (b.length > 2e5) q.destroy();
    });
    q.on("end", () => {
      const out = (c, o) => {
          r.writeHead(c, H);
          r.end(JSON.stringify(o));
        },
        no = (m, c) => out(c || 403, { error: m });
      let m;
      try {
        m = JSON.parse(b);
      } catch (e) {
        return no("Bad request", 400);
      }
      const id = nid(m.id),
        sec = String(m.sec || "");
      if (!/^[A-Z0-9-]{6,24}$/.test(id) || sec.length < 16)
        return no("Bad identity", 400);
      if (!D.dev[id]) D.dev[id] = hash(sec);
      else if (D.dev[id] !== hash(sec))
        return no("This device ID belongs to another device");
      const nick = cut(m.nick, 30) || id,
        op = m.op,
        g = m.gid && D.groups[m.gid];
      const view = (x) => ({
        ...x,
        tasks:
          x.m[id] && x.m[id].r === "admin"
            ? x.tasks
            : x.tasks.filter((t) => t.st === "ok" || t.by === id),
      });
      const mine = () =>
        Object.values(D.groups)
          .filter((x) => x.m[id])
          .map(view);
      const inv = (x, to) => {
        to = nid(to);
        if (!/^[A-Z0-9-]{6,24}$/.test(to) || x.m[to]) return;
        const a = (D.inv[to] = (D.inv[to] || []).filter((v) => v.gid !== x.id));
        if (a.length < 50) a.push({ gid: x.id, name: x.name, from: nick });
      };
      const unassign = (x, uid) =>
        x.tasks.forEach((t) => {
          if (t.as === uid) t.as = "";
        });
      if (op === "sync") {
        Object.values(D.groups).forEach((x) => {
          if (x.m[id] && x.m[id].n !== nick) {
            x.m[id].n = nick;
            save();
          }
        });
        return out(200, { groups: mine(), invites: D.inv[id] || [] });
      }
      if (op === "create") {
        const n = {
          id: rid(),
          name: cut(m.name, 60) || "Group",
          owner: id,
          m: { [id]: { n: nick, r: "admin" } },
          tasks: [],
        };
        D.groups[n.id] = n;
        (Array.isArray(m.to) ? m.to : [])
          .slice(0, 20)
          .forEach((t) => inv(n, t));
        save();
        return out(200, { group: view(n) });
      }
      if (op === "accept" || op === "decline") {
        const a = D.inv[id] || [],
          x = a.find((v) => v.gid === m.gid);
        if (!x) return no("Invitation not found", 404);
        D.inv[id] = a.filter((v) => v !== x);
        if (op === "accept" && D.groups[m.gid])
          D.groups[m.gid].m[id] = { n: nick, r: "member" };
        save();
        return out(200, { ok: 1 });
      }
      if (!g || !g.m[id]) return no("You are not in this group");
      const role = g.m[id].r,
        adm = role === "admin",
        priv = role !== "member",
        ok = () => {
          save();
          out(200, { ok: 1 });
        };
      const task = g.tasks.find((t) => t.id === m.tid);
      if (op === "invite") {
        if (!adm) return no("Only the admin can invite people");
        inv(g, m.to);
        return ok();
      }
      if (op === "rename") {
        if (!adm) return no("Only the admin can rename the group");
        g.name = cut(m.name, 60) || g.name;
        return ok();
      }
      if (op === "role") {
        if (!adm) return no("Only the admin can change roles");
        const u = nid(m.uid);
        if (u === id || !g.m[u] || !["contrib", "member"].includes(m.role))
          return no("Invalid change", 400);
        g.m[u].r = m.role;
        return ok();
      }
      if (op === "kick") {
        if (!adm) return no("Only the admin can remove people");
        const u = nid(m.uid);
        if (u === id || !g.m[u]) return no("Invalid change", 400);
        delete g.m[u];
        unassign(g, u);
        return ok();
      }
      if (op === "leave") {
        if (adm) {
          if (Object.keys(g.m).length > 1)
            return no("The admin cannot leave. Delete the group instead.");
          delete D.groups[g.id];
          return ok();
        }
        delete g.m[id];
        unassign(g, id);
        return ok();
      }
      if (op === "delgroup") {
        if (!adm) return no("Only the admin can delete the group");
        delete D.groups[g.id];
        return ok();
      }
      if (op === "task") {
        const t = m.task || {},
          tid = cut(t.id, 20),
          tt = cut(t.t, 200).trim();
        if (!tid || !tt || g.tasks.some((x) => x.id === tid))
          return no("Bad task", 400);
        if (g.tasks.length >= 500)
          return no("This group has too many tasks", 400);
        g.tasks.push({
          id: tid,
          t: tt,
          d: false,
          by: id,
          nick: g.m[id].n,
          at: Date.now(),
          st: priv ? "ok" : "pending",
          as: priv && g.m[nid(t.as)] ? nid(t.as) : "",
        });
        return ok();
      }
      if (!task) return no("Task not found", 404);
      if (op === "edit") {
        const own = task.by === id && task.st === "pending";
        if (!priv && !own) return no("You cannot edit this task");
        const tt = cut(m.t, 200).trim();
        if (tt) task.t = tt;
        if (priv && m.as !== undefined)
          task.as = g.m[nid(m.as)] ? nid(m.as) : "";
        return ok();
      }
      if (op === "done") {
        if (task.st !== "ok" || !(priv || task.as === id))
          return no("You cannot complete this task");
        task.d = !!m.d;
        return ok();
      }
      if (op === "deltask") {
        if (!priv && !(task.by === id && task.st === "pending"))
          return no("You cannot delete this task");
        g.tasks = g.tasks.filter((t) => t !== task);
        return ok();
      }
      if (op === "approve") {
        if (!adm) return no("Only the admin can approve tasks");
        task.st = "ok";
        return ok();
      }
      if (op === "reject") {
        if (!adm) return no("Only the admin can reject tasks");
        g.tasks = g.tasks.filter((t) => t !== task);
        return ok();
      }
      no("Unknown request", 400);
    });
  })
  .listen(PORT, () => console.log("Tickwell server on port " + PORT));
