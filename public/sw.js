// Private events and API responses are never cached on the device.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{if(e.request.mode==='navigate')e.respondWith(fetch(e.request).catch(()=>new Response('<html lang="pt-BR"><meta name="viewport" content="width=device-width"><title>Órbita • Sem conexão</title><body style="font:18px system-ui;padding:48px;background:#faf9f6"><h1>Você está sem conexão</h1><p>Conecte-se à internet para acessar sua agenda sincronizada.</p><button onclick="location.reload()">Tentar novamente</button></body></html>',{headers:{'Content-Type':'text/html; charset=utf-8'}})))});
