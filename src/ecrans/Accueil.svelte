<script lang="ts">
  // Accueil : soldes du jour par type, sous-total par type, pas de total général.
  import Logo from '../composants/Logo.svelte';
  import { afficherSolde, LIBELLES, TYPES, trierComptes, type Compte } from '../lib/comptes';
  import { aujourdHui } from '../lib/dates';
  import { calculerSolde, type Operation } from '../lib/soldes';

  let {
    comptes,
    operations,
    onouvrir,
    oncreer,
  }: { comptes: Compte[]; operations: Operation[]; onouvrir: (id: string) => void; oncreer: () => void } = $props();

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
              <span class="solde" class:negatif={negatif(c.type, c.solde)}>{montant(c.type, c.solde)}</span>
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
