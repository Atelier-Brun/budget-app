<script lang="ts">
  // Sauvegarde externe (menu de partage iOS → iCloud Drive ; repli : téléchargement), restauration, copies internes.
  // Le fichier est préparé à l'ouverture de l'écran : le toucher sur « Sauvegarder » ouvre le partage sans attente
  // (iOS exige que le partage suive directement le geste).
  import { onMount } from 'svelte';
  import Restauration, { type Restaure } from '../composants/Restauration.svelte';
  import type { Coffre } from '../lib/coffre';
  import { aujourdHui, formaterDate } from '../lib/dates';
  import { creerFichier, nomFichier } from '../lib/sauvegarde';
  import { lireBrut, lireTout, type Copie } from '../lib/stockage';

  let {
    db,
    cle,
    coffre,
    demo,
    derniere,
    onsauvegarde,
    onrestaurer,
    onretour,
  }: {
    db: IDBDatabase;
    cle: CryptoKey;
    coffre: Coffre;
    demo: boolean;
    /** Date de la dernière sauvegarde externe (AAAA-MM-JJ) ou null. */
    derniere: string | null;
    onsauvegarde: (date: string) => Promise<boolean>;
    onrestaurer: (r: Restaure) => Promise<boolean>;
    onretour: () => void;
  } = $props();

  let fichier = $state<File | null>(null);
  let copies = $state.raw<Copie[]>([]);
  let restaurer = $state<'fichier' | Copie | null>(null);
  let statut = $state('');
  let erreur = $state('');

  onMount(async () => {
    try {
      const date = aujourdHui();
      const [texte, liste] = await Promise.all([creerFichier(cle, coffre, await lireBrut(db), date, demo), lireTout<Copie>(db, 'copies')]);
      fichier = new File([texte], nomFichier(date, demo), { type: 'application/json' });
      copies = liste.sort((a, b) => (a.id < b.id ? 1 : -1));
    } catch {
      erreur = 'Préparation de la sauvegarde impossible. Rien n’a été modifié.';
    }
  });

  function telecharger(f: File) {
    const url = URL.createObjectURL(f);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function sauvegarder() {
    if (!fichier) return;
    statut = '';
    erreur = '';
    try {
      if (navigator.canShare?.({ files: [fichier] })) await navigator.share({ files: [fichier] });
      else telecharger(fichier);
    } catch (e) {
      if ((e as { name?: unknown } | null)?.name !== 'AbortError') erreur = 'Le partage a échoué. Réessayez.';
      return; // partage annulé : la date de dernière sauvegarde ne change pas
    }
    if (await onsauvegarde(aujourdHui())) statut = 'Sauvegarde créée.';
  }

  const quand = (id: string) => new Date(id).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
</script>

<div class="ecran">
  <header class="entete">
    <button type="button" class="retour" onclick={() => (restaurer ? (restaurer = null) : onretour())}>‹ {restaurer ? 'Sauvegarde' : 'Réglages'}</button>
  </header>
  <h1 class="titre-fiche">Sauvegarde</h1>

  {#if restaurer}
    <Restauration
      {demo}
      cleActuelle={cle}
      copie={restaurer === 'fichier' ? null : restaurer}
      onconfirmer={onrestaurer}
      onannuler={() => (restaurer = null)}
    />
  {:else}
    <section class="carte bloc">
      <p>
        Dernière sauvegarde externe :
        <strong>{derniere ? `le ${formaterDate(derniere)}` : 'aucune'}</strong>
      </p>
      <p class="secondaire">
        Fichier chiffré, illisible sans votre code ou votre code de secours. Enregistrez-le dans iCloud Drive (« Enregistrer dans Fichiers »).
      </p>
      <button type="button" class="bouton" disabled={!fichier} onclick={sauvegarder}>{fichier ? 'Sauvegarder' : 'Préparation…'}</button>
      {#if statut}<p class="note" role="status">{statut}</p>{/if}
      {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}
    </section>

    <button type="button" class="bouton-discret action" onclick={() => (restaurer = 'fichier')}>Restaurer une sauvegarde…</button>

    <h2 class="sous-titre">Copies internes automatiques</h2>
    <p class="secondaire explication">Une copie chiffrée à chaque ouverture de l’app ; les 7 dernières sont gardées sur cet appareil.</p>
    {#if copies.length}
      <ul class="carte liste">
        {#each copies as c (c.id)}
          <li>
            <button type="button" class="ligne" onclick={() => (restaurer = c)}>
              <span>{quand(c.id)}</span>
              <span class="secondaire">{c.donnees.operations.length} op. ›</span>
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="secondaire explication">Aucune copie pour le moment.</p>
    {/if}
  {/if}
</div>

<style>
  .sous-titre {
    margin: 28px 0 4px;
    font-size: 1rem;
    font-weight: 600;
  }

  .explication {
    margin: 0 0 12px;
    font-size: 0.875rem;
  }

  .liste {
    margin: 0;
    padding: 4px 0;
    list-style: none;
  }

  .ligne {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    min-height: 48px;
    padding: 10px 16px;
    border: 0;
    background: transparent;
    text-align: left;
  }

  li + li .ligne {
    border-top: 1px solid rgb(242 232 218 / 0.06);
  }
</style>
