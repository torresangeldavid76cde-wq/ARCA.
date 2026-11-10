import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import bcrypt from 'bcryptjs';
import {db,query} from '../server/db.js';

const base='http://127.0.0.1:4180/api';
const credentials=Object.fromEntries((await fs.readFile(new URL('../CUENTAS-DEMO.txt',import.meta.url),'utf8')).split(/\r?\n/).map(line=>line.split('|')).filter(parts=>parts.length>1).map(([email,...password])=>[email.trim(),password.join('|').trim()]));
async function call(route,method='GET',body,cookie){
 const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});
 return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function login(role){
 const response=await call('/login','POST',{email:role+'@arca.demo',password:credentials[role+'@arca.demo'],terms:true});
 assert.equal(response.status,200);
 return response.cookie;
}

test('eventos y llamados dominicales conservan datos y permisos',async t=>{
 const suffix=randomUUID(),cookies=[],eventIds=[],memberIds=[],userIds=[];
 const admin=await login('administrador'),teacher=await login('docente'),student=await login('estudiante');
 cookies.push(admin,teacher,student);
 try{
  const email='multimedia.'+suffix+'@arca.demo',password=randomUUID();
  const fixture=await query("INSERT INTO users(name,email,password_hash,role,active,must_change,estado) VALUES('Multimedia de prueba',?,?,'multimedia',TRUE,FALSE,'activa')",[email,await bcrypt.hash(password,12)]);
  userIds.push(fixture.insertId);
  const multimediaLogin=await call('/login','POST',{email,password,terms:true});
  assert.equal(multimediaLogin.status,200);
  const multimedia=multimediaLogin.cookie;
  cookies.push(multimedia);
  await t.test('crear, consultar, editar y cancelar un evento',async()=>{
   const data={title:'Evento '+suffix,kind:'especial',event_date:'2097-01-03T17:00',location:'Sede de prueba',description:'Evento de prueba'};
   assert.equal((await call('/events','POST',data)).status,401);
   assert.equal((await call('/events','POST',data,student)).status,403);
   assert.equal((await call('/events','POST',data,admin)).status,201);
   const event=(await call('/events','GET',null,admin)).body.find(e=>e.title===data.title);
   assert.ok(event);eventIds.push(event.id);
   const changes={title:'Evento actualizado '+suffix,event_date:'2097-01-04T18:00',status:'programado',location:'Otra sede',description:'Descripción actualizada',image_url:'',registration:true};
   assert.equal((await call('/events/'+event.id,'PATCH',changes,teacher)).status,403);
   assert.equal((await call('/events/'+event.id,'PATCH',changes,admin)).status,200);
   const saved=(await call('/events','GET',null,student)).body.find(e=>e.id===event.id);
   assert.equal(saved.title,changes.title);assert.equal(saved.description,changes.description);assert.equal(saved.location,changes.location);assert.equal(saved.registration,1);
   assert.equal(saved.event_date,'2097-01-04 18:00:00');
   assert.equal((await call('/events/'+event.id,'PATCH',{event_date:changes.event_date,status:'cancelado'},admin)).status,200);
   assert.equal((await call('/events','GET',null,admin)).body.find(e=>e.id===event.id).status,'cancelado');
   assert.equal((await call('/events/4294967295','PATCH',changes,admin)).status,404);
  });
  let date;
  const start=new Date('2097-01-01T12:00:00Z');
  for(let i=0;i<366;i++){
   start.setUTCDate(start.getUTCDate()+1);
   if(start.getUTCDay()!==0)continue;
   const candidate=start.toISOString().slice(0,10);
   const [existing]=await query("SELECT id FROM events WHERE kind='servicio' AND event_date>=? AND event_date<DATE_ADD(?,INTERVAL 1 DAY)",[candidate,candidate]);
   if(!existing){date=candidate;break}
  }
  assert.ok(date,'Debe haber un domingo de prueba libre');
  let service;
  await t.test('el llamado admite solo domingos y reutiliza el servicio ante solicitudes simultáneas',async()=>{
   assert.equal((await call('/sunday-services','POST',{date})).status,401);
   assert.equal((await call('/sunday-services','POST',{date},student)).status,403);
   for(const invalid of ['2097-01-01','2097-02-31','fecha inválida']){
    assert.equal((await call('/sunday-services','POST',{date:invalid},admin)).status,400);
   }
   const attempts=await Promise.all(Array.from({length:5},()=>call('/sunday-services','POST',{date},teacher)));
   for(const result of attempts){
    if(result.body.id&&!eventIds.includes(result.body.id))eventIds.push(result.body.id);
    assert.ok([200,201].includes(result.status));
   }
   assert.equal(new Set(attempts.map(result=>result.body.id)).size,1);
   assert.equal(attempts.filter(result=>result.status===201).length,1);
   service=attempts[0].body;
   assert.equal((await call('/sunday-services','POST',{date},multimedia)).body.id,service.id);
   const saved=(await call('/events','GET',null,admin)).body.find(e=>e.id===service.id);
   assert.equal(saved.kind,'servicio');assert.equal(saved.event_date,date+' 09:00:00');
   assert.equal(saved.course_id,null);assert.equal(saved.group_id,null);
  });
  await t.test('la lista dominical guarda estados y mantiene las restricciones de corrección',async()=>{
   assert.ok(service);
   const member=await query("INSERT INTO members(name,id_type,identification,phone,birthday) VALUES(?,'DEMO',?,'0000000000','2000-01-01')",['Discípulo '+suffix,suffix]);
   memberIds.push(member.insertId);
   assert.equal((await call('/attendance/'+service.id)).status,401);
   assert.equal((await call('/attendance/'+service.id,'GET',null,student)).status,403);
   const roster=(await call('/attendance/'+service.id,'GET',null,multimedia)).body;
   assert.equal(roster.find(m=>m.id===member.insertId).status,null);
   const status={member_id:member.insertId,status:'presente'};
   assert.equal((await call('/attendance/'+service.id,'POST',status,multimedia)).status,200);
   assert.equal((await call('/attendance/'+service.id,'GET',null,teacher)).body.find(m=>m.id===member.insertId).status,'presente');
   assert.equal((await call('/attendance/'+service.id,'POST',{...status,status:'ausente'},teacher)).status,403);
   assert.equal((await call('/attendance/'+service.id,'POST',{...status,status:'justificado'},admin)).status,200);
   const history=(await call('/members/'+member.insertId+'/history','GET',null,admin)).body.history;
   assert.ok(history.some(row=>row.status==='justificado'&&row.event_date===date+' 09:00:00'));
   assert.equal((await call('/events/'+service.id,'PATCH',{event_date:date+'T09:00',status:'cancelado'},admin)).status,200);
   assert.equal((await call('/attendance/'+service.id,'POST',status,admin)).status,400);
   const replacement=await call('/sunday-services','POST',{date},admin);
   if(replacement.body.id)eventIds.push(replacement.body.id);
   assert.equal(replacement.status,201);assert.notEqual(replacement.body.id,service.id);
   assert.equal((await call('/attendance/'+replacement.body.id,'GET',null,admin)).body.find(m=>m.id===member.insertId).status,null);
  });
 }finally{
  for(const id of eventIds){await query('DELETE FROM attendance WHERE event_id=?',[id]);await query('DELETE FROM events WHERE id=?',[id])}
  for(const id of memberIds)await query('DELETE FROM members WHERE id=?',[id]);
  for(const cookie of cookies)await call('/logout','POST',null,cookie);
  for(const id of userIds){await query('DELETE FROM audit WHERE user_id=?',[id]);await query('DELETE FROM users WHERE id=?',[id])}
  await db.end();
 }
});
