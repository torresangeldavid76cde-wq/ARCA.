const unavailableRoleBases=['administrador','multimedia','asistencia_pastoral'];

export function availableRoleBases(roles){
 return roles.filter(role=>!unavailableRoleBases.includes(role.nombre));
}
