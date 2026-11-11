import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {applySchema,emptyTarget,optionValue,sameTableCounts,selectedDatabaseSql,verifyBackup} from '../server/database-cli.js';

test('el esquema de nube respeta DB_NAME y conserva las tablas y las migraciones',async()=>{
 for(const name of ['arc.sql','migracion_permisos.sql']){
  const sql=selectedDatabaseSql(await readFile(new URL('../database/'+name,import.meta.url),'utf8'));
  assert.doesNotMatch(sql,/^\s*(CREATE DATABASE|USE)\b/im);
  assert.match(sql,/CREATE TABLE IF NOT EXISTS/);
 }
 const commands=[];
 const connection={
  query:async sql=>{commands.push(sql);return [[]]},
  execute:async(sql,args)=>{
   commands.push(sql);
   if(sql.includes('information_schema.COLUMNS')&&args?.length===2)return [[{exists:1}]];
   return [[{exists:1}]];
  }
 };
 await applySchema(connection);
 assert.ok(commands.some(sql=>sql.includes('checkin_token_hash')));
 assert.ok(commands.some(sql=>sql.includes('nombre_visible')));
 assert.ok(commands.some(sql=>sql.includes('INSERT IGNORE INTO roles')));
 assert.ok(!commands.some(sql=>/INSERT\s+INTO\s+users|bcrypt|DROP\s+TABLE/i.test(sql)));
});

test('los comandos de escritura requieren --apply antes de conectarse',()=>{
 for(const command of ['migrate','import']){
  const result=spawnSync(process.execPath,['server/database-cli.js',command],{cwd:new URL('../',import.meta.url),encoding:'utf8',env:{...process.env,DB_HOST:'invalid.invalid'}});
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/No se modificó la base/);
 }
});

test('el archivo privado de opciones conserva caracteres especiales de las claves',()=>{
 assert.equal(optionValue('a"b\\c\nd\re'),'"a\\"b\\\\c\\nd\\re"');
});

test('la importación rechaza destinos con tablas aunque no tengan filas',async()=>{
 for(const n of [1,19])await assert.rejects(emptyTarget({query:async()=>[[{n}]]}),/completamente vacío/);
 await emptyTarget({query:async()=>[[{n:0}]]});
});

test('compara conteos por nombre sin depender del orden de MariaDB o MySQL',()=>{
 const expected={courses:'8',course_members:'32',users:'48'};
 assert.equal(sameTableCounts({course_members:32,courses:8,users:48},expected),true);
 assert.equal(sameTableCounts({courses:8,course_members:31,users:48},expected),false);
 assert.equal(sameTableCounts({courses:8,users:48},expected),false);
 assert.equal(sameTableCounts({...expected,extra:0},expected),false);
});

test('un respaldo alterado o sin manifiesto válido no se puede importar',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'arca-test-backup-'));
 try{
  const file=path.join(directory,'backup.sql');
  const sql='CREATE TABLE users(id INT PRIMARY KEY);\n';
  const manifest={version:1,tables:{users:'0',members:'0',events:'0',sessions:'0'},sha256:createHash('sha256').update(sql).digest('hex')};
  await writeFile(file,sql);
  await verifyBackup(file,manifest);
  await assert.rejects(verifyBackup(file,{...manifest,tables:{}}),/manifiesto/);
  await writeFile(file,sql+'DROP TABLE users;\n');
  await assert.rejects(verifyBackup(file,manifest),/no coincide/);
 }finally{
  if(path.dirname(path.resolve(directory))===path.resolve(tmpdir())&&path.basename(directory).startsWith('arca-test-backup-'))await rm(directory,{recursive:true,force:true});
 }
});
