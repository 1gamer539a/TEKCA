/*
  Traduit une erreur d'inscription Supabase en message CLAIR pour l'utilisateur.
  Avant : TOUTE erreur affichait « Impossible de créer le compte avec ces informations », ce qui
  faisait croire à une faute de l'utilisateur alors que la cause était souvent technique (envoi de
  l'email de confirmation, limite d'envoi, mot de passe trop faible, panne de la base…).
  Reste générique (volontairement) seulement pour les cas qui révéleraient si un email est déjà inscrit.
*/
export function cleErreurInscription(erreur) {
  const code = String(erreur?.code || "").toLowerCase();
  const message = String(erreur?.message || "").toLowerCase();
  const statut = Number(erreur?.status) || 0;

  if (code === "weak_password" || message.includes("password should") || message.includes("easy to guess") || message.includes("weak password")) {
    return "auth.inscriptionMdpFaible";
  }
  if (message.includes("sending confirmation email") || message.includes("error sending") || code === "email_send_failed") {
    return "auth.inscriptionEmailConfirmation";
  }
  if (statut === 429 || code.includes("rate_limit") || message.includes("rate limit") || message.includes("too many")) {
    return "auth.inscriptionTropDeTentatives";
  }
  if (code === "email_address_invalid" || message.includes("email address") && message.includes("invalid") || message.includes("invalid email")) {
    return "auth.inscriptionEmailInvalide";
  }
  if (code === "signup_disabled" || message.includes("signups not allowed") || message.includes("signup is disabled")) {
    return "auth.inscriptionFermee";
  }
  if (statut >= 500 || code === "unexpected_failure" || message.includes("database error")) {
    return "auth.inscriptionTechnique";
  }
  return "auth.compteImpossible"; // email déjà utilisé, etc. : message volontairement neutre
}
