<script lang="ts">
  // Écran verrouillé : code (ou code de secours puis nouveau code). Après chaque erreur : délai croissant,
  // enregistré dans le coffre ; jamais d'effacement des données.
  import { onDestroy, onMount } from 'svelte';
  import Logo from '../composants/Logo.svelte';
  import NouveauCode from '../composants/NouveauCode.svelte';
  import SaisieCode from '../composants/SaisieCode.svelte';
  import { changerCode, delaiApres, ErreurCoffre, ouvrirAvecCode, ouvrirAvecSecours, type Coffre } from '../lib/coffre';
  import { ecrire, lireTout, traduire } from '../lib/stockage';

  let { db, coffre, demo, onouvert }: { db: IDBDatabase; coffre: Coffre; demo: boolean; onouvert: (cle: CryptoKey, coffre: Coffre) => void } =
    $props();

  type Essais = { cle: 'essais'; echecs: number; jusqua: number };
  let essais = $state<Essais>({ cle: 'essais', echecs: 0, jusqua: 0 });
  let maintenant = $state(Date.now());
  let etape = $state<'code' | 'secours' | 'nouveau'>('code');
  let occupe = $state(false);
  let erreur = $state('');
  let saisie = $state('');
  let secoursValide = '';
  let horloge: ReturnType<typeof setInterval> | undefined;

  const attente = $derived(Math.max(0, Math.ceil((essais.jusqua - maintenant) / 1000)));
  const duree = (s: number) => (s >= 60 ? `${Math.ceil(s / 60)} min` : `${s} s`);

  onMount(async () => {
    horloge = setInterval(() => (maintenant = Date.now()), 1000);
    const e = (await lireTout<Essais>(db, 'coffre')).find((x) => x.cle === 'essais');
    if (e) essais = e;
  });
  onDestroy(() => clearInterval(horloge));

  async function noter(ok: boolean) {
    const echecs = ok ? 0 : essais.echecs + 1;
    essais = { cle: 'essais', echecs, jusqua: Date.now() + delaiApres(echecs) };
    maintenant = Date.now();
    await ecrire(db, ['coffre'], (tx) => void tx.objectStore('coffre').put($state.snapshot(essais)));
  }

  async function essayer(ouvrir: () => Promise<CryptoKey>): Promise<CryptoKey | null> {
    if (attente > 0) return null;
    occupe = true;
    erreur = '';
    try {
      const cle = await ouvrir();
      await noter(true);
      return cle;
    } catch (e) {
      if (!(e instanceof ErreurCoffre)) {
        erreur = traduire(e).message;
        return null;
      }
      await noter(false).catch(() => {});
      erreur = 'Code incorrect.';
      return null;
    } finally {
      occupe = false;
    }
  }

  async function parCode(code: string) {
    const cle = await essayer(() => ouvrirAvecCode(coffre, code));
    if (cle) onouvert(cle, coffre);
  }

  async function parSecours(e: SubmitEvent) {
    e.preventDefault();
    const s = saisie;
    if (await essayer(() => ouvrirAvecSecours(coffre, s))) {
      secoursValide = s;
      saisie = '';
      etape = 'nouveau';
    }
  }

  async function nouveau(code: string) {
    occupe = true;
    try {
      const c = await changerCode(coffre, { secours: secoursValide }, code);
      await ecrire(db, ['coffre'], (tx) => void tx.objectStore('coffre').put(c));
      secoursValide = '';
      onouvert(await ouvrirAvecCode(c, code), c);
    } catch (e) {
      erreur = traduire(e).message;
      occupe = false;
    }
  }
</script>

<div class="ecran acces">
  <header class="marque"><Logo taille={56} /><h1>BAARA</h1></header>

  {#if attente > 0}
    <p class="note" role="status">Trop d’erreurs. Nouvel essai possible dans {duree(attente)}.</p>
  {/if}

  {#if etape === 'code'}
    <SaisieCode titre="Saisissez votre code" {erreur} {occupe} desactive={attente > 0} onvalider={parCode} />
    {#if demo}<p class="note">DÉMO : code choisi à la création (exemple proposé : 12345678).</p>{/if}
    <button type="button" class="bouton-discret action" onclick={() => ((erreur = ''), (etape = 'secours'))}>Code oublié ?</button>
  {:else if etape === 'secours'}
    <form class="carte bloc" onsubmit={parSecours}>
      <h2>Code de secours</h2>
      <p class="secondaire">Saisissez le code de secours noté sur papier lors de la création. Vous choisirez ensuite un nouveau code.</p>
      <label class="champ">
        <span>Code de secours (24 caractères)</span>
        <input bind:value={saisie} autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="40" />
      </label>
      {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}
      <div class="boutons">
        <button type="button" class="bouton-discret" onclick={() => ((erreur = ''), (etape = 'code'))}>Annuler</button>
        <button type="submit" class="bouton" disabled={occupe || attente > 0}>{occupe ? 'Vérification…' : 'Valider'}</button>
      </div>
    </form>
  {:else}
    <NouveauCode {occupe} {erreur} aide="Code de secours accepté. Choisissez votre nouveau code." onchoisi={nouveau} />
  {/if}
</div>
