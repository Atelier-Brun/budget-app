<script lang="ts">
  // Coquille (1b) : écrans réels en 1e.
  import { onMount } from 'svelte';
  import { enregistrerSW } from './sw-enregistrement';
  import { demanderPersistance, ouvrirBase, traduire } from './lib/stockage';
  import { pointsLogo } from './lib/logo';

  const points = pointsLogo();

  const version: string = __APP_VERSION__;
  const demo: boolean = __DEMO__;
  let activer = $state<(() => void) | null>(null);
  let alerte = $state('');

  onMount(() => {
    enregistrerSW((f) => (activer = f));
    // Bases séparées : la démo ne lit ni n'écrit jamais la base réelle.
    // shortcut: connexion non conservée tant qu'aucun écran ne lit les données, à garder dès 1e.
    ouvrirBase(demo ? 'budget-demo' : 'budget', () => (alerte = 'BUDGET a été mis à jour dans une autre fenêtre : rechargez l’app.'))
      .then(() => demanderPersistance())
      .catch((e: unknown) => (alerte = traduire(e).message));
  });
</script>

{#if demo}
  <div class="demo" role="note">DÉMO – données fictives</div>
{/if}

<main>
  <!-- Logo dessiné en SVG (mêmes formes et couleurs que l'icône), aucune police. -->
  <svg class="logo" viewBox="0 0 100 100" aria-hidden="true">
    <defs>
      <linearGradient id="logo-fond" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#2E1B11" /><stop offset="1" stop-color="#1C0F09" />
      </linearGradient>
      <radialGradient id="logo-lueur" gradientUnits="userSpaceOnUse" cx="50" cy="0" r="60">
        <stop offset="0" stop-color="#5A3A24" stop-opacity="0.55" /><stop offset="1" stop-color="#5A3A24" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="logo-trait" gradientUnits="userSpaceOnUse" x1="25" y1="10" x2="75" y2="90">
        <stop offset="0" stop-color="#E9CFA3" /><stop offset="0.55" stop-color="#C8A97E" /><stop offset="1" stop-color="#8F6E45" />
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="22" fill="url(#logo-fond)" />
    <rect width="100" height="100" rx="22" fill="url(#logo-lueur)" />
    <polygon {points} fill="none" stroke="url(#logo-trait)" stroke-width="9" stroke-linejoin="round" />
  </svg>
  <h1>BUDGET</h1>
  <p class="version">Version {version}</p>
  {#if alerte}
    <p class="alerte" role="alert">{alerte}</p>
  {/if}
</main>

{#if activer}
  <div class="maj" role="status">
    <span>Nouvelle version disponible</span>
    <button type="button" onclick={activer}>Mettre à jour</button>
  </div>
{/if}

<style>
  .demo {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: calc(env(safe-area-inset-top) + 6px) 16px 6px;
    background: var(--accent);
    color: var(--fond);
    font-size: 0.8125rem;
    font-weight: 600;
    text-align: center;
  }

  main {
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 6px;
    flex: 1;
    padding: env(safe-area-inset-top) 24px env(safe-area-inset-bottom);
  }

  .logo {
    display: block;
    width: 112px;
    height: 112px;
    margin-bottom: 18px;
    border-radius: 22%; /* même arrondi que le rx 22 du dessin, pour que l'ombre suive la forme */
    box-shadow: var(--ombre);
  }

  h1 {
    margin: 0;
    font-size: 1.375rem;
    font-weight: 600;
    letter-spacing: 0.32em;
    padding-left: 0.32em; /* compense l'espacement après la dernière lettre */
  }

  .version {
    margin: 0;
    color: var(--texte-2);
    font-size: 0.8125rem;
  }

  .alerte {
    max-width: 22rem;
    margin: 16px 0 0;
    padding: 12px 16px;
    border-radius: 12px;
    background: var(--surface-1);
    box-shadow: var(--ombre);
    text-align: center;
  }

  .maj {
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: calc(env(safe-area-inset-bottom) + 12px);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 10px 10px 16px;
    border-radius: 16px;
    background: linear-gradient(180deg, var(--surface-2), var(--surface-1));
    box-shadow: var(--ombre);
    font-size: 0.9375rem;
    animation: entree 180ms ease-out;
  }

  .maj button {
    min-height: 44px;
    padding: 0 16px;
    border: 0;
    border-radius: 12px;
    background: var(--accent);
    color: var(--fond);
    font: inherit;
    font-weight: 600;
  }

  @keyframes entree {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
  }
</style>
