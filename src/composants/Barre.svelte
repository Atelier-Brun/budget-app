<script lang="ts">
  // Barre de navigation du bas : Accueil, « + » (saisie rapide, morceau 3 de 1e), Réglages. Icônes en SVG.
  type Onglet = 'accueil' | 'reglages';
  let { actif, onaller, onplus }: { actif: Onglet; onaller: (o: Onglet) => void; onplus: (() => void) | null } = $props();
</script>

<nav aria-label="Navigation principale">
  <button type="button" class="onglet" aria-current={actif === 'accueil' ? 'page' : undefined} onclick={() => onaller('accueil')}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11 12 4l8 7v9h-5.5v-6h-5v6H4z" /></svg>
    <span>Accueil</span>
  </button>
  <button type="button" class="plus" aria-label="Saisir une opération" disabled={!onplus} onclick={() => onplus?.()}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
  </button>
  <button type="button" class="onglet" aria-current={actif === 'reglages' ? 'page' : undefined} onclick={() => onaller('reglages')}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></svg>
    <span>Réglages</span>
  </button>
</nav>

<style>
  nav {
    position: fixed;
    inset: auto 0 0;
    z-index: 2;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    height: var(--barre);
    padding: 0 24px env(safe-area-inset-bottom);
    background: linear-gradient(180deg, rgb(42 33 26 / 0.94), rgb(26 20 16 / 0.98));
    box-shadow: 0 -1px 0 rgb(242 232 218 / 0.06), 0 -8px 24px rgb(0 0 0 / 0.35);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
  }

  svg {
    width: 24px;
    height: 24px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .onglet {
    display: grid;
    justify-items: center;
    gap: 2px;
    min-height: 48px;
    border: 0;
    background: transparent;
    color: var(--texte-2);
    font-size: 0.75rem;
  }

  .onglet[aria-current='page'] {
    color: var(--accent);
  }

  .plus {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    margin-top: -18px;
    border: 0;
    border-radius: 50%;
    background: linear-gradient(180deg, #d6b98f, var(--accent));
    box-shadow: 0 1px 0 rgb(255 255 255 / 0.3) inset, 0 6px 16px rgb(0 0 0 / 0.5);
    color: var(--fond);
  }

  .plus svg {
    width: 28px;
    height: 28px;
    stroke-width: 2.4;
  }

  .plus:disabled {
    opacity: 0.45;
  }
</style>
