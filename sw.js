/* Offline-Speicher für die App. Bei jeder neuen Version VERSION hochzählen. */
const VERSION='hi-coaching-v31';
const CORE=['./','./index.html','./config.js','./sync.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png','./bergheim-logo.png'];
const EXTRA=['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js','https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'];
self.addEventListener('install',e=>{e.waitUntil((async()=>{const c=await caches.open(VERSION);await c.addAll(CORE);
  await Promise.all(EXTRA.map(u=>c.add(new Request(u,{mode:'cors'})).catch(()=>{})));self.skipWaiting();})());});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{const ks=await caches.keys();await Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k)));await self.clients.claim();})());});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
  if(u.hostname.endsWith('supabase.co')||u.hostname.endsWith('supabase.in'))return;
  const isPage=r.mode==='navigate'||(u.origin===location.origin&&(u.pathname.endsWith('/')||u.pathname.endsWith('.html')||u.pathname.endsWith('config.js')||u.pathname.endsWith('sync.js')));
  if(isPage){e.respondWith((async()=>{const c=await caches.open(VERSION);try{const res=await fetch(r);if(res.ok)c.put(r,res.clone());return res;}
    catch(_){return (await c.match(r,{ignoreSearch:true}))||(await c.match('./index.html'))||Response.error();}})());return;}
  e.respondWith((async()=>{const c=await caches.open(VERSION);const hit=await c.match(r);
    const net=fetch(r).then(res=>{if(res&&(res.ok||res.type==='opaque'))c.put(r,res.clone());return res;}).catch(()=>null);
    return hit||(await net)||Response.error();})());});
