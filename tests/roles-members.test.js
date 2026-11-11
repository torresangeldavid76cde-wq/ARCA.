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

test('el módulo de roles administra el catálogo y conserva asignación compatible',async()=>{
 const admin=await login('administrador');
 let guest,student,originalRole,fixtureUser;
 try{
  const response=await call('/admin/roles','GET',null,admin);
  assert.equal(response.status,200);
  assert.ok(response.body.roles.some(role=>role.nombre==='pastor'));
  const role=response.body.roles.find(item=>item.nombre==='asistencia_pastoral');
  originalRole=role;
  const discipleModule=response.body.modules.find(module=>module.nombre==='Discípulos');
  const permissions=role.permisos.map(item=>({
   modulo_id:Number(item.modulo_id),
   puede_ver:Number(item.modulo_id)===Number(discipleModule.id),
   puede_crear:false,
   puede_editar:false,
   puede_eliminar:false
  }));
  const update={nombre_visible:'Asistencia de prueba',descripcion:'Prueba de actualización',aplicar_permisos:true,permisos:permissions};
  assert.equal((await call('/admin/roles/'+role.id,'PUT',update,admin)).status,200);
  const labels=await call('/roles','GET',null,admin);
  assert.equal(labels.body.find(item=>item.nombre===role.nombre).nombre_visible,update.nombre_visible);
  const saved=(await call('/admin/roles','GET',null,admin)).body.roles.find(item=>item.id===role.id);
  assert.equal(Number(saved.permisos.find(item=>item.modulo==='Discípulos').aplicado),1);
  assert.equal((await call('/admin/roles/'+role.id,'PUT',{...update,permisos:[]},admin)).status,400);
  guest=await login('estudiante');
  assert.equal((await call('/admin/roles','GET',null,guest)).status,403);

  const suffix=randomUUID(),email=`role.${suffix}@arca.demo`,password='Role-test-password-2026!';
  const created=await query("INSERT INTO users(name,email,password_hash,role,active,must_change,estado) VALUES('Cuenta de prueba',?,?, 'estudiante',TRUE,FALSE,'activa')",[email,await bcrypt.hash(password,12)]);
  fixtureUser=created.insertId;
  assert.equal((await call('/admin/usuarios/'+fixtureUser+'/rol','PUT',{role:'asistencia_pastoral'},admin)).status,200);
  const fixtureLogin=await call('/login','POST',{email,password,terms:true});assert.equal(fixtureLogin.status,200);student=fixtureLogin.cookie;
  assert.equal((await call('/members','GET',null,student)).status,200);
  const deniedPermissions=permissions.map(permission=>({...permission,puede_ver:false}));
  assert.equal((await call('/admin/roles/'+role.id,'PUT',{...update,permisos:deniedPermissions},admin)).status,200);
  assert.equal((await call('/members','GET',null,student)).status,403);
  const [updatedUser]=await query('SELECT role FROM users WHERE id=?',[fixtureUser]);
  assert.equal(updatedUser.role,'asistencia_pastoral');
 }finally{
  if(originalRole){
   await query('UPDATE roles SET nombre_visible=?,descripcion=? WHERE id=?',[originalRole.nombre_visible,originalRole.descripcion,originalRole.id]);
   for(const permission of originalRole.permisos)await query('INSERT INTO permisos_rol(rol_id,modulo_id,puede_ver,puede_crear,puede_editar,puede_eliminar,aplicado) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE puede_ver=VALUES(puede_ver),puede_crear=VALUES(puede_crear),puede_editar=VALUES(puede_editar),puede_eliminar=VALUES(puede_eliminar),aplicado=VALUES(aplicado)',[originalRole.id,permission.modulo_id,permission.puede_ver,permission.puede_crear,permission.puede_editar,permission.puede_eliminar,permission.aplicado]);
  }
  if(fixtureUser){
   await query('DELETE FROM sessions WHERE user_id=?',[fixtureUser]);
   await query('DELETE FROM audit WHERE user_id=?',[fixtureUser]);
   await query('DELETE FROM users WHERE id=?',[fixtureUser]);
  }
  await call('/logout','POST',null,admin);
  if(guest)await call('/logout','POST',null,guest);
  if(student)await call('/logout','POST',null,student);
 }
});

