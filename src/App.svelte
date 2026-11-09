<script lang="ts">
  // Coquille (1b) : écrans réels en 1e.
  import { onMount } from 'svelte';
  import { enregistrerSW } from './sw-enregistrement';

  const version: string = __APP_VERSION__;
  const demo: boolean = __DEMO__;
  let activer = $state<(() => void) | null>(null);

  onMount(() => enregistrerSW((f) => (activer = f)));
</script>

{#if demo}
  <div class="demo" role="note">DÉMO – données fictives</div>
{/if}

<main>
  <div class="monogramme" aria-hidden="true">B</div>
  <h1>BUDGET</h1>
  <p class="version">Version {version}</p>
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

  .monogramme {
    display: grid;
    place-items: center;
    width: 112px;
    height: 112px;
    margin-bottom: 18px;
    border-radius: 28px;
    background: linear-gradient(180deg, var(--surface-2), var(--surface-1));
    box-shadow: var(--ombre);
    color: var(--accent);
    font-family: ui-serif, 'New York', Georgia, serif;
    font-size: 72px;
    font-weight: 700;
    text-shadow: 0 2px 3px rgb(0 0 0 / 0.5);
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
