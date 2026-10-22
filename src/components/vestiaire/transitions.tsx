/**
 * Les transitions de vue du style Épuré attendaient la fin de `router.navigate`
 * avant de montrer la page. Le navigateur gardait l'ancienne capture ~4 s,
 * le temps de son délai d'abandon. La navigation des onglets est donc directe.
 * Le fondu CSS ne cache plus le contenu (voir styles.css).
 */
export function ViewTransitions() {
  return null;
}
