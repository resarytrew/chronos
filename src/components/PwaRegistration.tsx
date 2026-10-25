"use client";
import { useEffect, useState } from 'react';

export default function PwaRegistration({ active }: { active: boolean }) {
  const [ready, setReady] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!('serviceWorker' in navigator)) { setError(true); return; }
    const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
    let mounted = true;
    const check = (r: ServiceWorkerRegistration) => {
      if (!mounted) return;
      setWaiting(Boolean(r.waiting));
      if (r.active?.state === 'activated') {
        const channel = new MessageChannel();
        channel.port1.onmessage = e => { if (mounted) setReady(e.data.ready === true); channel.port1.close(); };
        r.active.postMessage('STATUS', [channel.port2]);
      }
    };
    void navigator.serviceWorker.register(base + '/sw.js', { scope: base + '/', updateViaCache: 'none' }).then(r => {
      if (!mounted) return;
      setRegistration(r); check(r);
      r.addEventListener('updatefound', () => r.installing?.addEventListener('statechange', () => check(r)));
      void navigator.serviceWorker.ready.then(() => check(r));
    }).catch(() => setError(true));
    return () => { mounted = false; };
  }, []);
  if (active) return null;
  return <div className="mx-auto max-w-[1100px] px-5 pb-4 text-sm text-mute" role="status">
    {ready ? 'Готово к работе без интернета' : error ? 'Не удалось подготовить офлайн-режим. Проверьте подключение и обновите страницу.' : 'Подготовка к работе без интернета…'}
    {waiting && <button className="btn ml-3" onClick={() => { navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true }); registration?.waiting?.postMessage('ACTIVATE'); }}>Установить обновление</button>}
  </div>;
}
