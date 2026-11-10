USE arc;

SET @s=DATABASE();
SET @q=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@s AND TABLE_NAME='users' AND COLUMN_NAME='photo_data')=0,'ALTER TABLE users ADD COLUMN photo_data MEDIUMTEXT NULL','SELECT 1'); PREPARE x FROM @q; EXECUTE x; DEALLOCATE PREPARE x;
SET @q=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@s AND TABLE_NAME='events' AND COLUMN_NAME='checkin_token_hash')=0,'ALTER TABLE events ADD COLUMN checkin_token_hash CHAR(64) NULL','SELECT 1'); PREPARE x FROM @q; EXECUTE x; DEALLOCATE PREPARE x;

-- Idempotent migration for ARCA access requests and role permissions.
SET @estado_existia=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@s AND TABLE_NAME='users' AND COLUMN_NAME='estado');
SET @q=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@s AND TABLE_NAME='users' AND COLUMN_NAME='estado')=0,
 'ALTER TABLE users ADD COLUMN estado ENUM(''pendiente'',''activa'',''rechazada'',''suspendida'') NOT NULL DEFAULT ''activa''','SELECT 1'); PREPARE x FROM @q; EXECUTE x; DEALLOCATE PREPARE x;
SET @q=IF((SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@s AND TABLE_NAME='users' AND COLUMN_NAME='role')='NO','ALTER TABLE users MODIFY role VARCHAR(40) NULL','SELECT 1'); PREPARE x FROM @q; EXECUTE x; DEALLOCATE PREPARE x;
SET @q=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@s AND TABLE_NAME='users' AND COLUMN_NAME='aprobado_por')=0,'ALTER TABLE users ADD COLUMN aprobado_por INT UNSIGNED NULL, ADD COLUMN fecha_aprobacion DATETIME NULL, ADD COLUMN motivo_rechazo VARCHAR(500) NULL','SELECT 1'); PREPARE x FROM @q; EXECUTE x; DEALLOCATE PREPARE x;
SET @q=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@s AND TABLE_NAME='users' AND COLUMN_NAME='metodo_registro')=0,'ALTER TABLE users ADD COLUMN metodo_registro ENUM(''correo'',''google'',''administrativo'') NOT NULL DEFAULT ''administrativo''','SELECT 1'); PREPARE x FROM @q; EXECUTE x; DEALLOCATE PREPARE x;

CREATE TABLE IF NOT EXISTS roles(id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,nombre VARCHAR(40) NOT NULL UNIQUE,descripcion VARCHAR(160) NOT NULL DEFAULT '') ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS modulos(id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,nombre VARCHAR(80) NOT NULL UNIQUE) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS permisos_rol(rol_id INT UNSIGNED NOT NULL,modulo_id INT UNSIGNED NOT NULL,puede_ver BOOLEAN NOT NULL DEFAULT 0,puede_crear BOOLEAN NOT NULL DEFAULT 0,puede_editar BOOLEAN NOT NULL DEFAULT 0,puede_eliminar BOOLEAN NOT NULL DEFAULT 0,PRIMARY KEY(rol_id,modulo_id),FOREIGN KEY(rol_id) REFERENCES roles(id) ON DELETE CASCADE,FOREIGN KEY(modulo_id) REFERENCES modulos(id) ON DELETE CASCADE) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS solicitudes_acceso(id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,user_id INT UNSIGNED NOT NULL,metodo_registro ENUM('correo','google') NOT NULL,estado ENUM('pendiente','activa','rechazada') NOT NULL DEFAULT 'pendiente',fecha_solicitud TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,aprobado_por INT UNSIGNED NULL,fecha_resolucion DATETIME NULL,motivo_rechazo VARCHAR(500) NULL,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,FOREIGN KEY(aprobado_por) REFERENCES users(id) ON DELETE SET NULL,KEY(estado,fecha_solicitud)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS notificaciones(id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,user_id INT UNSIGNED NULL,tipo VARCHAR(40) NOT NULL,mensaje VARCHAR(500) NOT NULL,leida BOOLEAN NOT NULL DEFAULT 0,creada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,KEY(user_id,leida)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS auditoria_permisos(id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,actor_id INT UNSIGNED NULL,objetivo_id INT UNSIGNED NULL,accion VARCHAR(40) NOT NULL,detalle VARCHAR(500) NOT NULL,creada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE SET NULL,FOREIGN KEY(objetivo_id) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB;

INSERT IGNORE INTO roles(nombre,descripcion) VALUES('administrador','Administración completa'),('coordinador','Coordinación'),('docente','Docencia'),('discipulador','Liderazgo de grupo'),('estudiante','Formación');
UPDATE modulos SET nombre='Discípulos' WHERE nombre='Miembros';
UPDATE modulos SET nombre='Eventos' WHERE nombre='Discipulado';
INSERT IGNORE INTO modulos(nombre) VALUES('Inicio'),('Discípulos'),('Grupos familiares'),('Servicios'),('Asistencia'),('Adiestramiento'),('Eventos'),('Reportes'),('Accesos'),('Permisos');
INSERT IGNORE INTO permisos_rol(rol_id,modulo_id,puede_ver,puede_crear,puede_editar,puede_eliminar) SELECT r.id,m.id,(r.nombre='administrador'),(r.nombre='administrador'),(r.nombre='administrador'),(r.nombre='administrador') FROM roles r CROSS JOIN modulos m;
UPDATE permisos_rol p JOIN roles r ON r.id=p.rol_id SET p.puede_ver=1,p.puede_crear=1,p.puede_editar=1,p.puede_eliminar=1 WHERE r.nombre='administrador';
SET @q=IF(@estado_existia=0,'UPDATE users SET estado=IF(active=1,''activa'',''suspendida'')','SELECT 1'); PREPARE x FROM @q; EXECUTE x; DEALLOCATE PREPARE x;
INSERT IGNORE INTO permisos_rol(rol_id,modulo_id,puede_ver,puede_crear,puede_editar,puede_eliminar) SELECT r.id,m.id,1,1,1,1 FROM roles r CROSS JOIN modulos m WHERE r.nombre='administrador';
