<script lang="ts">
  // Échéancier : échéances en cours (par date de la prochaine), puis arrêtées ou terminées.
  import type { Compte } from '../lib/comptes';
  import { formaterDate } from '../lib/dates';
  import { prochaine, type Echeance } from '../lib/echeances';
  import { formaterMontant } from '../lib/montants';

  let { echeances, comptes, onouvrir, oncreer, onretour }: { echeances: Echeance[]; comptes: Compte[]; onouvrir: (id: string) => void; oncreer: () => void; onretour: () => void } =
    $props();

  const nomCompte = (id: string) => comptes.find((c) => c.id === id)?.nom ?? '';
  const enCours = $derived(
    echeances
      .map((e) => ({ e, p: prochaine(e) }))
      .filter((x) => x.p)
      .sort((a, b) => (a.p!.date < b.p!.date ? -1 : a.p!.date > b.p!.date ? 1 : a.e.nom.localeCompare(b.e.nom))),
  );
  const finies = $derived(echeances.filter((e) => !prochaine(e)).sort((a, b) => a.nom.localeCompare(b.nom)));
</script>

<div class="ecran">
  <header class="entete">
    <button type="button" class="retour" onclick={onretour}>‹ Réglages</button>
  </header>
  <div class="titre">
    <h1>Échéancier</h1>
    <button type="button" class="bouton" onclick={oncreer}>Nouvelle échéance</button>
  </div>
  <p class="secondaire explication">
    Prélèvements et mensualités. Chaque échéance est proposée le jour prévu et n’entre dans le solde qu’une fois validée.
  </p>

  {#if enCours.length}
    <ul class="carte liste">
      {#each enCours as { e, p } (e.id)}
        <li>
          <button type="button" class="ligne" onclick={() => onouvrir(e.id)}>
            <span class="texte">
              <span>{e.nom}</span>
              <span class="secondaire detail">{nomCompte(e.compteId)} · prochaine le {formaterDate(p!.date)}</span>
            </span>
            <span class={e.sens}>{formaterMontant(e.sens === 'credit' ? p!.montant : -p!.montant, true)}</span>
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="secondaire">Aucune échéance en cours.</p>
  {/if}

  {#if finies.length}
    <details>
      <summary class="secondaire">Arrêtées ou terminées ({finies.length})</summary>
      <ul class="carte liste">
        {#each finies as e (e.id)}
          <li>
            <button type="button" class="ligne" onclick={() => onouvrir(e.id)}>
              <span>{e.nom}</span><span class="secondaire">{e.archive ? 'Arrêtée' : 'Terminée'} ›</span>
            </button>
          </li>
        {/each}
      </ul>
    </details>
  {/if}
</div>

<style>
  .titre {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  h1 {
    margin: 0;
    font-size: 1.375rem;
    font-weight: 600;
  }

  .explication {
    margin: 0 0 16px;
    font-size: 0.875rem;
  }

  .liste {
    margin: 0 0 16px;
    padding: 4px 0;
    list-style: none;
  }

  .ligne {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 56px;
    padding: 10px 16px;
    border: 0;
    background: transparent;
    text-align: left;
    font-variant-numeric: tabular-nums;
  }

  li + li .ligne {
    border-top: 1px solid rgb(242 232 218 / 0.06);
  }

  .texte {
    display: grid;
    gap: 2px;
  }

  .detail {
    font-size: 0.8125rem;
  }

  .debit {
    color: var(--debit);
  }

  .credit {
    color: var(--credit);
  }

  summary {
    min-height: 44px;
    display: flex;
    align-items: center;
    cursor: pointer;
  }
</style>
