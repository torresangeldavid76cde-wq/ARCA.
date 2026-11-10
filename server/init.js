import 'dotenv/config';
import mysql from 'mysql2/promise';
import fs from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import {randomBytes} from 'node:crypto';
import {migrate} from './migrate.js';
import {roles} from './access.js';
const c=await mysql.createConnection({host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),user:process.env.DB_ADMIN_USER||process.env.DB_USER,password:process.env.DB_ADMIN_PASSWORD??process.env.DB_PASSWORD,multipleStatements:true});
await c.query(await fs.readFile(new URL('../database/arc.sql',import.meta.url),'utf8'));
await migrate(c);
// Keep the login API schema in sync before the server starts. This migration is
// also shipped as a standalone SQL file for existing non-local installations.
await c.query(await fs.readFile(new URL('../database/migracion_permisos.sql',import.meta.url),'utf8'));
const passwords=[];
for(const role of roles){const email=role+'@arca.demo';const [found]=await c.execute('SELECT id FROM users WHERE email=?',[email]);if(found.length)continue;const password=randomBytes(12).toString('base64url');await c.execute('INSERT INTO users(name,email,password_hash,role,must_change) VALUES(?,?,?,?,FALSE)',[role.replaceAll('_',' '),email,await bcrypt.hash(password,12),role]);passwords.push(`${email} | ${password}`);}
const [[teacher]]=await c.query("SELECT id FROM users WHERE role='docente' LIMIT 1");
const [[leader]]=await c.query("SELECT id FROM users WHERE role='discipulador' LIMIT 1");
const [[g]]=await c.query('SELECT COUNT(*) n FROM groups_family');
if(!g.n)for(let i=1;i<=5;i++)await c.execute('INSERT INTO groups_family(name,leader_id) VALUES(?,?)',[`Grupo familiar ${i}`,leader.id]);
const [[courses]]=await c.query('SELECT COUNT(*) n FROM courses');
if(!courses.n){await c.execute('INSERT INTO courses(title,area,description,teacher_id,schedule) VALUES(?,?,?,?,?),(?,?,?,?,?)',['Adiestramiento','adiestramiento','Formación de la iglesia. Contenido curricular pendiente de aprobación.',teacher.id,'Jueves · 7:30 p. m. · Presencial y Zoom','Discipulado','discipulado','Acompañamiento y crecimiento en la fe.',teacher.id,'Lunes · 7:30 y 8:30 p. m. · Zoom']);}
const [familyGroups]=await c.query('SELECT id,name,leader_id FROM groups_family');
for(const g of familyGroups){const [existing]=await c.execute("SELECT id FROM courses WHERE area='discipulado' AND group_id=?",[g.id]);if(!existing.length)await c.execute("INSERT INTO courses(title,area,description,teacher_id,group_id) VALUES(?,'discipulado','Grupo de comunión familiar',?,?)",[g.name,g.leader_id,g.id]);}
await c.query("UPDATE courses c JOIN groups_family g ON g.id=c.group_id SET c.teacher_id=g.leader_id WHERE c.area='discipulado' AND c.title='Discipulado' AND NOT EXISTS(SELECT 1 FROM course_members cm WHERE cm.course_id=c.id)");
await c.end();
if(passwords.length){const credentialsFile=new URL('../CUENTAS-DEMO.txt',import.meta.url);let existing='';try{existing=await fs.readFile(credentialsFile,'utf8')}catch(error){if(error.code!=='ENOENT')throw error;}const known=new Set(existing.split(/\r?\n/).map(line=>line.split(' | ',1)[0].trim()).filter(Boolean));const additions=passwords.filter(line=>!known.has(line.split(' | ',1)[0]));if(additions.length)await fs.writeFile(credentialsFile,existing.trimEnd()?`${existing.trimEnd()}\n${additions.join('\n')}\n`:'ARCA — cuentas locales de demostración. No usar en producción.\nContraseñas únicas generadas durante la instalación.\n\n'+additions.join('\n')+'\n');}
console.log('Base arc inicializada sin borrar datos existentes. Credenciales guardadas en CUENTAS-DEMO.txt.');
