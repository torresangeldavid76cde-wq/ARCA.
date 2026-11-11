import React,{useState as S} from 'react';

const permissionFields=[
 ['puede_ver','Ver'],
 ['puede_crear','Crear'],
 ['puede_editar','Editar'],
 ['puede_eliminar','Eliminar']
];

export function RolesPage({roles,modules,users,busy,roleLabels,currentUserId,api,run,onRoleSaved,onUserRoleSaved}){
 const assignmentRows=users.map(person=>{
  const options=roles.map(role=>[role.nombre,roleLabels[role.nombre]||role.nombre]);
  return [person.name,person.email,person.estado,roleLabels[person.role]||person.role,
   <RoleAssignment key={person.id+':'+person.role} person={person} roles={options} disabled={busy||person.id===currentUserId} onSave={role=>onUserRoleSaved(person,role)}/>];
 });
 return <>
  <section className="panel">
   <div className="section-title"><h2>Asignar roles a personas</h2></div>
   <p className="muted">Cambia el rol de una cuenta existente. No puedes cambiar tu propio rol ni dejar la aplicación sin un administrador activo.</p>
   <Table heads={['Nombre','Correo','Estado','Rol actual','Nuevo rol']} rows={assignmentRows}/>
  </section>
  <section className="panel">
   <div className="section-title"><h2>Definiciones y permisos</h2></div>
   <p className="muted">Edita el nombre visible, la descripción y la matriz de permisos. La clave interna de cada rol no se modifica.</p>
   <div className="role-grid">{roles.map(role=><RoleDefinition key={role.id} role={role} modules={modules} api={api} run={run} busy={busy} onSaved={onRoleSaved}/>)}</div>
  </section>
 </>;
}

function RoleAssignment({person,roles,disabled,onSave}){
 const [role,Role]=S(person.role);
 return <form className="actions" onSubmit={event=>{event.preventDefault();onSave(role)}}>
  <select aria-label={'Nuevo rol de '+person.email} value={role} disabled={disabled} onChange={event=>Role(event.target.value)}>
   {roles.map(([value,label])=><option key={value} value={value}>{label}</option>)}
  </select>
  <button className="primary" disabled={disabled||role===person.role} aria-label={'Guardar rol de '+person.email}>Guardar rol</button>
 </form>;
}

function RoleDefinition({role,modules,api,run,busy,onSaved}){
 const save=event=>{
  event.preventDefault();
  const form=event.currentTarget;
  const applyPermissions=event.nativeEvent.submitter?.value==='permisos';
  run(async()=>{
   const data=new FormData(form);
   const permisos=role.permisos.map(module=>({
    modulo_id:Number(module.modulo_id),
    ...Object.fromEntries(permissionFields.map(([field])=>[field,data.has(`permission_${module.modulo_id}_${field}`)]))
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
 </form>;
}

function Table({heads,rows}){return <div className="table-scroll"><table><thead><tr>{heads.map(head=><th key={head}>{head}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={index}>{row.map((value,column)=><td key={column}>{value}</td>)}</tr>)}</tbody></table>{!rows.length&&<p className="muted">No hay registros para mostrar.</p>}</div>}
