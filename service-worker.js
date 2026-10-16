const CACHE_NAME = "ccs-vsn30-v1";

const APP_FILES = [
"./",
"./index.html",
"./style.css",
"./app.js",
"./manifest.json"
];

self.addEventListener("install", (event) => {
event.waitUntil(
caches.open(CACHE_NAME).then((cache) => {
return cache.addAll(APP_FILES);
})
);

self.skipWaiting();
});

self.addEventListener("activate", (event) => {
event.waitUntil(
caches.keys().then((keys) => {
return Promise.all(
keys
.filter((key) => key !== CACHE_NAME)
.map((key) => caches.delete(key))
);
})
);

self.clients.claim();
});

self.addEventListener("fetch", (event) => {
if (event.request.method !== "GET") return;

const url = new URL(event.request.url);

// Never cache Supabase requests or payment-related API traffic.
if (
url.hostname.includes("supabase.co") ||
url.pathname.includes("/functions/v1/")
) {
return;
}

event.respondWith(
fetch(event.request).catch(() => {
return caches.match(event.request);
})
);
});