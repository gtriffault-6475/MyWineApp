/**
 * Valide la configuration critique au démarrage du serveur plutôt qu'au
 * premier login — une variable d'environnement mal configurée fait échouer
 * le déploiement immédiatement, au lieu de rester invisible jusqu'à ce
 * qu'un utilisateur tombe dessus (voir Story 1.1, régression SESSION_SECRET).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertSessionSecretConfigured } = await import(
      "@/lib/auth/session"
    );
    const { assertAppPasswordConfigured } = await import(
      "@/lib/auth/password"
    );
    assertSessionSecretConfigured();
    assertAppPasswordConfigured();
  }
}
