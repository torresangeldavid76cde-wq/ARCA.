import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {databaseConfig,poolConfig} from '../server/db-config.js';

const pem='-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----';
const aiven={DB_HOST:'mysql-project.aivencloud.com',DB_PORT:'12345',DB_NAME:'defaultdb',DB_USER:'app',DB_PASSWORD:'private',DB_SSL:'true',DB_SSL_CA:pem};

test('Aiven usa el puerto y nombre configurados y verifica CA e identidad TLS',()=>{
 const config=databaseConfig(aiven,{required:true});
 assert.equal(config.port,12345);
 assert.equal(config.database,'defaultdb');
 assert.deepEqual(config.ssl,{ca:pem,rejectUnauthorized:true,verifyIdentity:true,minVersion:'TLSv1.2'});
 for(const values of [{DB_SSL:'false'},{DB_SSL_CA:''},{DB_SSL:'invalid'},{DB_PORT:'3306x'}])assert.throws(()=>databaseConfig({...aiven,...values}));
});

test('el certificado admite saltos escapados de .env y un archivo local',()=>{
 assert.equal(databaseConfig({...aiven,DB_SSL_CA:pem.replaceAll('\n','\\n')}).ssl.ca,pem);
 const directory=mkdtempSync(path.join(tmpdir(),'arca-test-ca-'));
 try{
  const file=path.join(directory,'ca.pem');
  writeFileSync(file,pem);
  assert.equal(databaseConfig({...aiven,DB_SSL_CA:'',DB_SSL_CA_PATH:file}).ssl.ca,pem);
  assert.throws(()=>databaseConfig({...aiven,DB_SSL_CA_PATH:file}),/Usa solo/);
 }finally{
  if(path.dirname(path.resolve(directory))===path.resolve(tmpdir())&&path.basename(directory).startsWith('arca-test-ca-'))rmSync(directory,{recursive:true,force:true});
 }
});

test('la conexión local se conserva y las credenciales administrativas solo se usan explícitamente',()=>{
 assert.equal(databaseConfig({DB_SSL:'false'}).ssl,undefined);
 const env={...aiven,DB_ADMIN_USER:'admin',DB_ADMIN_PASSWORD:'admin-private'};
 assert.equal(databaseConfig(env).user,'app');
 assert.equal(databaseConfig(env,{admin:true}).user,'admin');
 assert.equal(databaseConfig({...aiven,DB_ADMIN_USER:'',DB_ADMIN_PASSWORD:''},{admin:true}).password,'private');
 assert.throws(()=>databaseConfig({},{prefix:'SOURCE_DB_',required:true}),/SOURCE_DB_HOST/);
});

test('Vercel limita el pool por instancia y rechaza límites inválidos',()=>{
 assert.equal(poolConfig({VERCEL:'1'}).connectionLimit,2);
 assert.equal(poolConfig({VERCEL:'1'}).idleTimeout,5000);
 assert.equal(poolConfig({}).connectionLimit,8);
 for(const DB_CONNECTION_LIMIT of ['0','NaN','101'])assert.throws(()=>poolConfig({DB_CONNECTION_LIMIT}));
});
