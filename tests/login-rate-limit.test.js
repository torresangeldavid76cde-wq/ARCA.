import assert from 'node:assert/strict';
import {once} from 'node:events';
import {test} from 'node:test';
import express from 'express';
import {createLoginRateLimit} from '../server/login-rate-limit.js';

test('los accesos correctos no bloquean el login; los fallidos devuelven un aviso JSON',async()=>{
  const app=express();
  app.post('/login',createLoginRateLimit(),(req,res)=>{
    res.status(req.query.fail==='1'?401:200).json({ok:req.query.fail!=='1'});
  });
  const server=app.listen(0,'127.0.0.1');
  try{
    await once(server,'listening');
    const base=`http://127.0.0.1:${server.address().port}/login`;
    for(let i=0;i<35;i++){
      const r=await fetch(base,{method:'POST'});
      assert.equal(r.status,200);
      await r.json();
    }
    for(let i=0;i<30;i++){
      const r=await fetch(base+'?fail=1',{method:'POST'});
      assert.equal(r.status,401);
      await r.json();
    }
    const blocked=await fetch(base,{method:'POST'});
    assert.equal(blocked.status,429);
    assert.match(blocked.headers.get('content-type'),/application\/json/);
    assert.ok(Number(blocked.headers.get('retry-after'))>0);
    assert.match((await blocked.json()).error,/Espera 15 minutos/);
  }finally{
    await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
});
