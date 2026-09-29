/* Service worker do Escritório Worklash.
 *
 * Faz UMA coisa só: receber notificação push e abrir o app no lugar certo
 * quando a pessoa toca nela.
 *
 * De propósito NÃO guarda página nenhuma em cache. Cache de app já causou
 * confusão aqui antes (o Safari servia a versão velha por horas). Se um dia
 * for preciso funcionar sem internet, isso entra como decisão separada.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (evento) => {
  let dados = { titulo: "Escritório Worklash", descricao: "", link: "/" };
  try {
    if (evento.data) dados = { ...dados, ...evento.data.json() };
  } catch {
    if (evento.data) dados.descricao = evento.data.text();
  }

  evento.waitUntil(
    self.registration.showNotification(dados.titulo, {
      body: dados.descricao,
      icon: "/icone-192.png",
      badge: "/icone-192.png",
      data: { link: dados.link || "/" },
      // agrupa pelo link: aviso novo do mesmo assunto substitui o anterior
      tag: dados.link || "geral",
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.link) || "/";

  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      // se o app já estiver aberto, aproveita a janela em vez de abrir outra
      for (const j of janelas) {
        if (j.url.includes(self.location.origin)) {
          j.navigate(destino);
          return j.focus();
        }
      }
      return self.clients.openWindow(destino);
    })
  );
});
