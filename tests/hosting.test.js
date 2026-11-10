import assert from 'node:assert/strict';
import {once} from 'node:events';
import {after,test} from 'node:test';
import {readFile} from 'node:fs/promises';

// No queries or writes to the local database: invalid login bodies stop at validation.
process.env.PORT='0';
process.env.HOST='0.0.0.0';
process.env.NODE_ENV='production';
process.env.TRUST_PROXY_HOPS='1';
process.env.VERCEL='1';
const {default:app}=await import('../api/index.js');
const server=app.listen(0,'0.0.0.0');
const {db}=await import('../server/db.js');
if(!server.listening)await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`;
const httpsOrigin=base.replace('http:','https:');
after(async()=>{
  await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  await db.end();
});

function login(origin,forwardedProto='https'){
  return fetch(base+'/api/login',{
    method:'POST',
    headers:{'Content-Type':'application/json',Origin:origin,'X-Forwarded-Proto':forwardedProto},
    body:'{}'
  });
}

test('el servidor admite conexiones externas con el proxy configurado',()=>{
  assert.equal(server.address().address,'0.0.0.0');
  assert.equal(app.get('trust proxy'),1);
});

test('Vercel envia la API a Express antes de resolver archivos o la interfaz',async()=>{
  const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
  const [api,files,spa]=config.routes;
  assert.equal(config.rewrites,undefined);
  assert.equal(api.dest,'/api/index.js');
  const pattern=new RegExp('^'+api.src+'$');
  for(const path of ['/api','/api/health','/api/login','/api/events/1','/api/reports/asistencia/pdf']){
    assert.ok(pattern.test(path),path);
  }
  for(const path of ['/','/assets/main.js','/logo-arca.png','/api-other']){
    assert.equal(pattern.test(path),false,path);
  }
  assert.equal(files.handle,'filesystem');
  assert.equal(spa.dest,'/index.html');
});

test('HTTPS del proxy permite validar el formulario del mismo origen',async()=>{
  const response=await login(httpsOrigin);
  assert.equal(response.status,400);
  assert.equal((await response.json()).error,'Revisa los campos del formulario');
});

test('el proxy no permite solicitudes desde otros sitios ni cambiar HTTPS por HTTP',async()=>{
  for(const origin of ['https://otro.example.com',base]){
    const response=await login(origin);
    assert.equal(response.status,403);
    assert.equal((await response.json()).error,'Origen no permitido');
  }
});
