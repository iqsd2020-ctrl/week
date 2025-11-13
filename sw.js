const CACHE_NAME = 'liwa-huda-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Tajawal:wght@400;500;700&display=swap',
  'https://i.imgur.com/Ra9c5H4.png'
];

// --- 1. تثبيت Service Worker وتخزين الملفات الثابتة ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('تم فتح التخزين المؤقت (Cache)');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting(); // تفعيل التحديث فوراً
});

// --- 2. تفعيل Service Worker وحذف الكاش القديم عند التحديث ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('حذف التخزين القديم:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// --- 3. التعامل مع طلبات الشبكة (Fetch Strategy) ---
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // أ: استثناء طلبات Firebase API من الكاش (مهم جداً لعمل قاعدة البيانات)
  if (requestUrl.hostname.includes('firestore.googleapis.com') || 
      requestUrl.hostname.includes('googleapis.com') ||
      requestUrl.pathname.includes('/api/')) {
    return; // اترك المتصفح يتعامل معها مباشرة
  }

  // ب: استراتيجية (Cache First, falling back to Network)
  // ابحث في الكاش أولاً، إذا لم تجد، اطلب من الإنترنت واحفظ نسخة
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        // تحقق من صحة الاستجابة قبل تخزينها
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
          return networkResponse;
        }

        // نسخ الاستجابة لتخزينها (لأن الاستجابة تُقرأ مرة واحدة فقط)
        const responseToCache = networkResponse.clone();

        caches.open(CACHE_NAME).then((cache) => {
          // لا تقم بتخزين ملفات الصوت الكبيرة جداً إذا أردت توفير المساحة
          // ولكن هنا سنخزنها لتعمل بدون نت
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // (اختياري) صفحة بديلة عند انقطاع النت تماماً وعدم وجود كاش
        // return caches.match('./offline.html');
      });
    })
  );
});