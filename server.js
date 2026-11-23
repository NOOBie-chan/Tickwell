// Tickwell server: serves the app (public/) and the collaboration API (POST /api). No accounts:
// each device has a public ID plus a private secret. Env vars: PORT, DATA (data file path), SERVER_URL (optional).
// Needs Node 18+, no packages.
const http=require("http"),fs=require("fs"),crypto=require("crypto");
const path=require("path"),FILE=process.env.DATA||"tickwell-data.json",PORT=process.env.PORT||8787,PUB=path.join(__dirname,"public");
let D={dev:{},groups:{},inv:{}};try{D=JSON.parse(fs.readFileSync(FILE,"utf8"))}catch(e){}
let tm;const save=()=>{clearTimeout(tm);tm=setTimeout(()=>fs.writeFile(FILE,JSON.stringify(D),()=>{}),300)};
const hash=s=>crypto.createHash("sha256").update(s).digest("hex"),rid=()=>crypto.randomBytes(6).toString("hex");
const cut=(s,n)=>String(s==null?"":s).slice(0,n);
const nid=s=>{s=cut(s,24).toUpperCase().replace(/[^A-Z0-9]/g,"");return s.length===8?s.slice(0,4)+"-"+s.slice(4):s};
const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json"};
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript",".json":"application/json",".webmanifest":"application/manifest+json",".png":"image/png",".svg":"image/svg+xml",".ico":"image/x-icon",".txt":"text/plain"};
function serve(q,r){let u;try{u=decodeURIComponent((q.url||"/").split("?")[0])}catch(e){u="/"}
 if(u==="/health"){r.writeHead(200,H);return r.end('{"ok":true}')}
 const f=path.join(PUB,path.normalize(u==="/"?"/index.html":u));
 if(f!==PUB&&!f.startsWith(PUB+path.sep)){r.writeHead(403);return r.end()}
 fs.readFile(f,(e,d)=>{if(e){r.writeHead(404,{"Content-Type":"text/plain"});return r.end("Not found")}
  const x=path.extname(f),html=path.basename(f)==="index.html";
  r.writeHead(200,{"Content-Type":MIME[x]||"application/octet-stream","Cache-Control":html||f.endsWith("sw.js")?"no-cache":"public, max-age=3600"});
  r.end(html?d.toString().replace("%%SERVER_URL%%",process.env.SERVER_URL||""):d)})}
http.createServer((q,r)=>{
 if(q.method==="OPTIONS"){r.writeHead(204,H);return r.end()}
 if(q.method==="GET"||q.method==="HEAD")return serve(q,r);
 if((q.url||"").split("?")[0]!=="/api"){r.writeHead(404,H);return r.end('{"error":"Not found"}')}
 let b="";q.on("data",c=>{b+=c;if(b.length>2e5)q.destroy()});
 q.on("end",()=>{const out=(c,o)=>{r.writeHead(c,H);r.end(JSON.stringify(o))};let m;
  try{m=JSON.parse(b)}catch(e){return out(400,{error:"Bad request"})}
  const id=nid(m.id),sec=String(m.sec||"");
  if(!/^[A-Z0-9-]{6,24}$/.test(id)||sec.length<16)return out(400,{error:"Bad identity"});
  if(!D.dev[id])D.dev[id]=hash(sec);else if(D.dev[id]!==hash(sec))return out(403,{error:"This device ID belongs to another device"});
  const nick=cut(m.nick,30)||id,mine=()=>Object.values(D.groups).filter(g=>g.m[id]);
  const inv=(g,to)=>{to=nid(to);if(!/^[A-Z0-9-]{6,24}$/.test(to)||g.m[to])return;const a=D.inv[to]=(D.inv[to]||[]).filter(x=>x.gid!==g.id);if(a.length<50)a.push({gid:g.id,name:g.name,from:nick})};
  const g=m.gid&&D.groups[m.gid],op=m.op;
  if(op==="sync"){mine().forEach(x=>{if(x.m[id]!==nick){x.m[id]=nick;save()}});return out(200,{groups:mine(),invites:D.inv[id]||[]})}
  if(op==="create"){const n={id:rid(),name:cut(m.name,60)||"Group",owner:id,m:{[id]:nick},tasks:[]};D.groups[n.id]=n;(Array.isArray(m.to)?m.to:[]).slice(0,20).forEach(t=>inv(n,t));save();return out(200,{group:n})}
  if(op==="accept"||op==="decline"){const a=D.inv[id]||[],x=a.find(v=>v.gid===m.gid);if(!x)return out(404,{error:"Invitation not found"});
   D.inv[id]=a.filter(v=>v!==x);if(op==="accept"&&D.groups[m.gid])D.groups[m.gid].m[id]=nick;save();return out(200,{ok:1})}
  if(!g||!g.m[id])return out(403,{error:"You are not in this group"});
  if(op==="invite"){inv(g,m.to);save();return out(200,{ok:1})}
  if(op==="leave"){delete g.m[id];const k=Object.keys(g.m);if(!k.length)delete D.groups[g.id];else if(g.owner===id)g.owner=k[0];save();return out(200,{ok:1})}
  if(op==="task"){const t=m.task||{},i=g.tasks.findIndex(x=>x.id===cut(t.id,20)),n={id:cut(t.id,20),t:cut(t.t,200),d:!!t.d};if(!n.id||!n.t)return out(400,{error:"Bad task"});
   if(i>=0)Object.assign(g.tasks[i],n);else if(g.tasks.length<500)g.tasks.push({...n,by:id,nick,at:Date.now()});save();return out(200,{ok:1})}
  if(op==="deltask"){g.tasks=g.tasks.filter(x=>x.id!==m.tid);save();return out(200,{ok:1})}
  out(400,{error:"Unknown request"})})
}).listen(PORT,()=>console.log("Tickwell sync server on port "+PORT));