test('el discipulador solo puede listar y agregar discípulos en grupos propios',async()=>{
 const suffix=randomUUID(),leaderEmail=`leader.${suffix}@arca.demo`,otherEmail=`other.${suffix}@arca.demo`,password='Group-test-password-2026!';
 const leader=await query("INSERT INTO users(name,email,password_hash,role,active,must_change,estado) VALUES('Líder de prueba',?,?, 'discipulador',TRUE,FALSE,'activa')",[leaderEmail,await bcrypt.hash(password,12)]);
 const otherLeader=await query("INSERT INTO users(name,email,password_hash,role,active,must_change,estado) VALUES('Otro líder de prueba',?,?, 'discipulador',TRUE,FALSE,'activa')",[otherEmail,await bcrypt.hash(password,12)]);
 let ownGroup,otherGroup,otherMember,ownEvent,otherEvent,foreignCourse,leaderCookie;
 const ids=[];
 try{
  const createdOwnGroup=await query('INSERT INTO groups_family(name,leader_id) VALUES(?,?)',['Grupo propio '+suffix,leader.insertId]);ownGroup=createdOwnGroup.insertId;
  const createdOtherGroup=await query('INSERT INTO groups_family(name,leader_id) VALUES(?,?)',['Grupo ajeno '+suffix,otherLeader.insertId]);otherGroup=createdOtherGroup.insertId;
  const createdOtherMember=await query("INSERT INTO members(name,id_type,identification,phone,birthday,group_id) VALUES(?,'CC',?,'3000000000','2000-01-01',?)",['Persona de otro grupo '+suffix,suffix,otherGroup]);otherMember=createdOtherMember.insertId;
  const loginResponse=await call('/login','POST',{email:leaderEmail,password,terms:true});assert.equal(loginResponse.status,200);leaderCookie=loginResponse.cookie;

  const groupList=await call('/groups','GET',null,leaderCookie);
  assert.equal(groupList.status,200);
  assert.deepEqual(groupList.body.map(group=>Number(group.id)),[ownGroup]);
  const payload={name:'Nuevo discípulo '+suffix,id_type:'CC',identification:'D-'+suffix,phone:'3000000000',birthday:'2000-01-01',group_id:ownGroup,born_again:false};
  const added=await call('/members','POST',payload,leaderCookie);
  assert.equal(added.status,201);
  const [createdMember]=await query('SELECT id FROM members WHERE identification=?',[payload.identification]);ids.push(createdMember.id);
  const ownEventResult=await query("INSERT INTO events(title,kind,event_date,group_id) VALUES(?,'grupo',NOW(),?)",['Evento propio '+suffix,ownGroup]);ownEvent=ownEventResult.insertId;
  const otherEventResult=await query("INSERT INTO events(title,kind,event_date,group_id) VALUES(?,'grupo',NOW(),?)",['Evento ajeno '+suffix,otherGroup]);otherEvent=otherEventResult.insertId;
  const courseResult=await query("INSERT INTO courses(title,area,teacher_id,group_id) VALUES(?,'discipulado',?,?)",['Curso ajeno '+suffix,leader.insertId,otherGroup]);foreignCourse=courseResult.insertId;

  assert.equal((await call('/members','POST',{...payload,name:'No autorizado',identification:'NO-'+suffix,group_id:otherGroup},leaderCookie)).status,403);
  const memberList=await call('/members','GET',null,leaderCookie);
  assert.equal(memberList.status,200);
  assert.ok(memberList.body.some(member=>member.id===createdMember.id));
  assert.ok(!memberList.body.some(member=>member.id===otherMember));
  const ownAttendance=await call('/attendance/'+ownEvent,'GET',null,leaderCookie);
  assert.equal(ownAttendance.status,200);
  assert.deepEqual(ownAttendance.body.map(member=>Number(member.id)),[Number(createdMember.id)]);
  assert.equal((await call('/attendance/'+ownEvent,'POST',{member_id:otherMember,status:'presente'},leaderCookie)).status,403);
  assert.equal((await call('/attendance/'+otherEvent,'GET',null,leaderCookie)).status,403);
  assert.equal((await call('/attendance/'+otherEvent,'POST',{member_id:otherMember,status:'presente'},leaderCookie)).status,403);
  const courseList=await call('/courses','GET',null,leaderCookie);
  assert.equal(courseList.status,200);
  assert.ok(!courseList.body.some(course=>Number(course.id)===Number(foreignCourse)));
  assert.equal((await call('/courses/'+foreignCourse+'/lessons','GET',null,leaderCookie)).status,403);
  assert.equal((await call('/members/'+otherMember+'/dashboard','GET',null,leaderCookie)).status,403);
  assert.equal((await call('/members/'+otherMember,'PATCH',{born_again:true},leaderCookie)).status,403);
 }finally{
  if(leaderCookie)await call('/logout','POST',null,leaderCookie);
  if(ownEvent||otherEvent){await query('DELETE FROM attendance WHERE event_id IN (?,?)',[ownEvent||0,otherEvent||0]);await query('DELETE FROM events WHERE id IN (?,?)',[ownEvent||0,otherEvent||0]);}
  if(foreignCourse)await query('DELETE FROM courses WHERE id=?',[foreignCourse]);
  for(const id of ids)await query('DELETE FROM members WHERE id=?',[id]);
  if(otherMember)await query('DELETE FROM members WHERE id=?',[otherMember]);
  if(ownGroup)await query('DELETE FROM groups_family WHERE id=?',[ownGroup]);
  if(otherGroup)await query('DELETE FROM groups_family WHERE id=?',[otherGroup]);
  await query('DELETE FROM sessions WHERE user_id IN (?,?)',[leader.insertId,otherLeader.insertId]);
  await query('DELETE FROM audit WHERE user_id IN (?,?)',[leader.insertId,otherLeader.insertId]);
  await query('DELETE FROM users WHERE id IN (?,?)',[leader.insertId,otherLeader.insertId]);
  await db.end();
 }
});
