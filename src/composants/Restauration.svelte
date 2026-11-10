<script lang="ts" module>
  import type { Coffre } from '../lib/coffre';
  import type { Donnees } from '../lib/sauvegarde';

  /** Données vérifiées, avec la clé et le coffre du fichier (utiles seulement sur une installation neuve). */
  export interface Restaure {
    donnees: Donnees;
    cle: CryptoKey;
    /** null pour une copie interne (même clé que les données actuelles). */
    coffre: Coffre | null;
  }
</script>

<script lang="ts">
  // Restauration : fichier (ou copie interne) → code → contrôle complet → aperçu → confirmation.
  // Rien n'est modifié avant la confirmation ; tout fichier est vérifié strictement.
  import { onMount } from 'svelte';
  import { changerCode, ErreurCoffre, ouvrirAvecCode, ouvrirAvecSecours } from '../lib/coffre';
  import { formaterDate } from '../lib/dates';
  import { dechiffrerTout, ErreurSauvegarde, lireFichier, TAILLE_MAX, type Fichier } from '../lib/sauvegarde';
  import type { Copie } from '../lib/stockage';
  import NouveauCode from './NouveauCode.svelte';
  import SaisieCode from './SaisieCode.svelte';

  let {
    demo,
    cleActuelle,
    copie = null,
    onconfirmer,
    onannuler,
  }: {
    demo: boolean;
    /** null : installation neuve (aucun code encore choisi). */
    cleActuelle: CryptoKey | null;
    copie?: Copie | null;
    onconfirmer: (r: Restaure) => Promise<boolean>;
    onannuler: () => void;
  } = $props();

  // La source (copie ou fichier) est fixée pour toute la vie du composant : valeur initiale voulue.
  // svelte-ignore state_referenced_locally
  let etape = $state<'fichier' | 'code' | 'secours' | 'apercu' | 'nouveau'>(copie ? 'apercu' : 'fichier');
  let fichier = $state.raw<Fichier | null>(null);
  let pret = $state.raw<Restaure | null>(null);
  let parSecours = $state<string | null>(null);
  let occupe = $state(false);
  let erreur = $state('');
  let saisie = $state('');

  const message = (e: unknown) =>
    e instanceof ErreurCoffre || e instanceof ErreurSauvegarde ? e.message : 'Lecture impossible : rien n’a été modifié.';

  onMount(async () => {
    if (!copie || !cleActuelle) return;
    try {
      const donnees = await dechiffrerTout(cleActuelle, copie.donnees);
      pret = { donnees, cle: cleActuelle, coffre: null };
    } catch (e) {
      erreur = message(e);
    }
  });

  async function choisir(e: Event) {
    const f = (e.currentTarget as HTMLInputElement).files?.[0];
    erreur = '';
    if (!f) return;
    try {
      if (f.size > TAILLE_MAX) throw new ErreurSauvegarde('Fichier trop volumineux : ce n’est pas une sauvegarde BUDGET.');
      const lu = lireFichier(await f.text());
      if (lu.demo !== demo)
        throw new ErreurSauvegarde(
          lu.demo ? 'Ce fichier vient de la démo : il ne peut pas être restauré dans l’app réelle.' : 'Ce fichier vient de l’app réelle : il ne peut pas être restauré dans la démo.',
        );
      fichier = lu;
      etape = 'code';
    } catch (err) {
      erreur = message(err);
    }
  }

  async function ouvrir(secret: { code: string } | { secours: string }) {
    if (!fichier) return;
    occupe = true;
    erreur = '';
    try {
      const cle = 'code' in secret ? await ouvrirAvecCode(fichier.coffre, secret.code) : await ouvrirAvecSecours(fichier.coffre, secret.secours);
      const donnees = await dechiffrerTout(cle, fichier.donnees, { date: fichier.date, chiffre: fichier.resume });
      parSecours = 'secours' in secret ? secret.secours : null;
      pret = { donnees, cle, coffre: fichier.coffre };
      etape = 'apercu';
    } catch (e) {
      erreur = message(e);
    }
    occupe = false;
  }

  async function confirmer() {
    if (!pret) return;
    // Installation neuve ouverte par le code de secours : il faut d'abord choisir un nouveau code.
    if (!cleActuelle && parSecours !== null) {
      etape = 'nouveau';
      return;
    }
    occupe = true;
    if (!(await onconfirmer(pret))) occupe = false;
  }

  async function nouveauCode(code: string) {
    if (!pret || !fichier || parSecours === null) return;
    occupe = true;
    const coffre = await changerCode(fichier.coffre, { secours: parSecours }, code);
    if (!(await onconfirmer({ ...pret, coffre }))) occupe = false;
  }

  const nb = (n: number, un: string) => `${n} ${un}${n > 1 ? 's' : ''}`;
