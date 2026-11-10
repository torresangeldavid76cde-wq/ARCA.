import {spawn} from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import 'dotenv/config';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
const data=path.resolve(root,'runtime/mysql-data');
const port=Number(process.env.DB_PORT||3306);
fs.mkdirSync(path.join(root,'runtime'),{recursive:true});
const fresh=!fs.existsSync(path.join(data,'mysql'));
if(fresh)await new Promise((resolve,reject)=>{const p=spawn('C:/xampp/mysql/bin/mysql_install_db.exe',['--datadir='+data,'--port='+port,'--skip-networking'],{windowsHide:true,stdio:'inherit'});p.on('exit',c=>c===0?resolve():reject(Error('No se pudo inicializar XAMPP')));p.on('error',reject)});
const db=spawn('C:/xampp/mysql/bin/mysqld.exe',['--no-defaults','--basedir=C:/xampp/mysql','--datadir='+data,'--port='+port,'--bind-address=127.0.0.1','--skip-named-pipe','--skip-networking=0','--console'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let log='';db.stderr.on('data',d=>{log+=d});
async function child(file,extraEnv={}){await new Promise((resolve,reject)=>{const p=spawn(process.execPath,[file],{cwd:root,stdio:'inherit',windowsHide:true,env:{...process.env,...extraEnv}});p.on('exit',code=>code===0?resolve():reject(Error('Falló '+file)));p.on('error',reject)})}
let connected=false;
for(let i=0;i<30;i++){connected=await new Promise(resolve=>{const c=net.createConnection({host:process.env.DB_HOST||'127.0.0.1',port});c.once('connect',()=>{c.destroy();resolve(true)});c.once('error',()=>resolve(false));c.setTimeout(500,()=>{c.destroy();resolve(false)})});if(connected)break;await new Promise(r=>setTimeout(r,500));}
if(!connected){console.error(log);db.kill();process.exit(1)}
if(fresh||!fs.existsSync('.env'))await child('server/setup-local.js');
const adminFile=path.resolve(root,'runtime/database-admin.txt');
const secret=fs.readFileSync(adminFile,'utf8').split('Root password: ')[1].trim();
await child('server/init.js',{DB_ADMIN_USER:'root',DB_ADMIN_PASSWORD:secret});
await new Promise((resolve,reject)=>{const p=spawn(process.execPath,['node_modules/vite/bin/vite.js','build'],{cwd:root,stdio:'inherit',windowsHide:true});p.on('exit',code=>code===0?resolve():reject(Error('No se pudo compilar la interfaz ARCA')));p.on('error',reject)});
if(process.argv.includes('--export'))await child('server/export-schema.js');
const api=spawn(process.execPath,['server/start.js'],{cwd:root,stdio:'inherit',windowsHide:true});
if(process.argv.includes('--verify')){let ready=false;for(let i=0;i<120;i++){try{const r=await fetch('http://127.0.0.1:4180/api/health');if(r.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,500))}if(!ready){api.kill();db.kill();throw Error('La API no inició')}try{await child('tests/access.test.js')}catch(e){api.kill();db.kill();throw e}}
const stop=()=>{api.kill();db.kill();process.exit()};process.on('SIGINT',stop);process.on('SIGTERM',stop);
