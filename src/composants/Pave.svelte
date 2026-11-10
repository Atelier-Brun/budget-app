<script lang="ts">
  // Pavé numérique intégré (indépendant du clavier iOS) : montant (Saisie) ou code (verrouillage).
  let { ontouche, desactive = false }: { ontouche: (t: string) => void; desactive?: boolean } = $props();
  const CHIFFRES = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
</script>

<div class="pave" role="group" aria-label="Pavé numérique">
  {#each CHIFFRES as c (c)}
    <button type="button" class="touche" disabled={desactive} onclick={() => ontouche(c)}>{c}</button>
  {/each}
  <span aria-hidden="true"></span>
  <button type="button" class="touche" disabled={desactive} onclick={() => ontouche('0')}>0</button>
  <button type="button" class="touche effacer" aria-label="Effacer" disabled={desactive} onclick={() => ontouche('effacer')}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h11v14H9l-6-7zM12.5 9.5l5 5M17.5 9.5l-5 5" /></svg>
  </button>
</div>

<style>
  .pave {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .touche {
    min-height: 52px;
    border: 0;
    border-radius: 14px;
    background: linear-gradient(180deg, var(--surface-2), var(--surface-1));
    box-shadow: 0 1px 0 rgb(242 232 218 / 0.06) inset, 0 2px 6px rgb(0 0 0 / 0.4);
    font-size: 1.5rem;
    font-weight: 500;
    touch-action: manipulation; /* pas de zoom au double toucher : frappe rapide */
  }

  .touche:active {
    background: var(--surface-1);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.5) inset;
  }

  .touche:disabled {
    opacity: 0.4;
  }

  .effacer {
    display: grid;
    place-items: center;
    background: transparent;
    box-shadow: none;
    color: var(--texte-2);
  }

  svg {
    width: 26px;
    height: 26px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
