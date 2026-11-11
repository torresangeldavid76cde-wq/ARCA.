# ARCA: Aiven MySQL → GitHub → Vercel

La interfaz se publica en Vercel y la API Express se ejecuta en `api/index.js`.
Los registros se guardan en **Aiven for MySQL**. Selecciona MySQL al crear el
servicio; esta aplicación no usa PostgreSQL. Las migraciones se ejecutan desde
tu equipo una sola vez, fuera del build y de las peticiones de la aplicación.

## 1. Preparar el .env privado

Conserva tu `.env` actual. Consulta `.env.example` para añadir las variables que
faltan; no reemplaces tus claves por las del ejemplo. Antes de cambiar `DB_*`,
copia sus valores locales a `SOURCE_DB_*`:

Mantén `DB_*` apuntando a la base local hasta terminar el respaldo del paso 2.
El bloque de destino que aparece abajo se configura después, antes del paso 3.

```dotenv
# Origen: tu base local existente, solo para exportar
SOURCE_DB_HOST=127.0.0.1
SOURCE_DB_PORT=3306
SOURCE_DB_NAME=arc
SOURCE_DB_USER=TU_USUARIO_LOCAL
SOURCE_DB_PASSWORD=TU_CLAVE_LOCAL
SOURCE_DB_SSL=false

# Destino y conexión de la aplicación: copiar desde Aiven
DB_HOST=TU_HOST_DE_AIVEN
DB_PORT=TU_PUERTO_DE_AIVEN
DB_NAME=defaultdb
DB_USER=TU_USUARIO_DE_APLICACION
DB_PASSWORD=TU_CLAVE_DE_APLICACION
DB_SSL=true
DB_SSL_CA_PATH=runtime/aiven-ca.pem
DB_CONNECTION_LIMIT=2
DB_CONNECT_TIMEOUT=10000

# Solo mantenimiento local, si el usuario de aplicación no puede crear tablas
DB_ADMIN_USER=TU_USUARIO_DE_MIGRACION
DB_ADMIN_PASSWORD=TU_CLAVE_DE_MIGRACION
```

Usa el puerto y el nombre reales que muestra **Connection information** de Aiven;
no se presupone que el puerto sea 3306. `defaultdb` es un ejemplo: selecciona una
base **vacía** en Aiven. Los comandos no crean la base y nunca seleccionan `arc`
de forma fija. Crea una base vacía desde la consola de Aiven si hace falta.

Descarga el certificado CA del servicio y guárdalo en `runtime/aiven-ca.pem`.
La conexión valida tanto la CA como el nombre del servidor. No desactives esa
validación. Como alternativa al archivo, configura `DB_SSL_CA` con el PEM entero;
admite saltos reales o `\n` escritos literalmente. Usa una sola de estas dos
variables. Los certificados y `runtime/` están excluidos de Git.

El usuario de aplicación necesita SELECT, INSERT, UPDATE y DELETE sobre la base.
El usuario de mantenimiento necesita también los permisos necesarios para
CREATE, ALTER, INDEX y REFERENCES. Puedes utilizar temporalmente el usuario
administrativo del servicio para importar; sus claves se quedan en tu equipo.
Permite el acceso de tu equipo y de Vercel en la configuración de red de Aiven.
Si restringes por IP, usa una solución de salida estable compatible con tu plan.

## 2. Respaldar la base local

El cliente `mysqldump` de XAMPP se detecta automáticamente en Windows para
exportar la base local. En otro equipo debe estar en PATH, o indicar su ruta
con `MYSQLDUMP_BIN`. La importación usa `mysql2`, el mismo controlador de la API,
compatible con la autenticación de MySQL 8 de Aiven. No necesita `mysql.exe`
ni instala dependencias nuevas del proyecto.

Pausa las escrituras de la plataforma durante el respaldo y el cambio final de
base. Si la base local está apagada, todavía con `DB_*` locales, usa
`Iniciar-ARCA.cmd` y deja su ventana abierta. Deja de usar la interfaz mientras
exportas. El exportador lee exclusivamente `SOURCE_DB_*`.

```powershell
npm run db:export
```

Al terminar, detén el iniciador con Ctrl+C y configura `DB_*` para Aiven según
el bloque del paso 1. Con `DB_*` apuntando a Aiven, **no ejecutes `npm run dev`,
`Iniciar-ARCA.cmd` ni `db:init`**: esos iniciadores son para la base local y
generan datos demo. Para probar la aplicación con Aiven desde tu equipo,
usa `npm run build` y luego `npm start`, después de completar el paso 3.

Se generan `runtime/aiven-backup.sql` y `runtime/aiven-backup.sql.json`. El
manifiesto contiene los conteos por tabla y SHA-256 del SQL, sin claves. El SQL
sí contiene información privada, fotos y hashes de contraseñas: conserva ambos
archivos juntos y fuera de GitHub. Se usa una instantánea consistente de InnoDB
y no se modifican los registros locales. Si cambian los conteos durante la copia,
no se genera el manifiesto. Pausar las escrituras también evita cambios de
contenido que no alteren el número de filas.

