<script lang="ts">
  // Carnet d'archives : toutes les opérations du mois choisi, filtres compte / catégorie (ou virements).
  // Toucher une ligne ouvre sa modification (et sa suppression, avec confirmation).
  import { ajouterMois, ecrituresLiees, filtrerCarnet, formaterMois, retrouverVirement, VIREMENTS } from '../lib/carnet';
  import { trierCategories, type Categorie } from '../lib/categories';
  import { trierComptes, type Compte } from '../lib/comptes';
  import { aujourdHui, formaterDate } from '../lib/dates';
  import { formaterMontant } from '../lib/montants';
  import type { OperationComplete } from '../lib/operations';

  let {
    comptes,
    categories,
    operations,
    onouvrir,
  }: {
    comptes: Compte[];
    categories: Categorie[];
    operations: OperationComplete[];
    onouvrir: (op: OperationComplete) => void;
  } = $props();

  let mois = $state(aujourdHui().slice(0, 7));
  let compteId = $state('');
  let categorieId = $state('');

  const liste = $derived(filtrerCarnet(operations, { mois, compteId, categorieId }));
  const nomCompte = $derived(new Map(comptes.map((c) => [c.id, c.nom])));
  const nomCategorie = $derived(new Map(categories.map((c) => [c.id, c.nom])));
  const archive = (x: { nom: string; archive: boolean }) => x.nom + (x.archive ? ' (archivé)' : '');

  /** Libellé : la catégorie, ou pour un virement l'autre compte (« vers » sur le compte de départ, « depuis » sur l'arrivée). */
  function libelle(op: OperationComplete): string {
    // Tiers sans catégorie : dépôt (Crédit) ou retrait (Débit) avec l'extérieur.
    if (!op.virementId) return op.categorieId ? (nomCategorie.get(op.categorieId) ?? 'Catégorie inconnue') : op.sens === 'credit' ? 'DÉPÔT' : 'RETRAIT';
    const v = retrouverVirement(ecrituresLiees(op, operations));
    if (!v) return 'VIREMENT (à vérifier)';
    return op.compteId === v.depuisId ? `VIREMENT vers ${nomCompte.get(v.versId)}` : `VIREMENT depuis ${nomCompte.get(v.depuisId)}`;
  }
</script>

<div class="ecran">
  <header class="entete"><h1>Carnet</h1></header>

  <div class="mois carte">
    <button type="button" class="fleche" aria-label="Mois précédent" onclick={() => (mois = ajouterMois(mois, -1))}>‹</button>
    <h2 aria-live="polite">{formaterMois(mois)}</h2>
    <button type="button" class="fleche" aria-label="Mois suivant" onclick={() => (mois = ajouterMois(mois, 1))}>›</button>
  </div>

  <div class="filtres">
    <label class="champ">
      <span>Compte</span>
      <select bind:value={compteId}>
        <option value="">Tous</option>
        {#each trierComptes(comptes) as c (c.id)}<option value={c.id}>{archive(c)}</option>{/each}
      </select>
    </label>
    <label class="champ">
      <span>Catégorie</span>
      <select bind:value={categorieId}>
        <option value="">Toutes</option>
        <option value={VIREMENTS}>Virements</option>
        {#each trierCategories(categories) as c (c.id)}<option value={c.id}>{archive(c)}</option>{/each}
      </select>
    </label>
  </div>

  {#if liste.length === 0}
    <p class="secondaire vide">Aucune opération pour ce choix.</p>
  {:else}
    <ul aria-label="Opérations">
      {#each liste as op (op.id)}
        <li>
          <button type="button" class="ligne carte" onclick={() => onouvrir(op)}>
            <span class="date secondaire">{formaterDate(op.date).slice(0, 5)}</span>
            <span class="texte">
              <span class="libelle">{libelle(op)}</span>
              <span class="detail secondaire">{nomCompte.get(op.compteId) ?? '?'}{op.note ? ` · ${op.note}` : ''}</span>
            </span>
            <span class="montant {op.sens}">
              {formaterMontant(op.montant)}
              <small>{op.sens === 'debit' ? 'Débit' : 'Crédit'}</small>
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .mois {
    display: grid;
    grid-template-columns: 48px 1fr 48px;
    align-items: center;
    margin-bottom: 12px;
    padding: 4px;
  }

  .mois h2 {
    margin: 0;
    font-size: 1.0625rem;
    font-weight: 600;
    text-align: center;
  }

  .fleche {
    min-height: 44px;
    border: 0;
    background: transparent;
    color: var(--accent);
    font-size: 1.5rem;
  }

  .filtres {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 16px;
  }

  .filtres select {
    width: 100%;
    min-height: 44px;
    padding: 0 10px;
    border: 1px solid rgb(242 232 218 / 0.1);
    border-radius: 12px;
    background: var(--surface-1);
  }

  .vide {
    margin: 24px 4px;
    text-align: center;
  }

  ul {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .ligne {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 56px;
    padding: 10px 14px;
    border: 0;
    text-align: left;
  }

  .date {
    font-size: 0.875rem;
  }

  .texte {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .libelle {
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .detail {
    font-size: 0.8125rem;
    overflow-wrap: anywhere;
  }

  .montant {
    display: grid;
    justify-items: end;
    font-size: 1rem;
    font-weight: 600;
  }

  .montant small {
    font-size: 0.6875rem;
    font-weight: 500;
  }

  .debit {
    color: var(--debit);
  }

  .credit {
    color: var(--credit);
  }
</style>
