import 'dotenv/config';
import mysql from 'mysql2/promise';
import {spawn} from 'node:child_process';
import {createReadStream,existsSync} from 'node:fs';
import {mkdtemp,readFile,writeFile,rm,mkdir,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {databaseConfig} from './db-config.js';
import {migrate} from './migrate.js';
import {importDump} from './sql-dump.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const backup=path.join(root,'runtime','aiven-backup.sql');
const manifestFile=backup+'.json';
const id=name=>'`'+String(name).replaceAll('`','``')+'`';

export function selectedDatabaseSql(sql){
 // These repository scripts must use the database selected by the connection,
 // including Aiven's defaultdb. They must never create or select local arc.
 return sql.replace(/^\s*(?:CREATE DATABASE\b[^;]*;|USE\s+[^;]*;)/gmi,'');
}

export function optionValue(value){
 // MySQL option-file quoting; passwords never appear in process arguments.
 return '"'+String(value).replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('\n','\\n').replaceAll('\r','\\r')+'"';
}

async function connect({source=false,admin=false}={}){
 const config=databaseConfig(process.env,{prefix:source?'SOURCE_DB_':'DB_',required:true,admin});
 if(!source&&!config.ssl)throw new Error('Los comandos de nube requieren DB_SSL=true y una conexión TLS verificada');
 const connection=await mysql.createConnection({...config,multipleStatements:true});
 return {connection,config};
}

async function counts(c){
 const [tables]=await c.query('SELECT TABLE_NAME name,TABLE_TYPE kind,ENGINE engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME');
 const result={};
 for(const table of tables){
  if(table.kind!=='BASE TABLE'||table.engine!=='InnoDB')throw new Error('La migración requiere tablas InnoDB sin vistas: '+table.name);
  const [[row]]=await c.query('SELECT COUNT(*) n FROM '+id(table.name));
  result[table.name]=String(row.n);
 }
 return result;
}

export async function emptyTarget(c){
 const [[row]]=await c.query('SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
 if(Number(row.n)!==0)throw new Error('El destino debe estar completamente vacío. No se borró ni sobrescribió ninguna tabla. Usa una base nueva para importar.');
}

export function sameTableCounts(actual,expected){
 const names=Object.keys(expected);
 return Object.keys(actual).length===names.length&&names.every(name=>Object.hasOwn(actual,name)&&String(actual[name])===String(expected[name]));
}

async function checksum(file){
 const hash=createHash('sha256');
 for await(const chunk of createReadStream(file))hash.update(chunk);
 return hash.digest('hex');
}

export async function verifyBackup(file,manifest){
 if(manifest.version!==1||!manifest.tables||!['users','members','events','sessions'].every(table=>Object.hasOwn(manifest.tables,table)))throw new Error('El manifiesto no corresponde a un respaldo de ARCA');
 if(manifest.sha256!==await checksum(file))throw new Error('El respaldo no coincide con su manifiesto. No se importó.');
 if(!(await stat(file)).size)throw new Error('El respaldo está vacío');
}

function execute(binary,args){
 return new Promise((resolve,reject)=>{
  const child=spawn(binary,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';
  child.stdout.on('data',chunk=>{if(output.length<4096)output+=chunk.toString()});
  // Do not expose SQL rows, option-file contents or server diagnostics in logs.
  child.stderr.resume();
  child.once('error',()=>reject(new Error('No se pudo ejecutar '+path.basename(binary)+'. Configura MYSQLDUMP_BIN.')));
  child.once('close',code=>{
   code===0?resolve(output):reject(new Error(`${path.basename(binary)} terminó con código ${code}. No se generó un respaldo utilizable; revisa el cliente y los permisos del origen.`));
  });
 });
}

async function withDumpClient(config,run){
 const local='C:/xampp/mysql/bin/mysqldump.exe';
 const binary=process.env.MYSQLDUMP_BIN||(process.platform==='win32'&&existsSync(local)?local:'mysqldump');
 const version=await execute(binary,['--version']);
 const maria=/mariadb/i.test(version);
 const directory=await mkdtemp(path.join(tmpdir(),'arca-db-'));
 try{
  let text='[client]\n'+Object.entries({host:config.host,port:config.port,user:config.user,password:config.password,'default-character-set':'utf8mb4'}).map(([key,value])=>key+'='+optionValue(value)).join('\n')+'\n';
  if(config.ssl){
   if(config.ssl.ca){
    const certificate=path.join(directory,'ca.pem');
    await writeFile(certificate,config.ssl.ca,{mode:0o600});
    text+='ssl-ca='+optionValue(certificate)+'\n';
   }
   text+=maria?'ssl=1\nssl-verify-server-cert=1\n':'ssl-mode=VERIFY_IDENTITY\n';
  }else text+=maria?'skip-ssl\n':'ssl-mode=DISABLED\n';
  const file=path.join(directory,'client.cnf');
  await writeFile(file,text,{mode:0o600});
  return await run(binary,['--defaults-file='+file],maria);
 }finally{
  // mkdtemp always creates this private child under the OS temporary directory.
  const resolved=path.resolve(directory),parent=path.resolve(tmpdir());
  if(path.dirname(resolved)===parent&&path.basename(resolved).startsWith('arca-db-'))await rm(resolved,{recursive:true,force:true});
 }
}

export async function applySchema(c){
 for(const name of ['arc.sql','migracion_permisos.sql']){
  const sql=await readFile(new URL('../database/'+name,import.meta.url),'utf8');
  await c.query(selectedDatabaseSql(sql));
 }
 await migrate(c);
}

async function exportDatabase(){
 if(existsSync(backup)||existsSync(manifestFile))throw new Error('Ya existe runtime/aiven-backup.sql o su manifiesto. Conserva ambos con otro nombre antes de generar otro respaldo.');
 const {connection:c,config}=await connect({source:true});
 try{
  const [[objects]]=await c.query('SELECT (SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE())+(SELECT COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=DATABASE())+(SELECT COUNT(*) FROM information_schema.EVENTS WHERE EVENT_SCHEMA=DATABASE()) n');
  if(Number(objects.n))throw new Error('La base tiene triggers, rutinas o eventos. Requiere una migración específica; no se generó un respaldo incompleto.');
  const before=await counts(c);
  if(!before.users||!before.members||!before.events)throw new Error('SOURCE_DB_NAME no parece una base de ARCA');
  await mkdir(path.dirname(backup),{recursive:true});
  await writeFile(backup,'',{flag:'wx',mode:0o600});
  await withDumpClient(config,(binary,args,maria)=>execute(binary,[...args,'--single-transaction','--quick','--skip-lock-tables','--skip-add-locks','--skip-add-drop-table','--hex-blob','--skip-triggers',...(!maria?['--set-gtid-purged=OFF','--no-tablespaces']:[]),'--result-file='+backup,config.database]));
  const after=await counts(c);
  if(!sameTableCounts(after,before))throw new Error('La base cambió durante el respaldo. Pausa las escrituras y genera otra copia. El respaldo no tiene manifiesto y no se puede importar con este comando.');
  await writeFile(manifestFile,JSON.stringify({version:1,createdAt:new Date().toISOString(),database:config.database,tables:before,sha256:await checksum(backup)},null,2)+'\n',{flag:'wx',mode:0o600});
  console.log('Respaldo y manifiesto guardados en runtime/aiven-backup.sql. Mantén ambos privados.');
 }finally{await c.end()}
}

async function importDatabase(){
 const manifest=JSON.parse(await readFile(manifestFile,'utf8'));
 await verifyBackup(backup,manifest);
 const {connection:c,config}=await connect({admin:true});
 const lockName=createHash('sha256').update('arca-import:'+config.database).digest('hex');
 let locked=false;
 try{
  const [[lock]]=await c.execute('SELECT GET_LOCK(?,0) acquired',[lockName]);
  if(Number(lock.acquired)!==1)throw new Error('Ya hay otra importación en curso');
  locked=true;
  await emptyTarget(c);
  await importDump(c,backup);
  const imported=await counts(c);
  if(!sameTableCounts(imported,manifest.tables))throw new Error('Los conteos importados no coinciden con el respaldo. No publiques esta base.');
  // Sessions from another installation must never remain valid on the public site.
  await c.query('DELETE FROM sessions');
  console.log('Importación verificada por tabla. Sesiones anteriores revocadas. Ejecuta npm run db:migrate antes de desplegar.');
 }finally{
  try{if(locked)await c.execute('SELECT RELEASE_LOCK(?)',[lockName])}finally{await c.end()}
 }
}

async function inspect(command){
 const {connection:c}=await connect({admin:command==='migrate'});
 try{
  if(command==='migrate'){
   await applySchema(c);
   console.log('Esquema actualizado en DB_NAME sin generar usuarios ni contraseñas demo.');
  }else{
   const [[tls]]=await c.query("SHOW SESSION STATUS LIKE 'Ssl_cipher'");
   if(!tls.Value)throw new Error('La conexión no está cifrada');
   const tables=await counts(c);
   console.log('Conexión TLS verificada. Conteos de tablas (sin datos personales):');
   console.table(tables);
   const schema=await readFile(new URL('../database/arc.sql',import.meta.url),'utf8');
   const expected=[...schema.matchAll(/^CREATE TABLE IF NOT EXISTS `([^`]+)`/gm)].map(match=>match[1]);
   if(expected.some(table=>!Object.hasOwn(tables,table)))throw new Error('Faltan tablas. Ejecuta npm run db:migrate y repite db:check.');
   const required={users:['photo_data','estado','birthday','eps'],roles:['nombre_visible'],permisos_rol:['aplicado'],members:['user_id','photo_data','born_again'],courses:['book','group_id'],events:['course_id','checkin_token_hash']};
   for(const [table,columns]of Object.entries(required)){
    const [found]=await c.execute('SELECT COLUMN_NAME name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',[table]);
    if(columns.some(name=>!found.some(row=>row.name===name)))throw new Error('Esquema incompleto. Ejecuta npm run db:migrate y repite db:check.');
   }
   console.log('Columnas requeridas verificadas.');
  }
 }finally{await c.end()}
}

async function main(){
 const [command,...flags]=process.argv.slice(2);
 if(!['check','export','import','migrate'].includes(command)||flags.some(flag=>flag!=='--apply'))throw new Error('Uso: node server/database-cli.js check|export|import|migrate [--apply]');
 if(['import','migrate'].includes(command)&&!flags.includes('--apply')){
  console.log('No se modificó la base. Añade --apply para '+(command==='import'?'importar el respaldo en un destino vacío.':'actualizar el esquema sin cuentas demo.'));
  return;
 }
 if(command==='export')await exportDatabase();
 else if(command==='import')await importDatabase();
 else await inspect(command);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(error=>{
  // Driver errors may contain SQL or connection details; only report the code.
  console.error(error.sqlState||error.errno?`Operación MySQL fallida (${error.code||'MYSQL_ERROR'}). Revisa permisos, TLS y compatibilidad del esquema.`:error.message);
  process.exitCode=1;
 });
}
