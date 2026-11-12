import {z} from 'zod';
import {query} from './db.js';
import {personal,pastoral,academic,managers} from './access.js';
export function tracking(app,wrap,allow,fail){
 app.get('/api/tracking',wrap(async(req,res)=>{
  allow(req.user,[...pastoral,'rector','coordinador','docente','discipulador','multimedia']);
  const scoped=['docente','discipulador'].includes(req.user.role);
  const scope=scoped?'AND (g.leader_id=? OR EXISTS(SELECT 1 FROM course_members cm JOIN courses c ON c.id=cm.course_id WHERE cm.member_id=m.id AND c.teacher_id=?))':'';
  const args=scoped?[req.user.id,req.user.id]:[];
  const [counts]=await query(`SELECT COUNT(*) total,COALESCE(SUM(m.status='activo'),0) active,COALESCE(SUM(m.born_again=TRUE),0) born_again,COALESCE(SUM(EXISTS(SELECT 1 FROM course_members cm JOIN courses c ON c.id=cm.course_id WHERE cm.member_id=m.id AND c.area='discipulado')),0) discipulado,COALESCE(SUM(EXISTS(SELECT 1 FROM course_members cm JOIN courses c ON c.id=cm.course_id WHERE cm.member_id=m.id AND c.area='adiestramiento')),0) adiestramiento,COALESCE(SUM(NOT EXISTS(SELECT 1 FROM course_members cm WHERE cm.member_id=m.id)),0) unassigned FROM members m LEFT JOIN groups_family g ON g.id=m.group_id WHERE 1=1 ${scope}`,args);
  const courses=await query(`SELECT c.id,c.title,c.area,c.book,u.name teacher,(SELECT COUNT(*) FROM course_members cm JOIN members m ON m.id=cm.member_id WHERE cm.course_id=c.id AND m.status='activo') students,(SELECT COUNT(DISTINCT a.member_id) FROM attendance a JOIN events e ON e.id=a.event_id JOIN members m ON m.id=a.member_id WHERE e.course_id=c.id AND e.status<>'cancelado' AND e.event_date<=NOW() AND a.status IN ('presente','visitante') AND m.status='activo') attending_students,(SELECT COUNT(*) FROM attendance a JOIN events e ON e.id=a.event_id WHERE e.course_id=c.id AND e.status<>'cancelado' AND e.event_date<=NOW() AND a.status IN ('presente','visitante')) attendances,(SELECT COUNT(*) FROM events e WHERE e.course_id=c.id AND e.status<>'cancelado' AND e.event_date<=NOW()) sessions FROM courses c LEFT JOIN users u ON u.id=c.teacher_id ${scoped?'WHERE c.teacher_id=?':''}`,scoped?[req.user.id]:[]);
  let alerts=[];
  if(req.user.role!=='multimedia')alerts=await query(`SELECT m.id,m.name,MAX(CASE WHEN a.status IN ('presente','visitante') THEN e.event_date END) last_attended,DATEDIFF(NOW(),COALESCE(MAX(CASE WHEN a.status IN ('presente','visitante') THEN e.event_date END),m.created_at)) days_absent FROM members m LEFT JOIN groups_family g ON g.id=m.group_id LEFT JOIN attendance a ON a.member_id=m.id LEFT JOIN events e ON e.id=a.event_id AND e.status<>'cancelado' AND e.event_date<=NOW() WHERE m.status='activo' ${scope} GROUP BY m.id,m.name,m.created_at HAVING days_absent>8 ORDER BY days_absent DESC`,args);
  const consecutive=req.user.role==='multimedia'?[]:await query(`SELECT m.id,m.name,c.title course,COUNT(*) missing FROM attendance a JOIN events e ON e.id=a.event_id JOIN members m ON m.id=a.member_id JOIN courses c ON c.id=e.course_id LEFT JOIN groups_family g ON g.id=m.group_id WHERE m.status='activo' AND e.status<>'cancelado' AND e.event_date<=NOW() AND a.status='ausente' ${scope} AND (SELECT COUNT(*) FROM attendance a2 JOIN events e2 ON e2.id=a2.event_id WHERE a2.member_id=m.id AND e2.course_id=e.course_id AND e2.status<>'cancelado' AND e2.event_date<=NOW() AND (e2.event_date>e.event_date OR(e2.event_date=e.event_date AND e2.id>e.id)))<2 GROUP BY m.id,m.name,c.id,c.title HAVING COUNT(*)=2`,args);
  const attendance=await query(`SELECT DATE_FORMAT(e.event_date,'%Y-%m') month,
   COUNT(*) total,SUM(a.status='presente') present,SUM(a.status='visitante') visitors,
   SUM(a.status='ausente') absent,SUM(a.status='justificado') justified
   FROM attendance a JOIN events e ON e.id=a.event_id LEFT JOIN courses c ON c.id=e.course_id
   WHERE e.status<>'cancelado' AND e.event_date<=NOW()
   AND e.event_date>=DATE_FORMAT(DATE_SUB(CURDATE(),INTERVAL 5 MONTH),'%Y-%m-01')
   ${scoped?'AND c.teacher_id=?':''}
   GROUP BY DATE_FORMAT(e.event_date,'%Y-%m') ORDER BY month`,scoped?[req.user.id]:[]);
  res.json({...counts,courses,alerts,consecutive,attendance});
 }));
 app.get('/api/teachers',wrap(async(req,res)=>{allow(req.user,[...academic,'discipulador',...pastoral]);res.json(await query("SELECT u.id,u.name,COALESCE(r.base_role,u.role) role FROM users u LEFT JOIN roles r ON r.nombre=u.role WHERE u.active=TRUE AND COALESCE(r.base_role,u.role) IN ('docente','discipulador') ORDER BY u.name"))}));
 app.get('/api/courses/:id/members',wrap(async(req,res)=>{
  const [c]=await query('SELECT * FROM courses WHERE id=?',[req.params.id]);if(!c)fail(404,'Curso inexistente');allow(req.user,[...academic,'discipulador',...pastoral]);if(['docente','discipulador'].includes(req.user.role)&&c.teacher_id!==req.user.id)fail(403,'Curso no asignado');
  res.json(await query(`SELECT m.id,m.name,g.name group_name,EXISTS(SELECT 1 FROM course_members cm WHERE cm.course_id=? AND cm.member_id=m.id) enrolled,(SELECT COUNT(*) FROM attendance a JOIN events e ON e.id=a.event_id WHERE a.member_id=m.id AND e.course_id=? AND a.status IN ('presente','visitante')) attended,(SELECT COUNT(*) FROM attendance a JOIN events e ON e.id=a.event_id WHERE a.member_id=m.id AND e.course_id=? AND a.status='ausente') absent,(SELECT COUNT(*) FROM attendance a JOIN events e ON e.id=a.event_id WHERE a.member_id=m.id AND e.course_id=? AND a.status='justificado') justified FROM members m LEFT JOIN groups_family g ON g.id=m.group_id WHERE m.status<>'retirado' ORDER BY m.name`,[c.id,c.id,c.id,c.id]));
 }));
 app.post('/api/courses/:id/members',wrap(async(req,res)=>{
  const [c]=await query('SELECT * FROM courses WHERE id=?',[req.params.id]);if(!c)fail(404,'Curso inexistente');allow(req.user,[...academic,'discipulador',...pastoral]);if(['docente','discipulador'].includes(req.user.role)&&c.teacher_id!==req.user.id)fail(403,'Curso no asignado');
  const d=z.object({member_id:z.number().int().positive(),enrolled:z.boolean()}).parse(req.body);
  if(req.user.role==='discipulador'){const [m]=await query('SELECT m.id FROM members m JOIN groups_family g ON g.id=m.group_id WHERE m.id=? AND g.leader_id=?',[d.member_id,req.user.id]);if(!m)fail(403,'Miembro fuera de tu grupo')}
  if(d.enrolled){await query('INSERT IGNORE INTO course_members VALUES(?,?)',[c.id,d.member_id]);if(c.area==='discipulado'&&c.group_id)await query('UPDATE members SET group_id=? WHERE id=?',[c.group_id,d.member_id]);}else await query('DELETE FROM course_members WHERE course_id=? AND member_id=?',[c.id,d.member_id]);
  res.json({ok:true});
 }));
 app.patch('/api/courses/:id',wrap(async(req,res)=>{
  allow(req.user,managers);const d=z.object({title:z.string().trim().min(1).max(160),book:z.string().trim().max(200),teacher_id:z.number().int().positive()}).parse(req.body);
  const [teacher]=await query("SELECT u.id FROM users u LEFT JOIN roles r ON r.nombre=u.role WHERE u.id=? AND COALESCE(r.base_role,u.role) IN ('docente','discipulador') AND u.active=TRUE",[d.teacher_id]);if(!teacher)fail(400,'Selecciona un docente habilitado');
  await query('UPDATE courses SET title=?,book=?,teacher_id=? WHERE id=?',[d.title,d.book,d.teacher_id,req.params.id]);await query('UPDATE groups_family SET leader_id=? WHERE id=(SELECT group_id FROM courses WHERE id=?)',[d.teacher_id,req.params.id]);res.json({ok:true});
 }));
 app.get('/api/members/:id/history',wrap(async(req,res)=>{
  allow(req.user,[...personal,'rector','coordinador','docente']);const [m]=await query('SELECT m.*,TIMESTAMPDIFF(YEAR,m.birthday,CURDATE()) age,g.name group_name,g.leader_id FROM members m LEFT JOIN groups_family g ON g.id=m.group_id WHERE m.id=?',[req.params.id]);if(!m)fail(404,'Perfil inexistente');
  if(req.user.role==='discipulador'&&m.leader_id!==req.user.id)fail(403,'Miembro fuera de tu grupo');
  if(req.user.role==='docente'){const [access]=await query('SELECT cm.member_id FROM course_members cm JOIN courses c ON c.id=cm.course_id WHERE cm.member_id=? AND c.teacher_id=?',[m.id,req.user.id]);if(!access)fail(403,'Alumno fuera de tus cursos');}
  const history=await query('SELECT e.title,e.event_date,a.status,c.title course FROM attendance a JOIN events e ON e.id=a.event_id LEFT JOIN courses c ON c.id=e.course_id WHERE a.member_id=? ORDER BY e.event_date DESC',[m.id]);
  // Rector/coordinador/docente reciben solamente información académica.
  if(!personal.includes(req.user.role)){const {id,name,age,born_again,status,group_name,photo_data}=m;res.json({member:{id,name,age,born_again,status,group_name,photo_data},history});}else res.json({member:m,history});
 }));
}
