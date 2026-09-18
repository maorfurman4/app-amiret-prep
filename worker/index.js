// Remove responses saved by earlier versions, including any fallback cache.
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(names.map(async name => {
    if (name === 'apis') return caches.delete(name);
    const cache = await caches.open(name);
    const requests = await cache.keys();
    await Promise.all(requests.filter(request => {
      const url = new URL(request.url);
      return (url.origin === self.location.origin && url.pathname.startsWith('/api/')) || url.hostname.endsWith('.supabase.co');
    }).map(request => cache.delete(request)));
  }))));
});
