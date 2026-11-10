# ARCA — nueva plataforma

Aplicación React con API Node/Express y base relacional `arc`. Se conservaron el logo y los dos videos de introducción originales. No se modificaron los proyectos anteriores de Descargas.

## Abrir en este equipo

1. Abre `Iniciar-ARCA.cmd` y deja la ventana abierta.
2. Entra a http://127.0.0.1:4180 desde el navegador del equipo.
3. Usa un correo y su contraseña de `CUENTAS-DEMO.txt`.

Desde la terminal también puedes ejecutar `npm run dev`: inicia la base de datos local y la aplicación, igual que `Iniciar-ARCA.cmd`. Usa solo uno de los dos iniciadores y deja su ventana abierta. `npm start` inicia únicamente la aplicación y requiere una base de datos ya encendida.

El iniciador utiliza Node.js y MariaDB de `C:\xampp\mysql`. Levanta una instancia independiente en el puerto **3306**, con datos en `runtime/mysql-data`. La API usa el puerto **4180**. Para detener, pulsa Ctrl+C en la ventana del iniciador.

## Desplegar en Vercel

El proyecto separa la interfaz estática de Vite y la API Express, que se ejecuta como una función de Vercel. La base local de XAMPP no se publica ni es accesible desde Vercel; necesitas una instancia MySQL alojada que permita conexiones desde Vercel y use TLS.

Las rutas de `vercel.json` envían primero `/api` y sus subrutas a `api/index.js`, después resuelven archivos estáticos y finalmente sirven la interfaz. No reemplaces ese orden con una regla global hacia `index.html`: el login devolvería 405 sin JSON. Puedes verificar el enrutamiento y la validación del login sin consultar la base con `node --test tests/hosting.test.js`.

1. Confirma que el esquema `arc` y sus migraciones están aplicados en el MySQL alojado. No ejecutes `npm run db:init` contra producción: crea cuentas de demostración.
2. Importa el repositorio en Vercel. La configuración de este proyecto compila con `npm run build` y publica `dist`.
3. En **Settings → Environment Variables** de Vercel, configura `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD` para Production. Añade `DB_SSL=true`, `DB_CONNECTION_LIMIT=2` y `TRUST_PROXY_HOPS=1`. Usa una cuenta MySQL exclusiva para la aplicación, con permisos mínimos; no copies credenciales al repositorio ni al chat.
4. Despliega y comprueba `https://TU-DOMINIO/api/health`. Debe responder con `{"ok":true,"database":"conectada"}`.

El repositorio excluye `.env`, `CUENTAS-DEMO.txt` y `runtime/`; no subas copias de la base ni archivos con cuentas. La aplicación maneja datos personales, incluidos EPS y datos de emergencia: revisa los requisitos de privacidad y los controles de acceso del proveedor antes de cargar información real. Vercel aloja la aplicación, no la base de datos.

La conexión ya está configurada en `.env` con `DB_NAME=arc`, que contiene credenciales locales privadas. No lo publiques. `runtime/database-admin.txt` contiene la clave administrativa de esta instancia aislada. La cuenta de la API tiene permisos limitados a `arc`.

La base anterior `arca_nueva` se conserva como respaldo de la migración a `arc`; la aplicación ya no la usa y los cambios nuevos solo se guardan en `arc`. No borres ese respaldo hasta verificar la nueva base. El nombre visible de la aplicación sigue siendo ARCA.

## Flujo de trabajo

