<script lang="ts">
  // Pointage : solde bancaire réel de chaque compte courant et épargne ; l'écart est corrigé en une touche
  // (une opération CORRECTION par compte concerné, toutes dans une seule transaction). Champ vide = pas de correction.
  import { untrack } from 'svelte';
  import { afficherSolde, lireSoldeDepart, trierComptes, type Compte } from '../lib/comptes';
  import { aujourdHui, formaterDate } from '../lib/dates';
  import { formaterMontant } from '../lib/montants';
  import { calculerSolde, type Operation } from '../lib/soldes';

  let {
    comptes,
    operations,
    dernier,
    onvalider,
    onretour,
  }: {
    comptes: Compte[];
    operations: Operation[];
    /** Date du dernier pointage, ou null. */
    dernier: string | null;
    /** Soldes réels saisis (centimes) par compte ; renvoie un message d'erreur, ou null si c'est enregistré. */
    onvalider: (reels: Map<string, number>) => Promise<string | null>;
    onretour: () => void;
  } = $props();

  const liste = $derived(
    trierComptes(comptes.filter((c) => !c.archive && c.type !== 'tiers')).map((c) => ({ c, app: calculerSolde(c, operations, aujourdHui()) })),
  );
  let saisies = $state<Record<string, string>>({});
  // Signe « + » choisi par défaut pour chaque compte (lu une fois à l'ouverture).
  let negatifs = $state<Record<string, boolean>>(untrack(() => Object.fromEntries(comptes.map((c) => [c.id, false]))));
  let erreur = $state('');
  let occupe = $state(false);

  /** Écart (centimes) pour un compte : null si rien saisi, ou message si la saisie est invalide. */
  function ecart(id: string, app: number): number | string | null {
    const s = (saisies[id] ?? '').trim();
    if (!s) return null;
    const l = lireSoldeDepart(s, negatifs[id] ?? false);
    return l.ok ? l.centimes - app : l.erreur;
  }

  async function valider() {
    erreur = '';
    const reels = new Map<string, number>();
    for (const { c, app } of liste) {
      const e = ecart(c.id, app);
      if (typeof e === 'string') return void (erreur = `${c.nom} : ${e}`);
      if (e !== null) reels.set(c.id, app + e);
    }
    occupe = true;
    erreur = (await onvalider(reels)) ?? '';
    occupe = false;
  }
</script>

<div class="ecran">
  <header class="entete">
    <button type="button" class="retour" onclick={onretour}>‹ Accueil</button>
  </header>
  <h1 class="titre-fiche">Pointage</h1>
  <p class="secondaire explication">
    Dernier pointage : {dernier ? `le ${formaterDate(dernier)}` : 'aucun'}. Saisissez le solde affiché par la banque ; un écart est corrigé
    par une opération CORRECTION datée d’aujourd’hui.
  </p>

  {#each liste as { c, app } (c.id)}
    {@const e = ecart(c.id, app)}
    <section class="carte bloc" aria-label={c.nom}>
      <div class="tete">
        <h2>{c.nom}</h2>
        <span class="secondaire">BAARA : {afficherSolde(c.type, app).texte}</span>
      </div>
      <div class="solde">
        <div class="segments signe">
          <label class="segment"><input type="radio" name={`signe-${c.id}`} value={false} bind:group={negatifs[c.id]} aria-label="Positif" />+</label>
          <label class="segment"><input type="radio" name={`signe-${c.id}`} value={true} bind:group={negatifs[c.id]} aria-label="Négatif" />−</label>
        </div>
        <input
          value={saisies[c.id] ?? ''}
          oninput={(ev) => (saisies[c.id] = ev.currentTarget.value)}
          inputmode="decimal"
          placeholder="Solde bancaire"
          aria-label={`Solde bancaire ${c.nom}`}
          autocomplete="off"
        />
      </div>
      {#if typeof e === 'number'}
        <p class:debit={e < 0} class:credit={e > 0}>{e === 0 ? 'Aucun écart.' : `Écart : ${formaterMontant(e, true)}`}</p>
      {/if}
    </section>
  {:else}
    <p class="secondaire">Aucun compte courant ou épargne actif.</p>
  {/each}

  {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}
  {#if liste.length}
    <button type="button" class="bouton action" disabled={occupe} onclick={valider}>Valider le pointage</button>
  {/if}
</div>

<style>
  .explication {
    margin: 0 0 16px;
    font-size: 0.875rem;
  }

  .bloc {
    margin-bottom: 14px;
  }

  .tete {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    font-variant-numeric: tabular-nums;
  }

  .solde {
    display: flex;
    gap: 10px;
  }

  .signe {
    flex: 0 0 104px;
  }

  .solde input:not([type='radio']) {
    flex: 1;
    min-width: 0;
    min-height: 48px;
    padding: 0 12px;
    border: 1px solid rgb(242 232 218 / 0.1);
    border-radius: 12px;
    background: var(--fond);
    font-variant-numeric: tabular-nums;
  }

  .debit {
    color: var(--debit);
  }

  .credit {
    color: var(--credit);
  }
</style>
