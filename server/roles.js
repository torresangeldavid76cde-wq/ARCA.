import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {roleKeys} from './access.js';
import {db} from './db.js';

export function registerRoleActions(app,{wrap,adminOnly,fail}){
 app.post('/api/admin/roles',wrap(async(req,res)=>{
  adminOnly(req.user);
  const data=z.object({
   nombre_visible:z.string().trim().min(1).max(80),
   descripcion:z.string().trim().max(160).default(''),
   base_id:z.number().int().positive()
  }).strict().parse(req.body);
  const connection=await db.getConnection();
  try{
   await connection.beginTransaction();
   const [[base]]=await connection.execute('SELECT id,nombre,base_role FROM roles WHERE id=? FOR UPDATE',[data.base_id]);
   if(!base)fail(404,'Rol base inexistente');
   const baseRole=base.base_role||base.nombre;
   if(baseRole==='administrador'||!roleKeys.includes(baseRole))fail(400,'Selecciona un rol base distinto de Administrador');
   const nombre='rol_'+randomUUID().replaceAll('-','');
   const [created]=await connection.execute('INSERT INTO roles(nombre,nombre_visible,descripcion,base_role) VALUES(?,?,?,?)',[nombre,data.nombre_visible,data.descripcion,baseRole]);
   await connection.execute('INSERT INTO permisos_rol(rol_id,modulo_id,puede_ver,puede_crear,puede_editar,puede_eliminar,aplicado) SELECT ?,m.id,COALESCE(p.puede_ver,0),COALESCE(p.puede_crear,0),COALESCE(p.puede_editar,0),COALESCE(p.puede_eliminar,0),COALESCE(p.aplicado,0) FROM modulos m LEFT JOIN permisos_rol p ON p.modulo_id=m.id AND p.rol_id=?',[created.insertId,base.id]);
   await connection.execute("INSERT INTO auditoria_permisos(actor_id,accion,detalle) VALUES(?,'roles',?)",[req.user.id,`Creación del rol ${nombre}: ${data.nombre_visible}; base ${base.nombre}`]);
   await connection.commit();
   res.status(201).json({id:created.insertId,nombre});
  }catch(error){
   await connection.rollback();
   throw error;
  }finally{connection.release()}
 }));
 app.delete('/api/admin/roles/:id',wrap(async(req,res)=>{
  adminOnly(req.user);
  const id=z.coerce.number().int().positive().parse(req.params.id);
  const connection=await db.getConnection();
  try{
   await connection.beginTransaction();
   const [[role]]=await connection.execute('SELECT id,nombre,base_role FROM roles WHERE id=? FOR UPDATE',[id]);
   if(!role)fail(404,'Rol inexistente');
   if(!role.base_role||roleKeys.includes(role.nombre))fail(400,'Los roles del sistema no se pueden eliminar');
   const [users]=await connection.execute('SELECT id FROM users WHERE role=? LIMIT 1 FOR UPDATE',[role.nombre]);
   if(users.length)fail(409,'Hay cuentas con este rol. Reasígnalas desde Permisos antes de eliminarlo');
   await connection.execute('DELETE FROM roles WHERE id=?',[id]);
   await connection.execute("INSERT INTO auditoria_permisos(actor_id,accion,detalle) VALUES(?,'roles',?)",[req.user.id,`Eliminación del rol ${role.nombre}`]);
   await connection.commit();
   res.json({ok:true});
  }catch(error){
   await connection.rollback();
   throw error;
  }finally{connection.release()}
 }));
 app.put('/api/admin/usuarios/:id/rol',wrap(async(req,res)=>{
  adminOnly(req.user);
  const id=z.coerce.number().int().positive().parse(req.params.id);
  if(id===req.user.id)fail(403,'No puedes cambiar tu propio rol');
  const {role}=z.object({role:z.string().min(1).max(40)}).strict().parse(req.body);
  const connection=await db.getConnection();
  try{
   await connection.beginTransaction();
   // Share the catalog lock with deletion so an assigned role cannot disappear.
   const [[target]]=await connection.execute('SELECT nombre FROM roles WHERE nombre=? FOR UPDATE',[role]);
   if(!target)fail(400,'Rol inexistente');
   const [[user]]=await connection.execute('SELECT role FROM users WHERE id=? FOR UPDATE',[id]);
   if(!user)fail(404,'Usuario inexistente');
   if(user.role==='administrador'&&role!=='administrador'){
    const [admins]=await connection.execute("SELECT id FROM users WHERE role='administrador' AND estado='activa' FOR UPDATE");
    if(admins.length<=1)fail(400,'Debe quedar al menos un administrador activo');
   }
   await connection.execute('UPDATE users SET role=? WHERE id=?',[role,id]);
   await connection.execute("INSERT INTO auditoria_permisos(actor_id,objetivo_id,accion,detalle) VALUES(?,?,?,?)",[req.user.id,id,'cambio_rol',`${user.role||'sin rol'} → ${role}`]);
   await connection.commit();
   res.json({ok:true});
  }catch(error){
   await connection.rollback();
   throw error;
  }finally{connection.release()}
 }));
}
