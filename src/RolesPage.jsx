import React,{useState as S} from 'react';

const permissionFields=[
 ['puede_ver','Ver'],
 ['puede_crear','Crear'],
 ['puede_editar','Editar'],
 ['puede_eliminar','Eliminar']
];

export function RolesPage({roles,modules,busy,api,run,onRoleSaved}){
 const [action,Action]=S(''),[selected,Selected]=S(''),[notice,Notice]=S('');
 const role=roles.find(item=>String(item.id)===selected);
 const saved=async()=>{await onRoleSaved();Notice('Rol actualizado correctamente.')};
 const create=event=>{
  event.preventDefault();
  const data=new FormData(event.currentTarget);
  run(async()=>{
   const result=await api('/admin/roles','POST',{
    nombre_visible:String(data.get('nombre_visible')).trim(),
    descripcion:String(data.get('descripcion')).trim(),
    base_id:Number(data.get('base_id'))
   });
   await onRoleSaved();
   Selected(String(result.id));Action('editar');
   Notice('Rol creado. Ahora puedes ajustar sus permisos.');
  });
 };
 const remove=event=>{
  event.preventDefault();
  if(!window.confirm('¿Eliminar el rol '+(role.nombre_visible||role.nombre)+'? Esta acción no se puede deshacer.'))return;
  run(async()=>{
   await api('/admin/roles/'+role.id,'DELETE');
   await onRoleSaved();
   Selected('');Notice('Rol eliminado correctamente.');
  });
 };
 return <section className="panel">
  <div className="section-title"><h2>Gestionar roles</h2></div>
  <div className="actions">{[['crear','Crear rol'],['editar','Editar rol'],['eliminar','Eliminar rol']].map(([value,label])=>
   <button key={value} type="button" className={action===value?'primary':''} aria-pressed={action===value} disabled={busy} onClick={()=>{Action(value);Selected('');Notice('')}}>{label}</button>
  )}</div>
  {notice&&<p role="status" className="success">{notice}</p>}
  {action==='crear'&&<form className="role-card" onSubmit={create}>
   <h3>Crear rol</h3>
   <label>Nombre visible<input name="nombre_visible" maxLength="80" required disabled={busy}/></label>
   <label>Descripción<input name="descripcion" maxLength="160" disabled={busy}/></label>
   <label>Rol base<select name="base_id" defaultValue="" required disabled={busy}>
    <option value="" disabled>Selecciona un rol base</option>
    {roles.filter(item=>item.nombre!=='administrador').map(item=><option key={item.id} value={item.id}>{item.nombre_visible||item.nombre}</option>)}
   </select></label>
   <p className="muted">Se copian los permisos del rol base. Luego puedes ajustarlos dentro de su alcance. Administrador no se puede usar como base.</p>
   <button className="primary" disabled={busy}>Crear rol y ajustar permisos</button>
  </form>}
  {['editar','eliminar'].includes(action)&&<>
   <label>Seleccionar rol<select value={selected} disabled={busy} onChange={event=>{Selected(event.target.value);Notice('')}}>
    <option value="">Selecciona un rol</option>
    {roles.map(item=><option key={item.id} value={item.id}>{item.nombre_visible||item.nombre}</option>)}
   </select></label>
   {role&&action==='editar'&&<RoleDefinition key={role.id+':'+JSON.stringify(role)} role={role} modules={modules} api={api} run={run} busy={busy} onSaved={saved}/>}
   {role&&action==='eliminar'&&<form className="role-card" onSubmit={remove}>
    <h3>Eliminar {role.nombre_visible||role.nombre}</h3>
    <p className="muted">{role.base_role?'Solo se puede eliminar si ninguna cuenta tiene este rol asignado.':'Este rol pertenece al sistema y no se puede eliminar.'}</p>
    <button className="primary" disabled={busy||!role.base_role}>Confirmar eliminación</button>
   </form>}
  </>}
 </section>;
}

function RoleDefinition({role,modules,api,run,busy,onSaved}){
 const save=event=>{
  event.preventDefault();
  const form=event.currentTarget;
  const applyPermissions=event.nativeEvent.submitter?.value==='permisos';
  run(async()=>{
   const data=new FormData(form);
   const permisos=modules.map(module=>({
    modulo_id:Number(module.id),
    ...Object.fromEntries(permissionFields.map(([field])=>[field,data.has(`permission_${module.id}_${field}`)]))
   }));
   await api('/admin/roles/'+role.id,'PUT',{
    nombre_visible:String(data.get('nombre_visible')||'').trim(),
    descripcion:String(data.get('descripcion')||'').trim(),
    aplicar_permisos:applyPermissions,
    permisos
   });
   await onSaved();
  });
 };
 return <form className="role-card" onSubmit={save}>
  <h3>{role.nombre_visible||role.nombre}</h3>
  {role.base_role&&<p className="muted">Los permisos se ajustan dentro del alcance del rol base; no amplían sus facultades.</p>}
  <fieldset disabled={busy}>
  <label>Nombre visible<input name="nombre_visible" maxLength="80" defaultValue={role.nombre_visible||role.nombre} required/></label>
  <label>Descripción<input name="descripcion" maxLength="160" defaultValue={role.descripcion||''}/></label>
  <div className="role-permissions">
   <div className="role-permission-row role-permission-head"><strong>Módulo</strong>{permissionFields.map(([,label])=><span key={label}>{label}</span>)}</div>
   {modules.map(module=>{
    const permission=role.permisos.find(item=>Number(item.modulo_id)===Number(module.id));
    return <div className="role-permission-row" key={module.id}>
     <strong>{module.nombre}<small>{Number(permission?.aplicado)===1?'Aplicado':'Sin aplicar'}</small></strong>
     {permissionFields.map(([field,label])=><label key={field} title={label}>
      <input type="checkbox" name={`permission_${module.id}_${field}`} defaultChecked={role.nombre==='administrador'||Boolean(permission?.[field])} disabled={role.nombre==='administrador'}/>
      <span className="sr-only">{label}</span>
     </label>)}
    </div>;
   })}
  </div>
  {role.nombre==='administrador'&&<p className="muted">El rol Administrador conserva todos los permisos.</p>}
  <p className="muted">Las filas sin aplicar conservan las reglas actuales del rol. Aplica la matriz solo cuando hayas revisado todos sus módulos.</p>
  <div className="actions"><button disabled={busy} name="action" value="definicion">Guardar nombre y descripción</button><button className="primary" disabled={busy} name="action" value="permisos">Aplicar permisos</button></div>
  </fieldset>
 </form>;
}
