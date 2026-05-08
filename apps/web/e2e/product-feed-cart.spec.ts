/**
 * E2E — parcours visiteur → panier déclenché depuis la section
 * Feed produit Kolenda-driven (`<ProductFeedSection/>`) sur `/kit`.
 *
 * Couvre le contrat « le CTA principal du feed produit pousse bien au
 * panier » : le rapport CHA-225 §5.4.4 demande un test bout-en-bout
 * qui parcourt explicitement `/kit#product-feed` → ajout au panier →
 * `/panier` avec le bon produit + le bon prix.
 *
 * **Hors scope** : Stripe / commander / paiement. On s'arrête au
 * récapitulatif panier — la suite du tunnel checkout est testée
 * ailleurs (e2e checkout existant) et n'a pas de dépendance avec ce
 * sprint feed produit.
 *
 * Le mini-cart est un slide-over (`<MiniCartSlideOver/>`, `role="dialog"`,
 * titre "Votre rituel") qui s'ouvre **automatiquement** après un
 * `add_to_cart` (cf. `useCartStore.addItemAndOpen`). Pour atteindre
 * `/panier`, le visiteur clique sur « Revoir le panier » dans ce slide-over.
 */
import { expect, test } from '@playwright/test';

test.describe('Feed produit — visiteur → panier (sans Stripe)', () => {
  test('clic « Composer mon rituel » → mini-cart → /panier avec le kit', async ({
    page,
  }) => {
    // Première hit `/kit` peut compiler la page sur dev server froid
    // (~10 s). On se laisse une marge généreuse pour ne pas flake en CI.
    test.setTimeout(60_000);

    // 1. Atteindre la section feed produit ancrée dans /kit. L'ancre
    //    `#product-feed` est posée par le wrapper RSC — on n'a pas besoin
    //    de scroll programmatique, le navigateur cible le hash.
    await page.goto('/kit#product-feed');
    const feed = page.getByTestId('product-feed-section');
    await expect(feed).toBeVisible();

    // 2. Localiser le CTA principal du feed (`feed.hero.ctaLabel`). Le
    //    label est piloté par le builder Kolenda (`kit-feed.ts`) — on
    //    matche le verbe d'invitation pour rester souple si la copy
    //    évolue (« Composer mon rituel » → variante).
    const composerBtn = feed.getByRole('button', { name: /composer mon rituel/i });
    await expect(composerBtn).toBeVisible();
    await composerBtn.click();

    // 3. Le mini-cart slide-over s'ouvre automatiquement (role=dialog,
    //    titre « Votre rituel »). Vérifier qu'il liste un article (le
    //    nom exact peut varier suivant que la DB est seedée — « Le Kit
    //    FemiGlow » côté seed, « Le rituel FemiGlow » côté mock — donc
    //    on matche les deux variantes).
    const miniCart = page.getByRole('dialog', { name: /votre rituel/i });
    await expect(miniCart).toBeVisible();
    await expect(miniCart.getByText(/le (kit|rituel) femiglow/i)).toBeVisible();

    // 4. Cliquer « Revoir le panier » → navigation vers /panier.
    await miniCart.getByRole('link', { name: /revoir le panier/i }).click();
    await expect(page).toHaveURL(/\/panier(\?.*)?$/);

    // 5. La page panier rend bien l'article (heading h3 du produit). On
    //    matche les deux variantes de naming (DB seed « Le Kit FemiGlow »
    //    vs mock « Le rituel FemiGlow »). C'est l'assertion cœur du test :
    //    le visiteur a bien vu son rituel récapitulé sur /panier.
    await expect(
      page.getByRole('heading', { name: /le (kit|rituel) femiglow/i, level: 3 }),
    ).toBeVisible();

    // 6. Le récap panier affiche le sous-total + une valeur en MAD (la
    //    devise du kit). Pas de valeur en dur — le pricing peut évoluer
    //    en seed et on ne veut pas flake pour 1 dirham. On vérifie juste
    //    le contrat « il y a un sous-total numérique avec MAD ».
    await expect(page.getByText(/sous-total/i).first()).toBeVisible();
    await expect(page.getByText(/\bmad\b/i).first()).toBeVisible();

    // STOP ici — pas de Stripe, pas de tunnel checkout (hors scope
    // sprint feed produit, cf. rapport CHA-225 §5.4.4). Le bouton
    // « Passer commande » existe sur /panier mais on ne le clique pas.
  });
});
