import React from 'react';

const states=[['present','Presente'],['visitors','Visitante'],['absent','Ausente'],['justified','Justificado']];
const format=value=>Number(value).toLocaleString('es-CO');

export function DashboardCharts({stats}){
 const months=stats.attendance||[];
 const total=months.reduce((sum,m)=>sum+Number(m.total),0);
 const attended=months.reduce((sum,m)=>sum+Number(m.present)+Number(m.visitors),0);
 const rate=total?Math.round(attended*100/total):null;
 const peak=Math.max(1,...months.map(m=>Number(m.total)));
 const courses=[...stats.courses].sort((a,b)=>Number(b.students)-Number(a.students));
 const maxStudents=Math.max(1,...courses.map(c=>Number(c.students)));
 const alerts=new Set([...stats.alerts,...stats.consecutive].map(a=>a.id)).size;
 return <section className="home-dashboard" aria-label="Dashboard de estadísticas">
  <div className="section-title"><h2>Dashboard de estadísticas</h2><span className="muted">Asistencia: mes actual y cinco anteriores</span></div>
  <div className="stats dashboard-kpis">
   {[['Registros de asistencia',format(total),'Sesiones realizadas, no canceladas'],['Tasa de asistencia',rate===null?'Sin datos':rate+'%','Presente + visitante / registros guardados'],['Cursos',format(courses.length),'Dentro de tu alcance'],['Personas con alertas',format(alerts),'Seguimiento pendiente']].map(([label,value,detail])=><article className="panel" key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>)}
  </div>
  <div className="dashboard-charts">
   <section className="panel">
    <h3>Asistencia por mes</h3>
    <p className="muted">No registrar asistencia no equivale a una ausencia.</p>
    {months.length?<><div className="chart-legend">{states.map(([key,label])=><span key={key}><i className={'chart-color '+key}/>{label}</span>)}</div>
     <div className="attendance-chart">{months.map(month=><div className="chart-row" key={month.month}>
      <span>{month.month}</span><div className="chart-track" role="img" aria-label={`${month.month}: ${states.map(([key,label])=>label+' '+format(month[key])).join(', ')}`}>
       {states.map(([key,label])=><span key={key} className={'chart-segment '+key} style={{width:100*Number(month[key])/peak+'%'}} title={label+': '+format(month[key])}/>)}
      </div><strong>{format(month.total)}</strong>
     </div>)}</div>
     <details className="chart-details"><summary>Ver cifras por estado</summary><div className="table-scroll"><table><thead><tr><th>Mes</th>{states.map(([key,label])=><th key={key}>{label}</th>)}<th>Total</th></tr></thead><tbody>{months.map(m=><tr key={m.month}><td>{m.month}</td>{states.map(([key])=><td key={key}>{format(m[key])}</td>)}<td>{format(m.total)}</td></tr>)}</tbody></table></div></details>
    </>:<p className="chart-empty">Aún no hay asistencias registradas en este período.</p>}
   </section>
   <section className="panel">
    <h3>Inscripciones por curso</h3><p className="muted">Discípulos activos. Una persona puede estar inscrita en varios cursos.</p>
    {courses.length?<div className="course-chart">{courses.map(course=><div key={course.id}>
     <div className="course-chart-label"><span>{course.title}</span><strong>{format(course.students)}</strong></div>
     <progress aria-label={'Inscritos en '+course.title} max={maxStudents} value={Number(course.students)}/>
    </div>)}</div>:<p className="chart-empty">No hay cursos disponibles en tu alcance.</p>}
   </section>
  </div>
 </section>;
}
