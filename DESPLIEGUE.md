# Publicación de ARCA

ARCA necesita un servicio Node y MySQL persistente. El Dockerfile compila React
y sirve la interfaz y la API desde el mismo dominio. No incluye archivos `.env`,
cuentas demo ni la base local en la imagen.

## Railway

1. Crear un proyecto con un servicio MySQL y un servicio desde este repositorio.
2. Configurar las variables del servicio ARCA:

| Variable | Valor |
| --- | --- |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `TRUST_PROXY_HOPS` | `1`, para el proxy de entrada de Railway |
| `DB_HOST` | `${{MySQL.MYSQLHOST}}` |
| `DB_PORT` | `${{MySQL.MYSQLPORT}}` |
| `DB_NAME` | `${{MySQL.MYSQLDATABASE}}` |
| `DB_USER` | Usuario de aplicación creado en la base alojada |
| `DB_PASSWORD` | Contraseña privada de ese usuario |

Las referencias suponen que el servicio se llama `MySQL`. Railway proporciona
`PORT`; no es necesario fijarlo. No reutilizar las credenciales locales.
El usuario de aplicación solo necesita SELECT, INSERT, UPDATE y DELETE sobre
la base importada; usar las credenciales administrativas únicamente para importar.

3. Importar una copia consistente de los registros locales en la base nueva,
   sin sobreescribir una base que ya tenga datos. Usar el nombre asignado por
   Railway: los SQL locales de inicialización fijan `arc` y no deben ejecutarse
   sin adaptar en otro nombre de base.
4. Antes de habilitar el dominio, revocar las sesiones importadas y cambiar las
   contraseñas de las cuentas expuestas en `CUENTAS-DEMO.txt`, conservando sus
   usuarios, roles y registros. Entregar las nuevas claves por un canal privado
   y exigir su cambio al ingresar. No ejecutar `npm run db:init`: genera demos.
5. Comparar los conteos de las tablas y verificar acceso, permisos y guardado.
6. Desplegar y generar el dominio HTTPS del servicio ARCA. `railway.json`
   comprueba `/api/health`, que verifica la conexión MySQL.

No publicar respaldos SQL con datos en GitHub. Guardarlos bajo `runtime/`, que
está ignorado por Git y Docker. Mantener la copia local hasta validar el traslado.

## Credenciales del historial

El primer commit público incluía `CUENTAS-DEMO.txt` y una contraseña en
`.env.example`. Excluir esos valores de los commits nuevos no borra el historial.
No usar esas contraseñas en internet. Si se reutilizaron en otro servicio, deben
cambiarse también allí. No se ha reescrito el historial remoto.

## Comprobación local de estos cambios

Con las dependencias ya instaladas:

```text
node --test tests/hosting.test.js tests/login-rate-limit.test.js
node node_modules/vite/bin/vite.js build
```

Las pruebas de hosting no modifican la base de datos. El despliegue Docker y la
migración deben verificarse en el alojamiento antes de considerarlo publicado.

Referencias: [MySQL en Railway](https://docs.railway.com/databases/mysql),
[configuración del despliegue](https://docs.railway.com/config-as-code/reference).
