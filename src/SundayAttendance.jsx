import React,{useEffect,useState} from 'react';

const correctionRoles=['administrador','pastor','asistencia_pastoral'];
const attendanceStatuses=['presente','ausente','justificado','visitante'];

export function AttendanceRoster({rows,user,busy,cancelled,onMark}){
 return <><div className="toolbar"><span>{rows.filter(r=>r.status).length} de {rows.length} registros guardados</span></div><div className="table-scroll"><table><thead><tr><th>Discípulo</th><th>Estado</th><th>Registrar</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.name}</td><td>{r.status||'Sin registrar'}</td><td><div className="attendance-options" role="group" aria-label={'Asistencia de '+r.name}>{attendanceStatuses.map(status=><button type="button" key={status} aria-label={`${status} para ${r.name}`} aria-pressed={r.status===status} disabled={busy||cancelled||status===r.status||(Boolean(r.status)&&!correctionRoles.includes(user.role))} onClick={()=>onMark(r.id,status)}>{status}</button>)}</div></td></tr>)}</tbody></table></div>{!rows.length&&<p className="muted">No hay discípulos que coincidan con esta lista.</p>}<p className="muted">{cancelled?'Este encuentro está cancelado; no se puede registrar asistencia.':'Cada registro se guarda al seleccionarlo. Sin registrar no equivale a ausente.'}</p></>;
}

function nextSunday(){
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Bogota'}).format(new Date());
 const date=new Date(today+'T12:00:00Z');
 date.setUTCDate(date.getUTCDate()+(7-date.getUTCDay())%7);
 return date.toISOString().slice(0,10);
}

export function SundayAttendance({events,user,api,run,busy,onCreated}){
 const [date,DateSelected]=useState(nextSunday),[id,Id]=useState(null),[rows,Rows]=useState([]),[search,Search]=useState(''),[loading,Loading]=useState(false);
 const services=events.filter(e=>e.kind==='servicio'&&!e.course_id&&!e.group_id&&String(e.event_date).slice(0,10)===date);
 const selected=services.find(e=>e.id===id)||services.find(e=>e.status!=='cancelado')||services[0];
 const validSunday=/^\d{4}-\d{2}-\d{2}$/.test(date)&&new Date(date+'T12:00:00Z').getUTCDay()===0;
 useEffect(()=>{
  let active=true;
  Rows([]);
  if(!selected){Loading(false);return}
  Loading(true);
  run(async()=>{try{const roster=await api('/attendance/'+selected.id);if(active)Rows(roster)}finally{if(active)Loading(false)}});
  return()=>{active=false};
 },[selected?.id]);
 const filtered=rows.filter(r=>r.name.toLowerCase().includes(search.toLowerCase()));
 return <section className="panel">
  <div className="section-title"><div><h2>Llamado de asistencia del domingo</h2><p className="muted">Elige un domingo para registrar o consultar la asistencia de los discípulos.</p></div></div>
  <div className="form-grid">
   <label>Fecha del domingo<input type="date" value={date} disabled={busy} onChange={e=>{DateSelected(e.target.value);Id(null);Rows([]);Search('')}}/></label>
   {services.length>0&&<label>Servicio del domingo<select value={selected.id} disabled={busy} onChange={e=>{Id(Number(e.target.value));Rows([])}}>{services.map(e=><option key={e.id} value={e.id}>{e.title} · {String(e.event_date).slice(11,16)} · {e.status}</option>)}</select></label>}
  </div>
  {!validSunday&&<p className="error" role="alert">Selecciona una fecha que corresponda a un domingo.</p>}
  {validSunday&&(!selected||selected.status==='cancelado')&&<button className="primary" disabled={busy} onClick={()=>run(async()=>{const service=await api('/sunday-services','POST',{date});await onCreated();Id(service.id)})}>Abrir llamado del domingo</button>}
  {selected&&<>
   <p>{selected.title} · {date} · {selected.status}</p>
   <label>Buscar discípulo<input type="search" value={search} onChange={e=>Search(e.target.value)} placeholder="Nombre del discípulo"/></label>
   {loading?<p role="status">Cargando lista de asistencia…</p>:<AttendanceRoster rows={filtered} user={user} busy={busy} cancelled={selected.status==='cancelado'} onMark={(member_id,status)=>run(async()=>{await api('/attendance/'+selected.id,'POST',{member_id,status});Rows(await api('/attendance/'+selected.id))})}/>}
  </>}
 </section>;
}
