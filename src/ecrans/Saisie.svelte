<script lang="ts">
  // Saisie rapide : montant au pavé → catégorie (règle le sens) → Valider. Compte principal et date du jour déjà remplis.
  import { untrack } from 'svelte';
  import Pave from '../composants/Pave.svelte';
  import { trierCategories, type Categorie } from '../lib/categories';
  import { trierComptes, type Compte } from '../lib/comptes';
  import { aujourdHui } from '../lib/dates';
  import { formaterMontant, taper } from '../lib/montants';
  import { NOTE_MAX, preparerOperation, type OperationComplete } from '../lib/operations';
  import type { Sens } from '../lib/soldes';

  let {
    comptes,
    categories,
    onvalider,
    onfermer,
    oncreercompte,
    oncreercategorie,
  }: {
    comptes: Compte[];
    categories: Categorie[];
    onvalider: (op: OperationComplete) => Promise<boolean>;
    onfermer: () => void;
    oncreercompte: () => void;
    oncreercategorie: () => void;
  } = $props();

  // Listes figées à l'ouverture du panneau.
  const { actifs, actives } = untrack(() => ({
    actifs: trierComptes(comptes.filter((c) => !c.archive)),
    actives: trierCategories(categories.filter((c) => !c.archive)),
  }));

  let compteId = $state(actifs.find((c) => c.principal)?.id ?? actifs[0]?.id ?? '');
  let categorieId = $state('');
  let montant = $state(0);
  let sens = $state<Sens>('debit');
  let date = $state(aujourdHui());
  let note = $state('');
  let erreur = $state('');
  let occupe = $state(false);

  /** Clavier physique (ordinateur, clavier Bluetooth) : chiffres et retour arrière, hors des champs texte. */
  function clavier(e: KeyboardEvent) {
    if (e.key === 'Escape') return onfermer();
    if ((e.target as HTMLElement).closest('input, select, textarea')) return;
    if (/^[0-9]$/.test(e.key)) montant = taper(montant, e.key);
    else if (e.key === 'Backspace') montant = taper(montant, 'effacer');
  }

  async function valider(e: SubmitEvent) {
    e.preventDefault();
    const compte = actifs.find((c) => c.id === compteId);
    const r = preparerOperation({ compte, categorie: actives.find((c) => c.id === categorieId), montant, sens, date, note });
    if (!r.ok) {
      erreur = r.erreur;
      return;
    }
    erreur = '';
    occupe = true;
    await onvalider(r.operation);
    occupe = false;
  }
</script>

<svelte:window onkeydown={clavier} />

<div class="feuille" role="dialog" aria-modal="true" aria-labelledby="titre-saisie">
  <header class="haut">
    <button type="button" class="retour" onclick={onfermer}>Annuler</button>
    <h2 id="titre-saisie">Nouvelle opération</h2>
    <span></span>
  </header>

  {#if actifs.length === 0}
    <div class="carte vide">
      <p>Aucun compte actif. Un compte est nécessaire pour saisir une opération.</p>
      <button type="button" class="bouton" onclick={oncreercompte}>Créer un compte</button>
    </div>
  {:else if actives.length === 0}
    <div class="carte vide">
      <p>Aucune catégorie active. Une catégorie est nécessaire pour saisir une opération.</p>
      <button type="button" class="bouton" onclick={oncreercategorie}>Créer une catégorie</button>
    </div>
  {:else}
    <form class="formulaire" onsubmit={valider} novalidate>
      <output class="montant" class:vide={montant === 0} aria-label="Montant" aria-live="polite">{formaterMontant(montant)}</output>
      <Pave bind:montant />

      <fieldset class="champ">
        <legend>Sens</legend>
        <div class="segments">
          <label class="segment"><input type="radio" name="sens" value="debit" bind:group={sens} />Débit</label>
          <label class="segment"><input type="radio" name="sens" value="credit" bind:group={sens} />Crédit</label>
        </div>
      </fieldset>

      <fieldset class="champ">
        <legend>Catégorie</legend>
        <div class="pastilles">
          {#each actives as c (c.id)}
            <label class="pastille">
              <input type="radio" name="categorie" value={c.id} bind:group={categorieId} onchange={() => (sens = c.sens)} />{c.nom}
            </label>
          {/each}
        </div>
      </fieldset>

      <label class="champ">
        <span>Compte</span>
        <select bind:value={compteId}>
          {#each actifs as c (c.id)}<option value={c.id}>{c.nom}</option>{/each}
        </select>
      </label>
      <label class="champ">
        <span>Date</span>
        <input type="date" bind:value={date} required />
      </label>
      <label class="champ">
        <span>Note (facultative)</span>
        <input bind:value={note} maxlength={NOTE_MAX + 10} autocomplete="off" />
      </label>

      <!-- Toujours visible en bas : montant → catégorie → Valider, sans faire défiler. -->
      <div class="pied">
        {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}
        <button type="submit" class="bouton valider" disabled={occupe}>Valider</button>
      </div>
    </form>
  {/if}
</div>

<style>
  .feuille {
    position: fixed;
    inset: 0;
    z-index: 5;
    overflow-y: auto;
    padding: calc(env(safe-area-inset-top) + 8px) 16px calc(env(safe-area-inset-bottom) + 24px);
    background: var(--fond);
    animation: monter 200ms ease-out;
  }

  .haut {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    min-height: 44px;
    margin-bottom: 4px;
  }

  .haut .retour {
    justify-self: start;
    margin-left: -6px;
  }

  h2 {
    margin: 0;
    font-size: 1.0625rem;
    font-weight: 600;
  }

  .vide {
    display: grid;
    gap: 14px;
    padding: 20px;
    text-align: center;
  }

  .vide p {
    margin: 0;
  }

  .formulaire {
    max-width: 40rem;
    margin: 0 auto;
    padding: 0;
  }

  .montant {
    display: block;
    padding: 4px 0;
    font-size: 2.75rem;
    font-weight: 600;
    text-align: center;
  }

  .montant.vide {
    color: var(--texte-2);
  }

  .pastilles {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .pastille {
    position: relative;
    display: grid;
    place-items: center;
    min-height: 44px;
    padding: 0 14px;
    border-radius: 22px;
    background: linear-gradient(180deg, var(--surface-2), var(--surface-1));
    box-shadow: 0 1px 0 rgb(242 232 218 / 0.06) inset, 0 2px 6px rgb(0 0 0 / 0.4);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .pastille:has(input:checked) {
    background: linear-gradient(180deg, #d6b98f, var(--accent));
    color: var(--fond);
  }

  .pastille:has(input:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .pastille input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .pied {
    position: sticky;
    bottom: calc(-24px - env(safe-area-inset-bottom));
    display: grid;
    gap: 10px;
    margin: 0 -16px;
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
    background: linear-gradient(180deg, rgb(26 20 16 / 0), var(--fond) 30%);
  }

  .pied .erreur {
    margin: 0;
    text-align: center;
  }

  .valider {
    width: 100%;
    min-height: 56px;
    font-size: 1.0625rem;
  }

  @keyframes monter {
    from {
      opacity: 0.6;
      transform: translateY(24px);
    }
  }
</style>
