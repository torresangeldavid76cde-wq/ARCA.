import React, { useState } from 'react';

export function ReportsPage({ courses, canSeeBirthdays }) {
  const [courseId, setCourseId] = useState('');
  const [date, setDate] = useState('');
  const params = new URLSearchParams();
  if (courseId) params.set('course_id', courseId);
  if (date) params.set('date', date);
  const query = params.toString();
  const attendanceUrl = '/api/reports/asistencia/';
  const otherReports = [...(canSeeBirthdays ? ['cumpleanos'] : []), 'grupos'];

  return <>
    <section className="panel">
      <div className="section-title">
        <div>
          <h2>Asistencia por clase y día</h2>
          <p className="muted">El reporte incluye a cada alumno inscrito en cada sesión. “Sin registro” queda separado de una ausencia marcada.</p>
        </div>
      </div>
      <div className="form-grid">
        <label>Clase<select value={courseId} onChange={event => setCourseId(event.target.value)}>
          <option value="">Todas las clases</option>
          {courses.map(course => <option key={course.id} value={course.id}>{course.title} · {course.area}</option>)}
        </select></label>
        <label>Día de la sesión<input type="date" value={date} onChange={event => setDate(event.target.value)}/></label>
      </div>
      <div className="actions">
        <a className="button primary" href={attendanceUrl + 'xlsx' + (query ? '?' + query : '')}>Excel ↓</a>
        <a className="button" href={attendanceUrl + 'pdf' + (query ? '?' + query : '')}>PDF ↓</a>
      </div>
    </section>
    <div className="cards">{otherReports.map(type => <article className="panel" key={type}>
      <span className="pill">REPORTE</span>
      <h2>{type === 'cumpleanos' ? 'Cumpleaños' : type}</h2>
      <p>Descarga los registros actuales de la comunidad.</p>
      <div className="actions">
        <a className="button primary" href={'/api/reports/' + type + '/xlsx'}>Excel ↓</a>
        <a className="button" href={'/api/reports/' + type + '/pdf'}>PDF ↓</a>
      </div>
    </article>)}</div>
  </>;
}
