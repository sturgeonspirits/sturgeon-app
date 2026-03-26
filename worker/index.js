// Custom service worker additions — merged by next-pwa into sw.js
// Handles push notifications and notification clicks

self.addEventListener('push', function (event) {
  if (!event.data) return
  const data = event.data.json()
  const title   = data.title   || 'Sturgeon Spirits'
  const options = {
    body:    data.body    || '',
    icon:    '/logo-icon.png',
    badge:   '/logo-icon.png',
    tag:     data.tag     || 'sturgeon-default',
    renotify: true,
    data:    { url: data.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
