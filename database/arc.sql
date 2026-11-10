-- ARCA. Esquema MySQL 8 / MariaDB. No borra bases anteriores.
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

-- users: Usuarios: cuentas de acceso, credenciales, rol y estado de aprobación.
CREATE TABLE IF NOT EXISTS `users` (
  -- Identificador único del registro.
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  -- Nombre de la persona, grupo o ministerio.
  `name` varchar(160) NOT NULL,
  -- Correo electrónico.
  `email` varchar(190) NOT NULL,
  -- Huella cifrada de la contraseña; no contiene la contraseña en texto legible.
  `password_hash` varchar(100) NOT NULL,
  -- Rol asignado a la cuenta; puede quedar vacío mientras espera aprobación.
  `role` varchar(40) DEFAULT NULL,
  -- Cuenta habilitada: 1 = sí, 0 = no.
  `active` tinyint(1) NOT NULL DEFAULT 1,
  -- Debe cambiar su contraseña al ingresar: 1 = sí, 0 = no.
  `must_change` tinyint(1) NOT NULL DEFAULT 1,
  -- Fecha y hora de creación del registro.
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  -- Estado del proceso de acceso o de la cuenta; los valores permitidos aparecen en ENUM.
  `estado` enum('pendiente','activa','rechazada','suspendida') NOT NULL DEFAULT 'activa',
  -- Identificador del usuario que resolvió la solicitud.
  `aprobado_por` int(10) unsigned DEFAULT NULL,
  -- Fecha y hora de aprobación de la cuenta.
  `fecha_aprobacion` datetime DEFAULT NULL,
  -- Explicación del rechazo, si fue registrada.
  `motivo_rechazo` varchar(500) DEFAULT NULL,
  -- Origen del registro: correo, Google o creación administrativa, según ENUM.
  `metodo_registro` enum('correo','google','administrativo') NOT NULL DEFAULT 'administrativo',
  -- Fecha de nacimiento.
  `birthday` date DEFAULT NULL,
  -- Entidad promotora de salud de la persona.
  `eps` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- sessions: Sesiones: accesos iniciados y su fecha de vencimiento.
CREATE TABLE IF NOT EXISTS `sessions` (
  -- Huella del identificador secreto de sesión; no almacena la cookie original.
  `token_hash` char(64) NOT NULL,
  -- Identificador de la cuenta de usuario relacionada, en users.
  `user_id` int(10) unsigned NOT NULL,
  -- Fecha y hora en que vence la sesión.
  `expires_at` datetime NOT NULL,
  PRIMARY KEY (`token_hash`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- groups_family: Grupos de comunión familiar: nombre, discipulador y capacidad.
CREATE TABLE IF NOT EXISTS `groups_family` (
  -- Identificador único del registro.
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  -- Nombre de la persona, grupo o ministerio.
  `name` varchar(160) NOT NULL,
  -- Identificador del usuario que dirige el grupo como discipulador.
  `leader_id` int(10) unsigned DEFAULT NULL,
  -- Capacidad prevista de integrantes del grupo.
  `capacity` int(11) NOT NULL DEFAULT 20,
  PRIMARY KEY (`id`),
  KEY `leader_id` (`leader_id`),
  CONSTRAINT `groups_family_ibfk_1` FOREIGN KEY (`leader_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- members: Discípulos: perfiles personales, contacto, grupo y seguimiento pastoral.
CREATE TABLE IF NOT EXISTS `members` (
  -- Identificador único del registro.
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  -- Nombre de la persona, grupo o ministerio.
  `name` varchar(160) NOT NULL,
  -- Tipo de documento de identificación.
  `id_type` varchar(30) NOT NULL,
  -- Número de documento de identificación.
  `identification` varchar(40) NOT NULL,
  -- Número de teléfono o celular.
  `phone` varchar(30) NOT NULL,
  -- Correo electrónico.
  `email` varchar(190) DEFAULT NULL,
  -- Fecha de nacimiento.
  `birthday` date NOT NULL,
  -- Grupo sanguíneo y factor RH.
  `blood_type` varchar(8) DEFAULT NULL,
  -- Entidad promotora de salud de la persona.
  `eps` varchar(100) DEFAULT NULL,
  -- Función que desempeña la persona en la iglesia.
  `church_function` varchar(150) DEFAULT NULL,
  -- Sede a la que pertenece.
  `campus` varchar(150) DEFAULT NULL,
  -- Nombre del contacto de emergencia.
  `emergency_name` varchar(160) DEFAULT NULL,
  -- Teléfono del contacto de emergencia.
  `emergency_phone` varchar(30) DEFAULT NULL,
  -- Estado del discípulo: activo, inactivo o retirado.
  `status` varchar(20) NOT NULL DEFAULT 'activo',
  -- Identificador del grupo de comunión familiar relacionado, en groups_family.
  `group_id` int(10) unsigned DEFAULT NULL,
  -- Cobertura pastoral registrada para la persona.
  `coverage` varchar(160) DEFAULT NULL,
  -- Indicador de nacido de nuevo: 1 = sí, 0 = no.
  `born_again` tinyint(1) NOT NULL DEFAULT 0,
  -- Foto del perfil codificada como datos de imagen.
  `photo_data` mediumtext DEFAULT NULL,
  -- Fecha y hora de creación del registro.
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  -- Identificador de la cuenta de usuario relacionada, en users.
  `user_id` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `identification` (`identification`),
  UNIQUE KEY `user_id` (`user_id`),
  KEY `group_id` (`group_id`),
  CONSTRAINT `members_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `groups_family` (`id`),
  CONSTRAINT `members_ibfk_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ministries: Ministerios: catálogo conservado aunque no tenga un menú visible.
CREATE TABLE IF NOT EXISTS `ministries` (
  -- Identificador único del registro.
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  -- Nombre de la persona, grupo o ministerio.
  `name` varchar(120) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- member_ministries: Relación entre discípulos y ministerios; permite varios ministerios por persona.
CREATE TABLE IF NOT EXISTS `member_ministries` (
  -- Identificador del perfil del discípulo, en members.
  `member_id` int(10) unsigned NOT NULL,
  -- Identificador del ministerio, en ministries.
  `ministry_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`member_id`,`ministry_id`),
  KEY `ministry_id` (`ministry_id`),
  CONSTRAINT `member_ministries_ibfk_1` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE,
  CONSTRAINT `member_ministries_ibfk_2` FOREIGN KEY (`ministry_id`) REFERENCES `ministries` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- courses: Cursos de adiestramiento y discipulado, con docente, libro y grupo.
CREATE TABLE IF NOT EXISTS `courses` (
  -- Identificador único del registro.
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  -- Título del curso, material o encuentro.
  `title` varchar(160) NOT NULL,
  -- Área de formación: adiestramiento o discipulado.
  `area` varchar(30) NOT NULL,
  -- Descripción del curso o encuentro.
  `description` text DEFAULT NULL,
  -- Identificador del usuario docente o discipulador a cargo.
  `teacher_id` int(10) unsigned DEFAULT NULL,
  -- Texto descriptivo del horario de formación.
  `schedule` varchar(160) DEFAULT NULL,
  -- Libro que se estudia en el curso.
  `book` varchar(200) NOT NULL DEFAULT '',
  -- Identificador del grupo de comunión familiar relacionado, en groups_family.
  `group_id` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `teacher_id` (`teacher_id`),
  CONSTRAINT `courses_ibfk_1` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- enrollments: Inscripciones de cuentas de usuario en cursos.
CREATE TABLE IF NOT EXISTS `enrollments` (
  -- Identificador del curso relacionado, en courses.
  `course_id` int(10) unsigned NOT NULL,
  -- Identificador de la cuenta de usuario relacionada, en users.
  `user_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`course_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `enrollments_ibfk_1` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `enrollments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- lessons: Lecciones y materiales publicados dentro de cada curso.
CREATE TABLE IF NOT EXISTS `lessons` (
  -- Identificador único del registro.
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  -- Identificador del curso relacionado, en courses.
  `course_id` int(10) unsigned NOT NULL,
  -- Título del curso, material o encuentro.
  `title` varchar(160) NOT NULL,
  -- Contenido del material de estudio.
  `body` text DEFAULT NULL,
  -- Enlace al material de estudio.
  `url` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `course_id` (`course_id`),
  CONSTRAINT `lessons_ibfk_1` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- events: Encuentros: eventos, servicios dominicales y sesiones de formación.
CREATE TABLE IF NOT EXISTS `events` (
  -- Identificador único del registro.
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  -- Título del curso, material o encuentro.
  `title` varchar(160) NOT NULL,
  -- Tipo de encuentro: servicio, especial, grupo, adiestramiento o discipulado.
  `kind` varchar(30) NOT NULL,
  -- Fecha y hora local del encuentro.
  `event_date` datetime NOT NULL,
  -- Lugar del encuentro o enlace de reunión.
  `location` varchar(200) DEFAULT NULL,
  -- Dirección de la imagen del encuentro.
  `image_url` varchar(500) DEFAULT NULL,
  -- Descripción del curso o encuentro.
  `description` text DEFAULT NULL,
  -- El encuentro requiere inscripción: 1 = sí, 0 = no.
  `registration` tinyint(1) NOT NULL DEFAULT 0,
  -- Estado del encuentro: programado o cancelado.
  `status` varchar(20) NOT NULL DEFAULT 'programado',
  -- Identificador del grupo de comunión familiar relacionado, en groups_family.
  `group_id` int(10) unsigned DEFAULT NULL,
  -- Identificador del curso relacionado, en courses.
  `course_id` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `group_id` (`group_id`),
  CONSTRAINT `events_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `groups_family` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- attendance: Asistencia de cada discípulo a un encuentro; un registro por persona y encuentro.
CREATE TABLE IF NOT EXISTS `attendance` (
  -- Identificador del encuentro, en events.
  `event_id` int(10) unsigned NOT NULL,
  -- Identificador del perfil del discípulo, en members.
  `member_id` int(10) unsigned NOT NULL,
  -- Estado de asistencia: presente, ausente, justificado o visitante.
  `status` varchar(20) NOT NULL,
  -- Identificador del usuario que registró o corrigió la asistencia.
  `recorded_by` int(10) unsigned NOT NULL,
  -- Fecha y hora de la última actualización del registro.
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`event_id`,`member_id`),
  KEY `member_id` (`member_id`),
  KEY `recorded_by` (`recorded_by`),
  CONSTRAINT `attendance_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`),
  CONSTRAINT `attendance_ibfk_2` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`),
  CONSTRAINT `attendance_ibfk_3` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- audit: Auditoría general: acciones realizadas por las cuentas de usuario.
CREATE TABLE IF NOT EXISTS `audit` (
  -- Identificador único del registro.
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  -- Identificador de la cuenta de usuario relacionada, en users.
  `user_id` int(10) unsigned DEFAULT NULL,
  -- Descripción de la acción registrada en la auditoría general.
  `action` varchar(160) NOT NULL,
  -- Fecha y hora de creación del registro.
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- course_members: Inscripciones de perfiles de discípulos en cursos, distintas de las cuentas de usuario.
CREATE TABLE IF NOT EXISTS `course_members` (
  -- Identificador del curso relacionado, en courses.
  `course_id` int(10) unsigned NOT NULL,
  -- Identificador del perfil del discípulo, en members.
  `member_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`course_id`,`member_id`),
  KEY `member_id` (`member_id`),
  CONSTRAINT `course_members_ibfk_1` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `course_members_ibfk_2` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- roles: Catálogo de roles de acceso.
CREATE TABLE IF NOT EXISTS `roles` (
  -- Identificador único del registro.
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  -- Nombre del rol o módulo.
  `nombre` varchar(40) NOT NULL,
  -- Descripción del rol.
  `descripcion` varchar(160) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- modulos: Catálogo de secciones de la aplicación.
CREATE TABLE IF NOT EXISTS `modulos` (
  -- Identificador único del registro.
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  -- Nombre del rol o módulo.
  `nombre` varchar(80) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- permisos_rol: Matriz de permisos de cada rol para cada módulo.
CREATE TABLE IF NOT EXISTS `permisos_rol` (
  -- Identificador del rol, en roles.
  `rol_id` int(10) unsigned NOT NULL,
  -- Identificador del módulo, en modulos.
  `modulo_id` int(10) unsigned NOT NULL,
  -- Permiso para consultar el módulo: 1 = permitido, 0 = no permitido.
  `puede_ver` tinyint(1) NOT NULL DEFAULT 0,
  -- Permiso para crear registros: 1 = permitido, 0 = no permitido.
  `puede_crear` tinyint(1) NOT NULL DEFAULT 0,
  -- Permiso para editar registros: 1 = permitido, 0 = no permitido.
  `puede_editar` tinyint(1) NOT NULL DEFAULT 0,
  -- Permiso para eliminar registros: 1 = permitido, 0 = no permitido.
  `puede_eliminar` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`rol_id`,`modulo_id`),
  KEY `modulo_id` (`modulo_id`),
  CONSTRAINT `permisos_rol_ibfk_1` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `permisos_rol_ibfk_2` FOREIGN KEY (`modulo_id`) REFERENCES `modulos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- solicitudes_acceso: Solicitudes de registro y su proceso de aprobación o rechazo.
CREATE TABLE IF NOT EXISTS `solicitudes_acceso` (
  -- Identificador único del registro.
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  -- Identificador de la cuenta de usuario relacionada, en users.
  `user_id` int(10) unsigned NOT NULL,
  -- Origen del registro: correo, Google o creación administrativa, según ENUM.
  `metodo_registro` enum('correo','google') NOT NULL,
  -- Estado del proceso de acceso o de la cuenta; los valores permitidos aparecen en ENUM.
  `estado` enum('pendiente','activa','rechazada') NOT NULL DEFAULT 'pendiente',
  -- Fecha y hora en que se presentó la solicitud.
  `fecha_solicitud` timestamp NOT NULL DEFAULT current_timestamp(),
  -- Identificador del usuario que resolvió la solicitud.
  `aprobado_por` int(10) unsigned DEFAULT NULL,
  -- Fecha y hora de aprobación o rechazo de la solicitud.
  `fecha_resolucion` datetime DEFAULT NULL,
  -- Explicación del rechazo, si fue registrada.
  `motivo_rechazo` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `aprobado_por` (`aprobado_por`),
  KEY `estado` (`estado`,`fecha_solicitud`),
  CONSTRAINT `solicitudes_acceso_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `solicitudes_acceso_ibfk_2` FOREIGN KEY (`aprobado_por`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- notificaciones: Avisos internos de la aplicación; no representan correos enviados.
CREATE TABLE IF NOT EXISTS `notificaciones` (
  -- Identificador único del registro.
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  -- Identificador de la cuenta de usuario relacionada, en users.
  `user_id` int(10) unsigned DEFAULT NULL,
  -- Tipo de notificación interna.
  `tipo` varchar(40) NOT NULL,
  -- Texto de la notificación.
  `mensaje` varchar(500) NOT NULL,
  -- La notificación fue leída: 1 = sí, 0 = no.
  `leida` tinyint(1) NOT NULL DEFAULT 0,
  -- Fecha y hora de creación del registro.
  `creada_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`,`leida`),
  CONSTRAINT `notificaciones_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- auditoria_permisos: Historial de aprobaciones, cambios de rol y otras acciones de administración de accesos.
CREATE TABLE IF NOT EXISTS `auditoria_permisos` (
  -- Identificador único del registro.
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  -- Identificador del usuario que realizó la acción administrativa.
  `actor_id` int(10) unsigned DEFAULT NULL,
  -- Identificador del usuario afectado por la acción administrativa.
  `objetivo_id` int(10) unsigned DEFAULT NULL,
  -- Tipo de acción administrativa realizada.
  `accion` varchar(40) NOT NULL,
  -- Explicación del cambio realizado.
  `detalle` varchar(500) NOT NULL,
  -- Fecha y hora de creación del registro.
  `creada_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `actor_id` (`actor_id`),
  KEY `objetivo_id` (`objetivo_id`),
  CONSTRAINT `auditoria_permisos_ibfk_1` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `auditoria_permisos_ibfk_2` FOREIGN KEY (`objetivo_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

