<script lang="ts">
  // Catégories : actives par ordre alphabétique avec leur sens par défaut, archivées repliées, création.
  import { trierCategories, type Categorie } from '../lib/categories';

  let {
    categories,
    onouvrir,
    oncreer,
    onretour,
  }: { categories: Categorie[]; onouvrir: (id: string) => void; oncreer: () => void; onretour: () => void } = $props();

  const actives = $derived(trierCategories(categories.filter((c) => !c.archive)));
  const archivees = $derived(trierCategories(categories.filter((c) => c.archive)));
</script>

{#snippet ligne(c: Categorie)}
  <li>
    <button type="button" class="ligne" onclick={() => onouvrir(c.id)}>
      <span class="nom">{c.nom}</span>
      <span class="sens {c.sens}">{c.sens === 'credit' ? 'Crédit' : 'Débit'}</span>
    </button>
  </li>
{/snippet}

<div class="ecran">
  <header class="entete">
    <button type="button" class="retour" onclick={onretour}>‹ Réglages</button>
  </header>
  <div class="titre">
    <h1>Catégories</h1>
    <button type="button" class="bouton" onclick={oncreer}>Nouvelle catégorie</button>
  </div>

  {#if actives.length === 0}
    <p class="secondaire">Aucune catégorie. Les catégories sont nécessaires à la saisie rapide.</p>
  {:else}
    <ul class="carte liste">
      {#each actives as c (c.id)}{@render ligne(c)}{/each}
    </ul>
  {/if}

  {#if archivees.length > 0}
    <details>
      <summary>Catégories archivées ({archivees.length})</summary>
      <ul class="carte liste">
        {#each archivees as c (c.id)}{@render ligne(c)}{/each}
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
    margin-bottom: 16px;
  }

  h1 {
    margin: 0;
    font-size: 1.375rem;
    font-weight: 600;
  }

  .liste {
    margin: 0 0 20px;
    padding: 4px 0;
    list-style: none;
  }

  .ligne {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 52px;
    padding: 10px 16px;
    border: 0;
    background: transparent;
    text-align: left;
  }

  li + li .ligne {
    border-top: 1px solid rgb(242 232 218 / 0.06);
  }

  .nom {
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .sens {
    flex: none;
    padding: 3px 8px;
    border-radius: 8px;
    background: var(--fond);
    font-size: 0.75rem;
  }

  .debit {
    color: var(--debit);
  }

  .credit {
    color: var(--credit);
  }

  summary {
    min-height: 44px;
    padding: 12px 4px;
    color: var(--texte-2);
  }
</style>
