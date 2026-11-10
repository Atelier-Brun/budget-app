<script lang="ts">
  // Saisie d'un code au pavé intégré (pas de clavier iOS) : points, indicateur de solidité facultatif.
  // Le code n'est jamais affiché, journalisé ni conservé : il est effacé dès qu'il est transmis.
  import { codeValide, CODE_MAX, CODE_MIN, solidite } from '../lib/coffre';
  import Pave from './Pave.svelte';

  let {
    titre,
    aide = '',
    erreur = '',
    avecSolidite = false,
    occupe = false,
    desactive = false,
    onvalider,
  }: {
    titre: string;
    aide?: string;
    erreur?: string;
    avecSolidite?: boolean;
    occupe?: boolean;
    desactive?: boolean;
    onvalider: (code: string) => void;
  } = $props();

  let code = $state('');
  const niveau = $derived(solidite(code));
  const LIBELLES = { faible: 'Faible : 8 chiffres ou plus conseillés', correct: 'Correct', solide: 'Solide' };
  const bloque = $derived(occupe || desactive);

  function toucher(t: string) {
    if (bloque) return;
    if (t === 'effacer') code = code.slice(0, -1);
    else if (code.length < CODE_MAX) code += t;
  }

  function valider() {
    if (bloque || !codeValide(code)) return;
    const c = code;
    code = '';
    onvalider(c);
  }

  // Clavier physique (ordinateur) : chiffres, effacement, Entrée.
  function clavier(e: KeyboardEvent) {
    if (/^[0-9]$/.test(e.key)) toucher(e.key);
    else if (e.key === 'Backspace') toucher('effacer');
    else if (e.key === 'Enter') valider();
  }
</script>

<svelte:window onkeydown={clavier} />

<div class="code">
  <h2>{titre}</h2>
  {#if aide}<p class="secondaire aide">{aide}</p>{/if}
  <p class="points" role="status" aria-label={`${code.length} chiffre(s) saisi(s)`}>
    {#each { length: Math.max(CODE_MIN, code.length) } as _, i (i)}
      <span class:plein={i < code.length}></span>
    {/each}
  </p>
  {#if avecSolidite && code.length > 0}
    <p class={`solidite ${niveau}`}>
      <span class="jauge" aria-hidden="true"><i></i><i></i><i></i></span>
      Solidité : {LIBELLES[niveau]}
    </p>
  {/if}
  {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}
  {#if occupe}<p class="secondaire" role="status">Vérification…</p>{/if}
  <Pave ontouche={toucher} desactive={bloque} />
  <button type="button" class="bouton valider" disabled={bloque || !codeValide(code)} onclick={valider}>Valider</button>
</div>

<style>
  .code {
    display: grid;
    gap: 12px;
    text-align: center;
  }

  h2 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
  }

  p {
    margin: 0;
  }

  .aide {
    font-size: 0.875rem;
  }

  .points {
    display: flex;
    justify-content: center;
    gap: 12px;
    min-height: 24px;
    align-items: center;
  }

  .points span {
    width: 13px;
    height: 13px;
    border: 1.5px solid var(--texte-2);
    border-radius: 50%;
    transition: transform 120ms ease-out;
  }

  .points .plein {
    border-color: var(--accent);
    background: var(--accent);
    transform: scale(1.08);
  }

  .solidite {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    font-size: 0.875rem;
  }

  .jauge {
    display: flex;
    gap: 3px;
  }

  .jauge i {
    width: 18px;
    height: 5px;
    border-radius: 3px;
    background: var(--surface-2);
  }

  .faible .jauge i:nth-child(1) {
    background: var(--debit);
  }

  .correct .jauge i:nth-child(-n + 2) {
    background: var(--accent);
  }

  .solide .jauge i {
    background: var(--credit);
  }

  .valider {
    width: 100%;
  }

  .valider:disabled {
    opacity: 0.45;
  }
</style>
