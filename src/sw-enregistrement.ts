// Enregistre le service worker et signale une nouvelle version, activée seulement sur action de l'utilisateur.
export function enregistrerSW(surNouvelleVersion: (activer: () => void) => void): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const base = import.meta.env.BASE_URL;
  let rechargerApresActivation = false;

  // Au tout premier chargement, clients.claim() déclenche aussi cet événement : pas de rechargement alors.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (rechargerApresActivation) location.reload();
  });

  void navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).then((reg) => {
    const proposer = (sw: ServiceWorker): void =>
      surNouvelleVersion(() => {
        rechargerApresActivation = true;
        sw.postMessage('ACTIVER');
      });
    // Mise à jour seulement s'il existe déjà une version active de CE service worker.
    // (La page démo peut être contrôlée au début par celui de l'app : ce n'est pas une mise à jour.)
    if (reg.waiting && reg.active) proposer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      sw?.addEventListener('statechange', () => {
        if (sw.state === 'installed' && reg.active) proposer(sw);
      });
    });
    // Sur iPhone, l'app reste ouverte longtemps : on vérifie les mises à jour à chaque retour au premier plan.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => undefined);
    });
  });
}
