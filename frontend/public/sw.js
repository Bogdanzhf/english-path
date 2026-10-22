// Офлайн-кеш: страницы и данные курса — «сначала сеть», картинки и озвучка — «сначала кеш».
const CACHE = 'english-path-v3'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')) return
  // Safari (iPhone/iPad) запрашивает аудио кусками (Range) и ждёт ответ 206 — отдаём нужный кусок
  if (req.headers.has('range')) {
    e.respondWith(rangeResponse(req))
    return
  }
  const media = /\/(audio|img|icons|assets)\//.test(url.pathname)
  if (media) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then((c) => c.put(req, copy))
            }
            return res
          }),
      ),
    )
  } else {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./'))),
    )
  }
})

async function rangeResponse(req) {
  try {
    const cache = await caches.open(CACHE)
    let res = await cache.match(req.url)
    if (!res) {
      res = await fetch(req.url)
      if (res.status !== 200) return fetch(req)
      cache.put(req.url, res.clone())
    }
    const buf = await res.arrayBuffer()
    const size = buf.byteLength
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '')
    let start = m && m[1] ? Number(m[1]) : 0
    let end = m && m[2] ? Number(m[2]) : size - 1
    if (m && !m[1] && m[2]) {
      start = Math.max(0, size - Number(m[2]))
      end = size - 1
    }
    end = Math.min(end, size - 1)
    return new Response(buf.slice(start, end + 1), {
      status: 206,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg',
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': String(end - start + 1),
        'Accept-Ranges': 'bytes',
      },
    })
  } catch {
    return fetch(req)
  }
}
