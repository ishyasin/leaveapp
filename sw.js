/* ED&G Echo(TM) - browser notifications when the portal is closed.
   Receives a push from the echo-push edge function and shows a notification.
   The notification names the sender only; the message text is never sent. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) {}
  event.waitUntil((async () => {
    // If the portal is open and in front, its own pop-up window already shows the message.
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (wins.some((c) => c.visibilityState === "visible" && c.focused)) return;
    await self.registration.showNotification(d.title || "ED&G Echo™", {
      body: d.body || "You have a new message",
      tag: d.conv || "echo",
      renotify: true,
      icon: "bee.png",
      badge: "bee.png",
      data: { conv: d.conv || null },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const conv = (event.notification.data || {}).conv;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (wins.length) {
      const w = wins.find((c) => c.visibilityState === "visible") || wins[0];
      try { await w.focus(); } catch (e) {}
      w.postMessage({ type: "echo-open", conv });
      return;
    }
    await self.clients.openWindow(new URL("chat.html" + (conv ? "?open=" + encodeURIComponent(conv) : ""), self.registration.scope).href);
  })());
});
