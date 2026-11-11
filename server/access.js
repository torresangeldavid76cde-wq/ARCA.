export const roles=['administrador','coordinador','docente','discipulador','estudiante'];
export const roleKeys=['administrador','pastor','asistencia_pastoral','rector','coordinador','docente','discipulador','multimedia','estudiante'];
export const assignableRoles=roles;
export const attendanceRoles=['administrador','pastor','asistencia_pastoral','rector','coordinador','docente','discipulador','multimedia'];
export const managers=['administrador','pastor','rector','coordinador'];
export const personal=['administrador','pastor','asistencia_pastoral','discipulador'];
export const pastoral=['administrador','pastor','asistencia_pastoral'];
export const academic=['administrador','pastor','rector','coordinador','docente'];
export function canGrant(actor,target){
 if(!roleKeys.includes(target))return false;
 if(actor==='administrador'||actor==='pastor')return assignableRoles.includes(target);
 if(actor==='coordinador')return assignableRoles.includes(target)&&target!=='administrador';
 return actor==='rector'&&['docente','estudiante','discipulador'].includes(target);
}
