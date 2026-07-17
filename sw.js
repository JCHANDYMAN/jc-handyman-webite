const CACHE='jc-v25';const ASSETS=['./','index.html','app.html','portal.html','jc-handyman-logo.png','app-icon.png','manifest.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('fetch',e=>e.respondWith(fetch(e.request).catch(()=>caches.match(e.request))));