El exportador rechaza vistas, motores distintos de InnoDB, triggers, rutinas y
eventos SQL para evitar omitir objetos que exijan una migración especial. Los
eventos de la plataforma son filas de la tabla `events`, y sí se incluyen.
Para repetir una exportación, conserva el SQL y el manifiesto anteriores con
otro nombre dentro de `runtime/`. No se sobrescriben respaldos existentes.

## 3. Importar y actualizar Aiven

No ejecutes `db:migrate` antes de la primera importación: el destino tiene que
estar completamente vacío. Estos comandos muestran una indicación sin escribir
si omites `--apply`:

```powershell
npm run db:import -- --apply
npm run db:migrate -- --apply
npm run db:check
```

- `db:import` valida el checksum, rechaza cualquier destino que ya tenga tablas,
  importa el SQL y compara todos los conteos con el manifiesto. Revoca las
  sesiones copiadas para exigir un nuevo inicio de sesión en el sitio público.
- `db:migrate` aplica la estructura y las migraciones existentes a `DB_NAME`,
  sin ejecutar `server/init.js` ni generar cuentas demo. También se usa para
  actualizar una instalación de nube ya existente; haz un respaldo antes.
- `db:check` usa las credenciales de aplicación, comprueba TLS, lista conteos y
  verifica columnas de fotos, permisos y QR. No cambia datos ni muestra registros.

MySQL no revierte automáticamente todos los cambios DDL. Si una importación
falla, puede haber tablas parciales: conserva el respaldo, resuelve el error y
reintenta en otra base vacía. El comando no borra tablas para recuperar un error.
No repitas la importación sobre una base activa. Las migraciones de esquema no
son una herramienta de sincronización continua entre instalaciones.

Se conservan cuentas, contraseñas cifradas, roles, permisos, personas, cursos,
fotos y asistencias. Antes de abrir el dominio, cambia las contraseñas demo que
hayan sido compartidas o aparezcan en el historial de Git. Consulta también
`DESPLIEGUE.md`. Verifica inicio de sesión, permisos y guardado con tus cuentas.

## 4. Publicar código en GitHub

El remoto `origin` de este proyecto ya apunta a GitHub. Revisa y confirma los
archivos antes de hacer commit y push desde tu cliente Git. No añadas `.env`,
certificados, cuentas demo ni respaldos. Las comprobaciones de GitHub Actions
ejecutan `test:hosting` y el build sin conectar a la base ni usar secretos.
La integración normal de Vercel con GitHub realiza los despliegues; no hace
falta un token de Vercel en GitHub Actions.

## 5. Conectar GitHub con Vercel

En Vercel, importa el repositorio y comprueba estas opciones:

| Opción | Valor |
| --- | --- |
| Root Directory | Raíz de este proyecto |
| Framework Preset | Vite |
| Node.js | 22.x |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Se conserva el orden de rutas en `vercel.json`: API, archivos estáticos e
interfaz. `npm start` y el iniciador XAMPP no forman parte del despliegue.

En **Settings → Environment Variables**, configura para **Production**:

| Variable | Valor |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_NAME` | Los mismos datos del destino de Aiven |
| `DB_USER`, `DB_PASSWORD` | Usuario y clave de aplicación |
| `DB_SSL` | `true` |
| `DB_SSL_CA` | Contenido completo del certificado CA de Aiven |
| `DB_CONNECTION_LIMIT` | `2` por instancia de la función |
| `DB_CONNECT_TIMEOUT` | `10000` |
| `NODE_ENV` | `production` |
| `TRUST_PROXY_HOPS` | `1` |

El `.env` local no viaja de GitHub a Vercel. Debes copiar estas variables al
proyecto de Vercel antes de desplegar. `DB_SSL_CA_PATH` no se configura allí,
porque el archivo local no se publica. No subas `SOURCE_DB_*` ni `DB_ADMIN_*`.
No pongas prefijo `VITE_` a ninguna credencial: ese prefijo expone valores al
navegador. El límite de conexiones se aplica por instancia, por lo que el total
puede aumentar cuando Vercel escala.

Las ramas de prueba generan Preview deployments. Utiliza otra base y otras
credenciales para Preview antes de habilitarlo; no reutilices automáticamente
la base de producción. Tras cambiar variables, crea un despliegue nuevo.

Comprueba `https://TU-DOMINIO/api/health`:

```json
{"ok":true,"database":"conectada"}
```

Ese endpoint comprueba conectividad. La verificación de columnas se hace con
`db:check`. Luego prueba login, consulta de personas, guardado de asistencia,
foto, generación de QR y exportaciones en el dominio HTTPS. Conserva la base
local hasta completar estas verificaciones y evita usarla para nuevas escrituras
después del cambio a Aiven.

## Comprobaciones locales sin base de datos

```powershell
npm run test:hosting
npm run build
```

`npm test` contiene pruebas funcionales que escriben datos y requieren una base
demo. No lo ejecutes contra Aiven de producción.

Referencias: [certificados TLS de Aiven](https://aiven.io/docs/platform/concepts/tls-ssl-certificates),
[respaldo MySQL en Aiven](https://aiven.io/docs/products/mysql/howto/migrate-database-mysqldump),
[variables de Vercel](https://vercel.com/docs/environment-variables),
[Vercel con GitHub](https://vercel.com/docs/git/vercel-for-github),
[pool de conexiones en Vercel](https://vercel.com/kb/guide/connection-pooling-with-functions).
