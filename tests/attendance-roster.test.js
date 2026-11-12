import assert from 'node:assert/strict';
import {after,before,test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

let server,AttendanceRoster;
before(async()=>{
 server=await createServer({server:{middlewareMode:true},appType:'custom'});
 ({AttendanceRoster}=await server.ssrLoadModule('/src/SundayAttendance.jsx'));
});
after(async()=>{if(server)await server.close()});

function buttons({status=null,role='administrador',busy=false,cancelled=false}={}){
 const html=renderToStaticMarkup(React.createElement(AttendanceRoster,{
  rows:[{id:1,name:'Ana',status}],user:{role},busy,cancelled,onMark:()=>{}
 }));
 assert.doesNotMatch(html,/<select/);
 return [...html.matchAll(/<button\b([^>]*)>([^<]*)<\/button>/g)].map(([,attributes,label])=>({
  label,pressed:attributes.includes('aria-pressed="true"'),disabled:attributes.includes('disabled=""')
 }));
}

test('cada estado se muestra como un botón disponible en una asistencia nueva',()=>{
 assert.deepEqual(buttons(),['presente','ausente','justificado','visitante'].map(label=>({label,pressed:false,disabled:false})));
});

test('el estado guardado queda marcado y solo el personal pastoral puede corregirlo',()=>{
 const admin=buttons({status:'ausente'});
 assert.deepEqual(admin.find(button=>button.label==='ausente'),{label:'ausente',pressed:true,disabled:true});
 assert.ok(admin.filter(button=>button.label!=='ausente').every(button=>!button.disabled));
 assert.ok(buttons({status:'ausente',role:'docente'}).every(button=>button.disabled));
});

test('no se puede registrar mientras se guarda ni en encuentros cancelados',()=>{
 assert.ok(buttons({busy:true}).every(button=>button.disabled));
 assert.ok(buttons({cancelled:true}).every(button=>button.disabled));
});
