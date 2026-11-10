<script lang="ts">
  // Premier lancement : choix du code, code de secours affiché une seule fois puis vérifié.
  // Rien n'est enregistré avant la vérification du code de secours : en cas d'interruption, on recommence.
  import Logo from '../composants/Logo.svelte';
  import NouveauCode from '../composants/NouveauCode.svelte';
  import Restauration, { type Restaure } from '../composants/Restauration.svelte';
  import { creerCoffre, formaterSecours, normaliserSecours, type Coffre } from '../lib/coffre';

  let {
    demo,
    avecDonnees,
    onterminer,
    onrestaurer,
  }: {
    demo: boolean;
    /** Données 0.2.0 déjà présentes (en clair) : elles seront chiffrées. */
    avecDonnees: boolean;
    onterminer: (coffre: Coffre, cle: CryptoKey) => Promise<boolean>;
    onrestaurer: (r: Restaure) => Promise<boolean>;
  } = $props();

  let etape = $state<'code' | 'secours' | 'verif' | 'restaurer'>('code');
  let occupe = $state(false);
  let erreur = $state('');
  let cree = $state.raw<{ coffre: Coffre; cle: CryptoKey; secours: string } | null>(null);
  let groupe = $state(1);
  let saisie = $state('');

  async function choisi(code: string) {
    occupe = true;
    cree = await creerCoffre(code);
    occupe = false;
    etape = 'secours';
  }

  async function verifier(e: SubmitEvent) {
    e.preventDefault();
    if (!cree) return;
    const attendu = cree.secours.slice((groupe - 1) * 4, groupe * 4);
    if (normaliserSecours(saisie) !== attendu) {
      erreur = 'Groupe incorrect. Vérifiez votre copie du code de secours.';
      return;
    }
    occupe = true;
    erreur = '';
    if (!(await onterminer(cree.coffre, cree.cle))) occupe = false;
  }
</script>

<div class="ecran acces">
  <header class="marque"><Logo taille={56} /><h1>BUDGET</h1></header>

  {#if etape === 'code'}
    <p class="intro secondaire">
      {avecDonnees ? 'Vos données vont être chiffrées.' : 'Bienvenue.'} Choisissez le code qui protégera l’accès à vos données.
    </p>
    {#if demo}<p class="note">DÉMO : par exemple 12345678.</p>{/if}
    {#if occupe}
      <p class="secondaire" role="status">Préparation du chiffrement…</p>
    {:else}
      <NouveauCode onchoisi={choisi} />
      <button type="button" class="bouton-discret action" onclick={() => (etape = 'restaurer')}>Restaurer une sauvegarde…</button>
    {/if}
  {:else if etape === 'secours' && cree}
    <!-- Deux lignes de 3 groupes : jamais de coupure au milieu d'un groupe. -->
    {@const groupes = formaterSecours(cree.secours).split('-')}
    <section class="carte bloc">
      <h2>Code de secours</h2>
      <p>Notez-le sur papier et gardez-le en lieu sûr. Il permet de retrouver l’accès si vous oubliez votre code.</p>
      <p class="secours" aria-label="Code de secours">
        <span>{groupes.slice(0, 3).join('-')}-</span><span>{groupes.slice(3).join('-')}</span>
      </p>
      <p class="secondaire">Il ne sera plus jamais affiché. Sans le code ni le code de secours, les données sont perdues.</p>
      <button
        type="button"
        class="bouton"
        onclick={() => {
          groupe = 1 + (crypto.getRandomValues(new Uint8Array(1))[0]! % 6);
          saisie = '';
          etape = 'verif';
        }}>Je l’ai noté</button
      >
    </section>
  {:else if etape === 'verif'}
    <form class="carte bloc" onsubmit={verifier}>
      <h2>Vérification</h2>
      <label class="champ">
        <span>Recopiez le groupe n° {groupe} du code de secours</span>
        <input bind:value={saisie} autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="9" />
      </label>
      {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}
      <div class="boutons">
        <button type="button" class="bouton-discret" onclick={() => ((erreur = ''), (etape = 'secours'))}>Revoir le code</button>
        <button type="submit" class="bouton" disabled={occupe}>Valider</button>
      </div>
    </form>
  {:else}
    <Restauration {demo} cleActuelle={null} onconfirmer={onrestaurer} onannuler={() => (etape = 'code')} />
  {/if}
</div>
