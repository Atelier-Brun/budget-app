<script lang="ts">
  // Gestion des comptes : actifs par type puis alphabétique, archivés repliés, création.
  import { LIBELLES, trierComptes, type Compte } from '../lib/comptes';

  let {
    comptes,
    onouvrir,
    oncreer,
    onretour,
  }: { comptes: Compte[]; onouvrir: (id: string) => void; oncreer: () => void; onretour: () => void } = $props();

  const actifs = $derived(trierComptes(comptes.filter((c) => !c.archive)));
  const archives = $derived(trierComptes(comptes.filter((c) => c.archive)));
</script>

{#snippet ligne(c: Compte)}
  <li>
    <button type="button" class="ligne" onclick={() => onouvrir(c.id)}>
      <span class="nom">{c.nom}</span>
      <span class="secondaire">{LIBELLES[c.type].un}{c.principal ? ' · Principal' : ''} ›</span>
    </button>
  </li>
{/snippet}

<div class="ecran">
  <header class="entete">
    <button type="button" class="retour" onclick={onretour}>‹ Réglages</button>
  </header>
  <div class="titre">
    <h1>Comptes</h1>
    <button type="button" class="bouton" onclick={oncreer}>Nouveau compte</button>
  </div>

  {#if actifs.length === 0}
    <p class="secondaire">Aucun compte actif.</p>
  {:else}
    <ul class="carte liste">
      {#each actifs as c (c.id)}{@render ligne(c)}{/each}
    </ul>
  {/if}

  {#if archives.length > 0}
    <details>
      <summary>Comptes archivés ({archives.length})</summary>
      <ul class="carte liste">
        {#each archives as c (c.id)}{@render ligne(c)}{/each}
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

  summary {
    min-height: 44px;
    padding: 12px 4px;
    color: var(--texte-2);
  }
</style>
