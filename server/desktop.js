import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
dotenv.config({path:path.join(root,'.env')});
const runtime=path.join(root,'runtime');
const port=Number(process.env.PORT||4180);
const databasePort=Number(process.env.DB_PORT||3306);
const databaseHost=process.env.DB_HOST||'127.0.0.1';
const address=`http://127.0.0.1:${port}`;
const lock=path.join(runtime,'desktop-launch.lock');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let ownsLock=false;

async function healthy(){
  try{
    const r=await fetch(address+'/api/health',{signal:AbortSignal.timeout(1500)});
    if(!r.ok)return false;
    const body=await r.json();
    return body.ok===true&&body.database==='conectada';
  }catch{return false;}
}

function listening(host,portNumber){
  return new Promise(resolve=>{
    const socket=net.createConnection({host,port:portNumber});
    const done=value=>{socket.destroy();resolve(value);};
    socket.once('connect',()=>done(true));
    socket.once('error',()=>done(false));
    socket.setTimeout(1000,()=>done(false));
  });
}

async function launchBackground(executable,args,logName){
  const fd=fs.openSync(path.join(runtime,logName),'a');
  try{
    await new Promise((resolve,reject)=>{
      const child=spawn(executable,args,{cwd:root,env:process.env,detached:true,windowsHide:true,stdio:['ignore',fd,fd]});
      child.once('error',reject);
      child.once('spawn',()=>{child.unref();resolve();});
    });
  }finally{fs.closeSync(fd);}
}

async function acquireLock(){
  for(let i=0;i<60;i++){
    try{
      const fd=fs.openSync(lock,'wx');
      ownsLock=true;
      try{fs.writeFileSync(fd,String(process.pid));}finally{fs.closeSync(fd);}
      return true;
    }catch(error){
      if(error.code!=='EEXIST')throw error;
      let pid;
      try{pid=Number(fs.readFileSync(lock,'utf8'));}catch(error){if(error.code==='ENOENT')continue;throw error;}
      if(Number.isInteger(pid)&&pid>0){
        try{process.kill(pid,0);}catch(error){
          if(error.code==='ESRCH'){
            try{fs.unlinkSync(lock);}catch(error){if(error.code!=='ENOENT')throw error;}
            continue;
          }
        }
      }else if(Date.now()-fs.statSync(lock).mtimeMs>120000){
        fs.unlinkSync(lock);
        continue;
      }
      if(await healthy())return false;
      await delay(500);
    }
  }
  throw new Error('Otro inicio de ARCA sigue en curso. Intenta de nuevo en un minuto.');
}

async function ensureServer(){
  if(await healthy())return;
  const acquired=await acquireLock();
  if(!acquired)return;
  if(await healthy())return;
  if(!fs.existsSync(path.join(root,'dist','index.html')))throw new Error('Falta la interfaz compilada en dist.');
  if(!await listening(databaseHost,databasePort)){
    if(!['127.0.0.1','localhost'].includes(databaseHost))throw new Error('La base de datos configurada no responde.');
    const data=path.join(runtime,'mysql-data');
    if(!fs.existsSync(path.join(data,'mysql')))throw new Error('No se encontro la base local instalada.');
    await launchBackground('C:/xampp/mysql/bin/mysqld.exe',[
      '--no-defaults','--basedir=C:/xampp/mysql','--datadir='+data,
      '--port='+databasePort,'--bind-address=127.0.0.1','--skip-named-pipe','--skip-networking=0','--console'
    ],'desktop-database.log');
    for(let i=0;i<60&&!await listening(databaseHost,databasePort);i++)await delay(500);
    if(!await listening(databaseHost,databasePort))throw new Error('La base local no pudo iniciar. Revisa desktop-database.log.');
  }
  if(!await listening('127.0.0.1',port)){
    await launchBackground(process.execPath,[path.join(root,'server','index.js')],'desktop-server.log');
  }
  for(let i=0;i<60;i++){
    if(await healthy())return;
    await delay(500);
  }
  throw new Error('El servidor no responde correctamente. Revisa desktop-server.log.');
}

async function openApp(){
  const candidates=[
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
  ];
  const browser=candidates.find(p=>fs.existsSync(p));
  if(!browser)throw new Error('No se encontro Chrome ni Edge instalado.');
  await new Promise((resolve,reject)=>{
    const child=spawn(browser,['--app='+address],{detached:true,windowsHide:false,stdio:'ignore'});
    child.once('error',reject);
    child.once('spawn',()=>{child.unref();resolve();});
  });
}

try{
  fs.mkdirSync(runtime,{recursive:true});
  if(!Number.isInteger(port)||port<1||port>65535||!Number.isInteger(databasePort)||databasePort<1||databasePort>65535)throw new Error('Puerto local invalido.');
  await ensureServer();
  if(!process.argv.includes('--check'))await openApp();
  console.log('ARCA lista en '+address);
}catch(error){
  try{fs.appendFileSync(path.join(runtime,'desktop-error.log'),new Date().toISOString()+' '+error.message+'\n');}catch{}
  console.error(error.message);
  process.exitCode=1;
}finally{
  if(ownsLock){try{fs.unlinkSync(lock);}catch{}}
}
