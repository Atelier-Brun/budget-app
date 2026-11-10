<script lang="ts">
  // Réglages : comptes, catégories, sécurité, sauvegarde, version, état du stockage persistant (sans alerte).
  import { formaterDate } from '../lib/dates';

  let {
    persistant,
    derniere,
    oncomptes,
    oncategories,
    oncode,
    onsauvegarde,
    onverrouiller,
    onreinitialiser,
  }: {
    persistant: boolean | null;
    /** Date de la dernière sauvegarde externe, ou null. */
    derniere: string | null;
    oncomptes: () => void;
    oncategories: () => void;
    oncode: () => void;
    onsauvegarde: () => void;
    onverrouiller: () => void;
    /** Démo uniquement (null dans l'app réelle). */
    onreinitialiser: (() => Promise<boolean>) | null;
  } = $props();
  const version: string = __APP_VERSION__;
  let confirmer = $state(false);
  let fait = $state(false);

  async function reinitialiser() {
    fait = (await onreinitialiser?.()) ?? false;
    confirmer = false;
  }
</script>

<div class="ecran">
  <header class="entete"><h1>Réglages</h1></header>

  <ul class="carte liste">
    <li>
      <button type="button" class="ligne" onclick={oncomptes}>
        <span>Comptes</span><span class="secondaire" aria-hidden="true">›</span>
      </button>
    </li>
    <li>
      <button type="button" class="ligne" onclick={oncategories}>
        <span>Catégories</span><span class="secondaire" aria-hidden="true">›</span>
      </button>
    </li>
  </ul>

  <ul class="carte liste">
    <li>
      <button type="button" class="ligne" onclick={onsauvegarde}>
        <span>Sauvegarde</span>
        <span class="secondaire">{derniere ? formaterDate(derniere) : 'Aucune'} ›</span>
      </button>
    </li>
    <li>
      <button type="button" class="ligne" onclick={oncode}>
        <span>Changer le code</span><span class="secondaire" aria-hidden="true">›</span>
      </button>
    </li>
    <li>
      <button type="button" class="ligne" onclick={onverrouiller}>
        <span>Verrouiller maintenant</span><span class="secondaire" aria-hidden="true">›</span>
      </button>
    </li>
  </ul>

  <dl class="carte liste">
    <div class="ligne">
      <dt>Version</dt>
      <dd class="secondaire">{version}</dd>
    </div>
    <div class="ligne bloc">
      <dt>Stockage persistant</dt>
      <dd>
        {#if persistant === null}
          <span class="secondaire">Vérification…</span>
        {:else if persistant}
          Activé
          <p class="secondaire">Safari ne supprimera pas les données de lui-même.</p>
        {:else}
          Non accordé par Safari
          <p class="secondaire">
            Les données restent enregistrées, mais Safari pourrait les effacer s'il manque de place. La sauvegarde
            externe protège de ce risque.
          </p>
        {/if}
      </dd>
    </div>
  </dl>

  {#if onreinitialiser}
    {#if !confirmer}
      <button type="button" class="bouton-discret action" onclick={() => (confirmer = true)}>Réinitialiser les données fictives…</button>
      {#if fait}<p class="secondaire" role="status">Données fictives réinitialisées.</p>{/if}
    {:else}
      <div class="carte confirmation" role="group" aria-label="Confirmer la réinitialisation">
        <p>Toutes les données de la démo seront remplacées par des données fictives neuves. La base réelle n'est pas touchée.</p>
        <div class="boutons">
          <button type="button" class="bouton-discret" onclick={() => (confirmer = false)}>Annuler</button>
          <button type="button" class="bouton" onclick={reinitialiser}>Réinitialiser</button>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
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
    min-height: 48px;
    padding: 10px 16px;
    border: 0;
    background: transparent;
    text-align: left;
  }

  .ligne + .ligne,
  li + li .ligne {
    border-top: 1px solid rgb(242 232 218 / 0.06);
  }

  /* Explication longue : sous le titre, alignée à gauche (plus lisible qu'un paragraphe aligné à droite). */
  .bloc {
    display: grid;
    gap: 4px;
  }

  dt,
  dd {
    margin: 0;
  }

  .ligne:not(.bloc) dd {
    text-align: right;
  }

  .bloc dd {
    font-weight: 600;
  }

  .bloc dd p {
    font-weight: 400;
  }

  dd p {
    margin: 4px 0 0;
    font-size: 0.8125rem;
  }
</style>
