import fs from 'node:fs/promises';
import {query,db} from './db.js';
const tables=['users','sessions','groups_family','members','ministries','member_ministries','courses','enrollments','lessons','events','attendance','audit','course_members','roles','modulos','permisos_rol','solicitudes_acceso','notificaciones','auditoria_permisos'];
const descriptions={
 users:'Usuarios: cuentas de acceso, credenciales, rol y estado de aprobación.',
 sessions:'Sesiones: accesos iniciados y su fecha de vencimiento.',
 groups_family:'Grupos de comunión familiar: nombre, discipulador y capacidad.',
 members:'Discípulos: perfiles personales, contacto, grupo y seguimiento pastoral.',
 ministries:'Ministerios: catálogo conservado aunque no tenga un menú visible.',
 member_ministries:'Relación entre discípulos y ministerios; permite varios ministerios por persona.',
 courses:'Cursos de adiestramiento y discipulado, con docente, libro y grupo.',
 enrollments:'Inscripciones de cuentas de usuario en cursos.',
 lessons:'Lecciones y materiales publicados dentro de cada curso.',
 events:'Encuentros: eventos, servicios dominicales y sesiones de formación.',
 attendance:'Asistencia de cada discípulo a un encuentro; un registro por persona y encuentro.',
 audit:'Auditoría general: acciones realizadas por las cuentas de usuario.',
 course_members:'Inscripciones de perfiles de discípulos en cursos, distintas de las cuentas de usuario.',
 roles:'Catálogo de roles de acceso.',
 modulos:'Catálogo de secciones de la aplicación.',
 permisos_rol:'Matriz de permisos de cada rol para cada módulo.',
 solicitudes_acceso:'Solicitudes de registro y su proceso de aprobación o rechazo.',
 notificaciones:'Avisos internos de la aplicación; no representan correos enviados.',
 auditoria_permisos:'Historial de aprobaciones, cambios de rol y otras acciones de administración de accesos.'
};
const fields={
 id:'Identificador único del registro.',
 name:'Nombre de la persona, grupo o ministerio.',
 email:'Correo electrónico.',
 password_hash:'Huella cifrada de la contraseña; no contiene la contraseña en texto legible.',
 role:'Rol asignado a la cuenta; puede quedar vacío mientras espera aprobación.',
 active:'Cuenta habilitada: 1 = sí, 0 = no.',
 must_change:'Debe cambiar su contraseña al ingresar: 1 = sí, 0 = no.',
 created_at:'Fecha y hora de creación del registro.',
 estado:'Estado del proceso de acceso o de la cuenta; los valores permitidos aparecen en ENUM.',
 aprobado_por:'Identificador del usuario que resolvió la solicitud.',
 fecha_aprobacion:'Fecha y hora de aprobación de la cuenta.',
 motivo_rechazo:'Explicación del rechazo, si fue registrada.',
 metodo_registro:'Origen del registro: correo, Google o creación administrativa, según ENUM.',
 birthday:'Fecha de nacimiento.',
 eps:'Entidad promotora de salud de la persona.',
 token_hash:'Huella del identificador secreto de sesión; no almacena la cookie original.',
 user_id:'Identificador de la cuenta de usuario relacionada, en users.',
 expires_at:'Fecha y hora en que vence la sesión.',
 leader_id:'Identificador del usuario que dirige el grupo como discipulador.',
 capacity:'Capacidad prevista de integrantes del grupo.',
 id_type:'Tipo de documento de identificación.',
 identification:'Número de documento de identificación.',
 phone:'Número de teléfono o celular.',
 blood_type:'Grupo sanguíneo y factor RH.',
 church_function:'Función que desempeña la persona en la iglesia.',
 campus:'Sede a la que pertenece.',
 emergency_name:'Nombre del contacto de emergencia.',
 emergency_phone:'Teléfono del contacto de emergencia.',
 group_id:'Identificador del grupo de comunión familiar relacionado, en groups_family.',
 coverage:'Cobertura pastoral registrada para la persona.',
 born_again:'Indicador de nacido de nuevo: 1 = sí, 0 = no.',
 photo_data:'Foto del perfil codificada como datos de imagen.',
 member_id:'Identificador del perfil del discípulo, en members.',
 ministry_id:'Identificador del ministerio, en ministries.',
 title:'Título del curso, material o encuentro.',
 area:'Área de formación: adiestramiento o discipulado.',
 description:'Descripción del curso o encuentro.',
 teacher_id:'Identificador del usuario docente o discipulador a cargo.',
 schedule:'Texto descriptivo del horario de formación.',
 book:'Libro que se estudia en el curso.',
 course_id:'Identificador del curso relacionado, en courses.',
 body:'Contenido del material de estudio.',
 url:'Enlace al material de estudio.',
 kind:'Tipo de encuentro: servicio, especial, grupo, adiestramiento o discipulado.',
 event_date:'Fecha y hora local del encuentro.',
 location:'Lugar del encuentro o enlace de reunión.',
 image_url:'Dirección de la imagen del encuentro.',
 registration:'El encuentro requiere inscripción: 1 = sí, 0 = no.',
 event_id:'Identificador del encuentro, en events.',
 recorded_by:'Identificador del usuario que registró o corrigió la asistencia.',
 updated_at:'Fecha y hora de la última actualización del registro.',
 action:'Descripción de la acción registrada en la auditoría general.',
 nombre:'Nombre del rol o módulo.',
 descripcion:'Descripción del rol.',
 rol_id:'Identificador del rol, en roles.',
 modulo_id:'Identificador del módulo, en modulos.',
 puede_ver:'Permiso para consultar el módulo: 1 = permitido, 0 = no permitido.',
 puede_crear:'Permiso para crear registros: 1 = permitido, 0 = no permitido.',
 puede_editar:'Permiso para editar registros: 1 = permitido, 0 = no permitido.',
 puede_eliminar:'Permiso para eliminar registros: 1 = permitido, 0 = no permitido.',
 fecha_solicitud:'Fecha y hora en que se presentó la solicitud.',
 fecha_resolucion:'Fecha y hora de aprobación o rechazo de la solicitud.',
 tipo:'Tipo de notificación interna.',
 mensaje:'Texto de la notificación.',
 leida:'La notificación fue leída: 1 = sí, 0 = no.',
 creada_en:'Fecha y hora de creación del registro.',
 actor_id:'Identificador del usuario que realizó la acción administrativa.',
 objetivo_id:'Identificador del usuario afectado por la acción administrativa.',
 accion:'Tipo de acción administrativa realizada.',
 detalle:'Explicación del cambio realizado.'
};
const statuses={
 members:'Estado del discípulo: activo, inactivo o retirado.',
 events:'Estado del encuentro: programado o cancelado.',
 attendance:'Estado de asistencia: presente, ausente, justificado o visitante.'
};
let sql=`-- ARCA. Esquema MySQL 8 / MariaDB. No borra bases anteriores.
-- Las explicaciones están en español; los nombres técnicos no se modifican.
-- Este archivo crea la estructura, no incluye cuentas ni datos personales.
-- Guía de lectura:
-- CREATE DATABASE / USE: crear la base de datos / seleccionarla.
-- CREATE TABLE IF NOT EXISTS: crear la tabla solo si todavía no existe.
-- INT / BIGINT: número entero; VARCHAR / TEXT: texto; DATE: fecha; DATETIME: fecha y hora.
-- ENUM: lista de valores permitidos; TINYINT(1): indicador usado como 1 = sí, 0 = no.
-- NULL: valor sin registrar; NOT NULL: obligatorio; DEFAULT: valor inicial.
-- AUTO_INCREMENT: generar automáticamente el siguiente identificador.
-- PRIMARY KEY: clave que identifica de forma única cada fila.
-- UNIQUE KEY: impide valores repetidos; KEY: índice para facilitar búsquedas.
-- FOREIGN KEY / REFERENCES: relaciona un campo con una fila de otra tabla.
-- ON DELETE CASCADE: al borrar la fila relacionada, borrar también sus dependientes.
-- ON DELETE SET NULL: al borrar la fila relacionada, dejar el vínculo vacío.
-- CURRENT_TIMESTAMP: fecha y hora actuales; ON UPDATE: actualizar al modificar la fila.
-- ENGINE=InnoDB: motor con transacciones y relaciones entre tablas.
-- utf8mb4: codificación compatible con tildes y otros caracteres.
CREATE DATABASE IF NOT EXISTS arc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE arc;

`;
try{
 for(const table of tables){
  if(!descriptions[table])throw Error('Falta la explicación de la tabla '+table);
  const [r]=await query('SHOW CREATE TABLE `'+table+'`');
  const definition=r['Create Table'].replace('CREATE TABLE ','CREATE TABLE IF NOT EXISTS ').replace(/ AUTO_INCREMENT=\d+/g,'');
  const documented=definition.replace(/^  `(\w+)`.*$/gm,(line,column)=>{
   const description=column==='status'?statuses[table]:fields[column];
   if(!description)throw Error('Falta la explicación del campo '+table+'.'+column);
   return '  -- '+description+'\n'+line;
  });
  sql+='-- '+table+': '+descriptions[table]+'\n'+documented+';\n\n';
 }
 await fs.writeFile(new URL('../database/arc.sql',import.meta.url),sql);
 console.log('Esquema actualizado con explicaciones en español en database/arc.sql.');
}finally{await db.end()}
