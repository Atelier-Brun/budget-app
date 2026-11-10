<script lang="ts">
  // Échéances dues (le jour J, retards compris) : vérifier, modifier montant ou date si besoin, puis valider
  // (l'opération entre dans le carnet et le solde une seule fois) ou ignorer (échéance qui n'a pas eu lieu).
  import type { Compte } from '../lib/comptes';
  import { aujourdHui, estDateValide, formaterDate } from '../lib/dates';
  import { aValider, type Echeance, type Occurrence } from '../lib/echeances';
  import { lireMontant } from '../lib/montants';

  let {
    echeances,
    comptes,
    onvalider,
    onignorer,
    onretour,
  }: {
    echeances: Echeance[];
    comptes: Compte[];
    /** Renvoie un message d'erreur, ou null si c'est enregistré. */
    onvalider: (e: Echeance, o: Occurrence, montant: number, date: string) => Promise<string | null>;
    onignorer: (e: Echeance, o: Occurrence) => Promise<boolean>;
    onretour: () => void;
  } = $props();

  const dues = $derived(
    echeances
      .map((e) => ({ e, o: aValider(e, aujourdHui()) }))
      .filter((x): x is { e: Echeance; o: Occurrence } => x.o !== null)
      .sort((a, b) => (a.o.date < b.o.date ? -1 : 1)),
  );
  const cle = (e: Echeance, o: Occurrence) => `${e.id}/${o.n}`;
  // Saisies en cours, par échéance due (montant et date modifiables avant validation).
  let montants = $state<Record<string, string>>({});
  let dates = $state<Record<string, string>>({});
  let erreurs = $state<Record<string, string>>({});
  let ignorer = $state<string | null>(null);
  let occupe = $state(false);

  const nomCompte = (id: string) => comptes.find((c) => c.id === id)?.nom ?? '';
  const texteMontant = (c: number) => (c / 100).toFixed(2).replace('.', ',');

  async function valider(e: Echeance, o: Occurrence) {
    const k = cle(e, o);
    const m = lireMontant(montants[k] ?? texteMontant(o.montant));
    const date = dates[k] ?? o.date;
    if (!m.ok) return void (erreurs[k] = m.erreur);
    if (!estDateValide(date)) return void (erreurs[k] = 'Date invalide.');
    occupe = true;
    erreurs[k] = (await onvalider(e, o, m.centimes, date)) ?? '';
    occupe = false;
  }
</script>

<div class="ecran">
  <header class="entete">
    <button type="button" class="retour" onclick={onretour}>‹ Accueil</button>
  </header>
  <h1 class="titre-fiche">À valider</h1>

  {#if dues.length === 0}
    <p class="secondaire">Aucune échéance à valider.</p>
  {/if}

  {#each dues as { e, o } (cle(e, o))}
    {@const k = cle(e, o)}
    <section class="carte bloc" aria-label={e.nom}>
      <div class="tete">
        <h2>{e.nom}</h2>
        <span class={e.sens}>{e.sens === 'credit' ? 'Crédit' : 'Débit'}</span>
      </div>
      <p class="secondaire">{nomCompte(e.compteId)} · prévue le {formaterDate(o.date)}</p>
      <div class="deux">
        <label class="champ">
          <span>Montant</span>
          <input
            value={montants[k] ?? texteMontant(o.montant)}
            oninput={(ev) => (montants[k] = ev.currentTarget.value)}
            inputmode="decimal"
            autocomplete="off"
          />
        </label>
        <label class="champ">
          <span>Date</span>
          <input type="date" value={dates[k] ?? o.date} oninput={(ev) => (dates[k] = ev.currentTarget.value)} />
        </label>
      </div>
      {#if erreurs[k]}<p class="erreur" role="alert">{erreurs[k]}</p>{/if}
      {#if ignorer === k}
        <p>Ignorer cette échéance ? Elle ne sera pas enregistrée et la suivante sera proposée à sa date.</p>
        <div class="boutons">
          <button type="button" class="bouton-discret" onclick={() => (ignorer = null)}>Annuler</button>
          <button type="button" class="bouton" disabled={occupe} onclick={async () => ((occupe = true), await onignorer(e, o), (occupe = false), (ignorer = null))}>Ignorer</button>
        </div>
      {:else}
        <div class="boutons">
          <button type="button" class="bouton-discret" onclick={() => (ignorer = k)}>Ignorer…</button>
          <button type="button" class="bouton" disabled={occupe} onclick={() => valider(e, o)}>Valider</button>
        </div>
      {/if}
    </section>
  {/each}
</div>

<style>
  .bloc {
    margin-bottom: 14px;
  }

  .tete {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
  }

  .deux {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .deux input {
    width: 100%;
    min-height: 48px;
    padding: 0 10px;
    border: 1px solid rgb(242 232 218 / 0.1);
    border-radius: 12px;
    background: var(--fond);
    font-family: inherit;
    letter-spacing: normal;
    font-variant-numeric: tabular-nums;
  }

  .debit {
    color: var(--debit);
  }

  .credit {
    color: var(--credit);
  }
</style>
