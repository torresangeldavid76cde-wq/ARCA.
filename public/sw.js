self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
// No se almacenan respuestas de la API ni datos personales en caché.
self.addEventListener('fetch',()=>{});
