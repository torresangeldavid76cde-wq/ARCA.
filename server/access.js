export const roles=['administrador','coordinador','docente','discipulador','estudiante'];
export const attendanceRoles=['administrador','pastor','asistencia_pastoral','rector','coordinador','docente','discipulador','multimedia'];
export const managers=['administrador','pastor','rector','coordinador'];
export const personal=['administrador','pastor','asistencia_pastoral','discipulador'];
export const pastoral=['administrador','pastor','asistencia_pastoral'];
export const academic=['administrador','pastor','rector','coordinador','docente'];
export function canGrant(actor,target){
 if(!roles.includes(target))return false;
 if(actor==='administrador')return true;
 if(actor==='pastor')return true;
 if(actor==='coordinador')return target!=='administrador';
 return actor==='rector'&&['docente','estudiante','discipulador'].includes(target);
}
