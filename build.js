// Copies the app and bakes in your server address (static site build).
// Address comes from: 1) the first argument  2) SERVER_URL env var  3) ../server.config.json
const fs=require("fs"),path=require("path");
function serverUrl(root){let u=process.argv[2]||process.env.SERVER_URL||"";
 if(!u){try{u=JSON.parse(fs.readFileSync(path.join(root,"server.config.json"),"utf8")).url||""}catch(e){}}
 return u.trim().replace(/\/+$/,"")}
function bake(src,out,url){fs.rmSync(out,{recursive:true,force:true});fs.cpSync(src,out,{recursive:true});
 const f=path.join(out,"index.html");fs.writeFileSync(f,fs.readFileSync(f,"utf8").replace("%%SERVER_URL%%",url))}
const url=serverUrl(__dirname);
if(!/^https?:\/\//.test(url)){console.error("No server address. Put it in server.config.json, or pass it: npm run build -- https://your-app.onrender.com");process.exit(1)}
bake(path.join(__dirname,"public"),path.join(__dirname,"www"),url);console.log("Built with server "+url);
