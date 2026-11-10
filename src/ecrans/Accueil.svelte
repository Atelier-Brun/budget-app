<script lang="ts">
  // Accueil : échéances à valider, rappel de pointage, alertes du prévisionnel, soldes du jour par type,
  // sous-total par type (pas de total général), fin de mois prévue par compte.
  import Logo from '../composants/Logo.svelte';
  import { afficherSolde, LIBELLES, TYPES, trierComptes, type Compte } from '../lib/comptes';
  import { aujourdHui, formaterDate } from '../lib/dates';
  import type { Prevision } from '../lib/previsionnel';
  import { calculerSolde, type Operation } from '../lib/soldes';

  let {
    comptes,
    operations,
    previsions,
    nbAValider,
    pointage,
    onouvrir,
    oncreer,
    onavalider,
    onpointage,
  }: {
    comptes: Compte[];
    operations: Operation[];
    previsions: Map<string, Prevision>;
    nbAValider: number;
    /** Rappel de pointage à afficher. */
    pointage: boolean;
    onouvrir: (id: string) => void;
    oncreer: () => void;
    onavalider: () => void;
    onpointage: () => void;
  } = $props();

  const alertes = $derived(
    comptes.filter((c) => previsions.get(c.id)?.alerte).map((c) => ({ c, p: previsions.get(c.id)! })),
  );

  const sections = $derived.by(() => {
    const jour = aujourdHui();
    const actifs = trierComptes(comptes.filter((c) => !c.archive)).map((c) => ({ ...c, solde: calculerSolde(c, operations, jour) }));
    return TYPES.map((type) => {
      const liste = actifs.filter((c) => c.type === type);
      return { type, liste, total: liste.reduce((s, c) => s + c.solde, 0) };
    }).filter((s) => s.liste.length > 0);
  });

  // Tiers : le signe porte le sens (+ je lui dois, − il me doit), pas de couleur « bonne » ou « mauvaise ».
  const montant = (type: Compte['type'], solde: number) => afficherSolde(type, solde).texte;
  const negatif = (type: Compte['type'], solde: number) => afficherSolde(type, solde).negatif;
</script>

<div class="ecran">
  <header class="entete">
    <Logo taille={32} />
    <h1 class="marque">BUDGET</h1>
  </header>

  {#if nbAValider > 0}
    <button type="button" class="bandeau-action carte" onclick={onavalider}>
      <span><span class="point" aria-hidden="true"></span>{nbAValider} échéance{nbAValider > 1 ? 's' : ''} à valider</span><span aria-hidden="true">›</span>
    </button>
  {/if}
  {#if pointage && sections.length > 0}
    <button type="button" class="bandeau-action carte" onclick={onpointage}>
      <span>Pointage de la semaine à faire</span><span aria-hidden="true">›</span>
    </button>
  {/if}
  {#each alertes as { c, p } (c.id)}
    <p class="alerte-prevision carte" role="alert">
      {c.nom} : solde prévu négatif le {formaterDate(p.dateMin)} ({montant(c.type, p.min)})
    </p>
  {/each}

  {#if sections.length === 0}
    <div class="vide carte">
      <p>Aucun compte actif. Le premier compte courant créé devient le compte principal.</p>
      <button type="button" class="bouton" onclick={oncreer}>Créer un compte</button>
    </div>
  {/if}

  {#each sections as s (s.type)}
    <section aria-labelledby="titre-{s.type}">
      <div class="titre-section">
        <h2 id="titre-{s.type}">{LIBELLES[s.type].section}</h2>
        <span class="total" class:negatif={negatif(s.type, s.total)}>{montant(s.type, s.total)}</span>
      </div>
      <ul>
        {#each s.liste as c (c.id)}
          <li>
            <button type="button" class="compte carte" onclick={() => onouvrir(c.id)}>
              <span class="nom">{c.nom}{#if c.principal}<span class="badge">Principal</span>{/if}</span>
              <span class="droite">
                <span class="solde" class:negatif={negatif(c.type, c.solde)}>{montant(c.type, c.solde)}</span>
                {#if previsions.get(c.id) && previsions.get(c.id)!.fin !== c.solde}
                  <span class="prevu secondaire">fin de mois : {montant(c.type, previsions.get(c.id)!.fin)}</span>
                {/if}
              </span>
            </button>
          </li>
        {/each}
      </ul>
      {#if s.type === 'tiers'}
        <p class="legende secondaire">Solde positif : somme due au tiers · Solde négatif : somme due par le tiers</p>
      {/if}
    </section>
  {/each}
</div>

<style>
  .bandeau-action {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    min-height: 52px;
    margin-bottom: 12px;
    padding: 0 16px;
    border: 0;
    text-align: left;
    font-weight: 600;
  }

  .point {
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-right: 10px;
    border-radius: 50%;
    background: var(--accent);
    vertical-align: middle;
  }

  .alerte-prevision {
    margin: 0 0 12px;
    padding: 12px 16px;
    color: var(--debit);
    font-size: 0.9375rem;
  }

  .droite {
    display: grid;
    justify-items: end;
    gap: 2px;
  }

  .prevu {
    font-size: 0.75rem;
  }

  .marque {
    letter-spacing: 0.24em;
  }

  .vide {
    display: grid;
    gap: 16px;
    padding: 24px 20px;
    text-align: center;
  }

  .vide p {
    margin: 0;
  }

  section {
    margin-bottom: 24px;
  }

  .titre-section {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin: 0 4px 8px;
    color: var(--texte-2);
  }

  h2 {
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  /* Même taille et couleur que les soldes, demi-gras pour signaler un total. */
  .total {
    color: var(--texte);
    font-size: 1.0625rem;
    font-weight: 600;
  }

  ul {
    display: grid;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .compte {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 60px;
    padding: 12px 16px;
    border: 0;
    text-align: left;
  }

  .nom {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .badge {
    padding: 2px 6px;
    border-radius: 6px;
    background: rgb(200 169 126 / 0.16);
    color: var(--accent);
    font-size: 0.6875rem;
    font-weight: 500;
  }

  .solde {
    flex: none;
    font-size: 1.0625rem;
  }

  .negatif {
    color: var(--debit);
  }

  .legende {
    margin: 8px 4px 0;
    font-size: 0.8125rem;
  }
</style>