</script>

<section class="restauration" aria-label="Restauration">
  {#if etape === 'fichier'}
    <div class="carte bloc">
      <h2>Restaurer une sauvegarde</h2>
      <p class="secondaire">Choisissez un fichier budget-sauvegarde-AAAA-MM-JJ.json (iCloud Drive, Fichiers…).</p>
      <label class="bouton fichier">
        Choisir le fichier
        <input type="file" accept=".json,application/json" onchange={choisir} />
      </label>
    </div>
  {:else if etape === 'code'}
    <SaisieCode
      titre="Code de cette sauvegarde"
      aide="Le code en vigueur au moment de la sauvegarde."
      {erreur}
      {occupe}
      onvalider={(code) => ouvrir({ code })}
    />
    <button type="button" class="bouton-discret action" onclick={() => ((erreur = ''), (saisie = ''), (etape = 'secours'))}>
      Utiliser le code de secours
    </button>
  {:else if etape === 'secours'}
    <form
      class="carte bloc"
      onsubmit={(e) => {
        e.preventDefault();
        ouvrir({ secours: saisie });
      }}
    >
      <h2>Code de secours de cette sauvegarde</h2>
      <label class="champ">
        <span>Code de secours (24 caractères)</span>
        <input bind:value={saisie} autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="40" />
      </label>
      {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}
      <button type="submit" class="bouton" disabled={occupe}>{occupe ? 'Vérification…' : 'Valider'}</button>
    </form>
  {:else if etape === 'nouveau'}
    <NouveauCode aide="Code de secours accepté. Choisissez votre nouveau code." {occupe} onchoisi={nouveauCode} />
  {:else if pret}
    <div class="carte bloc" role="group" aria-label="Aperçu de la sauvegarde">
      <h2>Aperçu</h2>
      <p>
        {copie ? `Copie interne du ${new Date(copie.id).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}` : `Sauvegarde du ${formaterDate(fichier!.date)}`}
      </p>
      <p class="secondaire">
        {nb(pret.donnees.operations.length, 'opération')} · {nb(pret.donnees.comptes.length, 'compte')} · {nb(pret.donnees.categories.length, 'catégorie')}
      </p>
      <p>
        {cleActuelle
          ? 'Les données actuelles seront remplacées par celles-ci. Une copie de secours des données actuelles est faite avant.'
          : 'Ces données seront installées sur cet appareil.'}
      </p>
      {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}
      <div class="boutons">
        <button type="button" class="bouton-discret" onclick={onannuler}>Annuler</button>
        <button type="button" class="bouton" disabled={occupe} onclick={confirmer}>Restaurer</button>
      </div>
    </div>
  {/if}

  {#if etape !== 'apercu' && etape !== 'nouveau'}
    {#if erreur && (etape === 'fichier')}<p class="erreur" role="alert">{erreur}</p>{/if}
    <button type="button" class="bouton-discret action" onclick={onannuler}>Annuler</button>
  {:else if erreur && !pret}
    <p class="erreur" role="alert">{erreur}</p>
    <button type="button" class="bouton-discret action" onclick={onannuler}>Retour</button>
  {/if}
</section>

<style>
  .restauration {
    display: grid;
    gap: 12px;
  }

  .fichier {
    position: relative;
    display: grid;
    place-items: center;
  }

  /* Le champ fichier natif est invisible ; le libellé sert de bouton (zone tactile ≥ 44 px). */
  .fichier input {
    position: absolute;
    inset: 0;
    opacity: 0;
  }

  .fichier:has(input:focus-visible) {
    outline: 2px solid var(--accent);
  }
</style>