- **Accesos:** al solicitar una cuenta se pide fecha de nacimiento y EPS; la solicitud queda pendiente de aprobación. El coordinador puede crear cuentas, asignar roles disponibles (excepto administrador), vincularlas con un perfil de miembro e inscribirlas en cursos. Las cuentas existentes de Pastor, Rector, Multimedia y Asistencia pastoral se conservan, pero esos roles ya no se ofrecen para nuevas asignaciones. La contraseña temporal se muestra una vez y se cambia en el primer ingreso. No hay envío automático de correos.
- **Permisos:** administración puede aprobar solicitudes y, en **Cambiar roles de personas aprobadas**, reasignar el rol de una cuenta existente (también si está suspendida). Selecciona el nuevo rol y pulsa **Guardar rol**; el cambio se aplica a la siguiente petición, sin modificar grupos ni cursos. No se permite cambiar el propio rol ni dejar la aplicación sin un administrador activo. Los cambios quedan en la auditoría.
- **Discípulos (antes Miembros):** registra nombre, identificación, celular, nacimiento, correo, RH, EPS, función, sede, emergencia, cobertura, foto y nacido de nuevo. La edad se calcula desde la fecha de nacimiento. El estado puede ser activo, inactivo o retirado. Se conservan los perfiles y permisos existentes.
- **Adiestramiento:** reúne las aulas de adiestramiento y los cursos anteriores de discipulado; al crear un curso se elige el área. Elige docente y libro; entra al aula para inscribir personas y publicar material. Cada grupo de comunión familiar corresponde al curso de discipulado dirigido por su discipulador. Inicio muestra inscritos, alumnos que han asistido, asistencias y sesiones por curso. Accesos y las fichas individuales muestran grupo y conteos de asistencia; el discipulador ve ese resumen para sus grupos.
- **Eventos (reemplaza el menú Discipulado):** consulta los encuentros no clasificados como servicio, incluidos los encuentros de grupo y las sesiones de formación existentes. Los roles autorizados pueden crear eventos especiales o de grupo; administración, pastor y multimedia pueden editar sus datos, reprogramar o cancelar. Los servicios se consultan por separado en Servicios.
- **Asistencia:** crea una sesión de curso, selecciona el encuentro y registra presente, ausente, justificado o visitante. Las correcciones requieren administración, pastor o asistencia pastoral. La ausencia debe registrarse expresamente; una lista pendiente no se convierte automáticamente en falta.
- Cualquier rol habilitado excepto Estudiante puede registrar asistencia en cualquier encuentro, también para personas no inscritas en el curso. Solo Administración puede consultar el historial detallado y exportarlo.
- **Inicio:** indicadores de activos, nacidos de nuevo, formación e inscritos, asistencia por curso y alertas. Hay alerta tras más de ocho días sin asistencia registrada, contando desde el alta si nunca asistió; también tras las dos últimas asistencias ausentes dentro de un mismo curso. No se envían mensajes externos.
- **Historial:** abre un perfil desde Discípulos o un aula para consultar las fechas y estados de asistencia. Administración también tiene **Historial de asistencia** para buscar y consultar todos los registros por persona, fecha, curso o estado, y exportarlos a Excel o PDF. Rector, coordinador y docente reciben una vista académica sin identificación, teléfono, EPS ni datos de emergencia.
- **Servicios:** muestra los servicios y un llamado de asistencia dominical para los roles habilitados para registrar asistencia. Elige la fecha de un domingo y pulsa **Abrir llamado del domingo** si aún no hay servicio: reutiliza un servicio general no cancelado de esa fecha o crea uno a las 09:00, sin duplicarlo ante solicitudes simultáneas. Si hay varios, selecciona el servicio correspondiente. Busca un discípulo y marca presente, ausente, justificado o visitante; cada selección se guarda. Puedes volver a domingos anteriores para consultar su lista. Las correcciones conservan los permisos pastorales y no se permite registrar en encuentros cancelados. No se crean servicios futuros automáticamente ni se envían recordatorios.
- **Reportes:** descarga asistencia, cumpleaños y grupos en PDF y Excel según el rol.

La transcripción posterior tiene prioridad para la interfaz: se retiraron las secciones institucionales, ministerios y horarios de navegación. La información del PDF que dejó de corresponder a esa interfaz está documentada en `REQUISITOS.md`.

## MySQL y Workbench

