const{app,BrowserWindow,shell}=require("electron"),path=require("path");
app.setAppUserModelId("com.yourname.tickwell");
function create(){const w=new BrowserWindow({width:1100,height:760,minWidth:380,minHeight:500,title:"Tickwell",icon:path.join(__dirname,"icon.png"),autoHideMenuBar:true,backgroundColor:"#f7f8fa",webPreferences:{contextIsolation:true}});
 w.webContents.setWindowOpenHandler(({url})=>{if(/^https?:/.test(url))shell.openExternal(url);return{action:"deny"}});
 w.loadFile(path.join(__dirname,"app-www","index.html"))}
if(!app.requestSingleInstanceLock())app.quit();else app.whenReady().then(create);
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit()});
