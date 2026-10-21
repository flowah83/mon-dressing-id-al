export function isPlausibleEmail(value: string): boolean {
  const email = value.trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function passwordIssue(password: string, confirm?: string): string | null {
  if (password.length < 8) return "Choisissez un mot de passe d'au moins 8 caractères.";
  if (password.length > 72) return "Ce mot de passe est trop long.";
  if (confirm !== undefined && password !== confirm) return "Les deux mots de passe ne sont pas identiques.";
  return null;
}

/** Maps provider errors to French without echoing internal details. */
export function frenchAuthError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("invalid login") || text.includes("invalid credentials")) {
    return "Adresse e-mail ou mot de passe incorrect.";
  }
  if (text.includes("email not confirmed")) {
    return "Confirmez votre adresse avec l'e-mail reçu, puis reconnectez-vous.";
  }
  if (text.includes("already registered") || text.includes("already been registered") || text.includes("user already")) {
    return "Un compte existe déjà avec cette adresse. Connectez-vous.";
  }
  if (text.includes("password") && (text.includes("short") || text.includes("at least") || text.includes("weak") || text.includes("least"))) {
    return "Ce mot de passe est trop court ou trop simple.";
  }
  if (text.includes("rate") || text.includes("too many") || text.includes("over_request")) {
    return "Trop de tentatives. Réessayez dans quelques minutes.";
  }
  if (text.includes("network") || text.includes("failed to fetch") || text.includes("fetch")) {
    return "Connexion impossible. Vérifiez le réseau et réessayez.";
  }
  return "Le compte en ligne n'a pas répondu. Réessayez dans un instant.";
}