`database/arc.sql` es el esquema completo, listo para abrir y ejecutar desde MySQL Workbench contra un servidor **MySQL 8**. Workbench es el cliente; necesita un servidor al que conectarse. La ejecución aquí se verificó contra **MariaDB 10.4 de XAMPP**, no contra MySQL Server 8 ni una versión específica de Workbench.

Para conectar tu MySQL Server:

1. Ejecuta el SQL con una cuenta que pueda crear la base nueva.
2. Crea un usuario exclusivo y concédele SELECT, INSERT, UPDATE y DELETE sobre `arc.*`.
3. Configura `DB_HOST`, `DB_PORT`, `DB_NAME=arc`, `DB_USER` y `DB_PASSWORD` en `.env`.
4. Para generar los roles demo y datos iniciales ejecuta `npm run db:init` con credenciales administrativas temporales en las variables de entorno `DB_ADMIN_USER` y `DB_ADMIN_PASSWORD`; no las publiques ni las dejes configuradas para el servidor.
5. Ejecuta `npm start` para usar ese servidor, sin iniciar la instancia aislada de XAMPP.

Para actualizar una base existente desde MySQL Workbench, abre y ejecuta `database/actualizar_base.sql` conectado a `arc` con un usuario que tenga permisos de ALTER y CREATE. El script agrega los cambios de esquema de forma idempotente y no elimina tablas ni registros. Después, configura las credenciales de la aplicación en `.env`; el script no modifica permisos del servidor MySQL. Estos scripts no trasladan una instalación externa de `arca_nueva`: antes de usarlos allí, copia su estructura y datos a `arc` y verifica la copia.

Los scripts de actualización y el iniciador local también renombran los módulos de permisos Miembros → Discípulos y Discipulado → Eventos, conservando sus identificadores y asignaciones. No se renombran las tablas `members` ni `events`: los perfiles, eventos y asistencias siguen guardándose allí; los roles se guardan en `users.role` y sus cambios en `auditoria_permisos`. Repetir la migración no aprueba solicitudes pendientes. `node server/export-schema.js` regenera el esquema completo, incluidas las tablas de permisos, sin exportar datos personales ni credenciales.

El SQL no incluye contraseñas predeterminadas. El inicializador genera contraseñas únicas y las escribe en `CUENTAS-DEMO.txt` únicamente para cuentas nuevas. Los nombres de los cinco grupos del PDF son provisionales porque no fueron suministrados.

## React y app instalable

`npm install`, `npm run build`, `npm start`. El repositorio incluye `package-lock.json`; para reproducir las versiones usa `npm ci`.

Se incluye manifiesto y service worker para instalación como aplicación web cuando el navegador lo permita. En computador se usa localhost; para instalar y acceder desde un teléfono hay que desplegar el servidor con HTTPS y un dominio accesible. No es un APK ni una app publicada en tiendas. Los datos personales no se almacenan en el caché del service worker.

## Verificación y límites

Se verificaron compilación React, base conectada, autenticación, restricciones por rol, bloqueo de escalamiento, contraseña temporal, revocación de sesiones, creación de miembros y cursos, docente/libro, inscripción, asistencia y correcciones, historial con ocultamiento de datos, alertas y exportaciones PDF/Excel.

Las pruebas automatizadas usan las cuentas demo y crean/eliminan únicamente sus registros de prueba; ejecutarlas solo en esta base de demostración. Con la aplicación iniciada, `npm test` comprueba accesos, límites de intentos, gestión de eventos y asistencia dominical, incluyendo validación de domingos, reutilización concurrente, guardado y restricciones de corrección. `node server/local.js --verify` inicia y verifica los accesos de la instancia local.

Kluster no pudo revisar: su herramienta reportó `connectionError`. No se presenta como revisión aprobada.

Antes de producción quedan el despliegue HTTPS, verificación en MySQL Server, aprobación institucional del texto de privacidad y pruebas visuales/instalación en dispositivos. El audio se incorporó usando las dos capturas de su transcripción; no se realizó transcripción directa del archivo OGG.
