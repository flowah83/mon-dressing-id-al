import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Page, PageHeader, SyncLine } from "@/components/vestiaire/ui";
import { useAuth } from "@/lib/account";
import { frenchAuthError, isPlausibleEmail, passwordIssue } from "@/lib/auth-errors";
import { fetchTodayUsage, getSupabase } from "@/lib/cloud";
import { AI_DAILY_LIMIT } from "@/lib/quota";

export const Route = createFileRoute("/compte")({
  head: () => ({
    meta: [
      { title: "Compte — Vestiaire" },
      { name: "description", content: "Connexion, création de compte et copie privée du dressing." },
      { property: "og:title", content: "Compte — Vestiaire" },
      { property: "og:description", content: "Connexion et copie privée du dressing." },
    ],
  }),
  component: Compte,
});

type View = "connexion" | "inscription" | "oubli";

function Compte() {
  const auth = useAuth();
  if (!auth.ready) {
    return (
      <Page>
        <div className="pt-safe" />
        <div className="mt-8 h-40 animate-pulse rounded-3xl bg-muted" />
      </Page>
    );
  }
  return (
    <Page>
      <PageHeader eyebrow="Privé" title="Compte" />
      {!auth.configured && <Unavailable />}
      {auth.configured && auth.recovery && <NewPassword />}
      {auth.configured && !auth.recovery && auth.user && <SignedIn />}
      {auth.configured && !auth.recovery && !auth.user && <Forms />}
    </Page>
  );
}

function Unavailable() {
  return (
    <section className="space-y-4 rounded-3xl bg-card p-6 shadow-soft">
      <p>Le compte en ligne n'est pas encore activé sur cet espace. Votre dressing reste enregistré sur cet appareil.</p>
      <p className="text-sm text-muted-foreground">L'export du dressing reste disponible dans les réglages, le temps que la copie en ligne soit mise en place.</p>
      <Button asChild variant="outline"><Link to="/reglages">Ouvrir la sauvegarde</Link></Button>
    </section>
  );
}

function SignedIn() {
  const auth = useAuth();
  const [usage, setUsage] = useState<{ analyses: number; advice: number } | null>(null);
  useEffect(() => {
    let active = true;
    fetchTodayUsage().then((next) => {
      if (active) setUsage(next);
    });
    return () => {
      active = false;
    };
  }, [auth.user?.id, auth.lastSyncAt]);

  return (
    <section className="space-y-4 rounded-3xl bg-card p-6 shadow-soft">
      <p>Connecté avec <span className="font-medium">{auth.user?.email}</span>.</p>
      <p className="text-sm text-muted-foreground">Vos pièces, tenues et photos sont copiées dans votre compte. Personne d'autre ne peut les voir. Une copie reste aussi sur cet appareil, pour que le dressing s'ouvre vite.</p>
      <SyncLine />
      {usage && (
        <p className="text-sm text-muted-foreground">
          Aujourd'hui : {Math.max(0, AI_DAILY_LIMIT - usage.analyses)} analyses photo restantes, {Math.max(0, AI_DAILY_LIMIT - usage.advice)} conseils restants. Le compteur repart à zéro chaque nuit, heure de Paris.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" disabled={auth.syncState === "saving"} onClick={() => void auth.syncNow()}>
          {auth.syncState === "saving" ? "Sauvegarde…" : "Sauvegarder maintenant"}
        </Button>
        <Button asChild variant="outline"><Link to="/">Retour au dressing</Link></Button>
      </div>
      <Button
        type="button"
        variant="ghost"
        onClick={async () => {
          await auth.signOut();
          toast.success("Vous êtes déconnecté");
        }}
      >
        Se déconnecter
      </Button>
      <p className="text-xs text-muted-foreground">Se déconnecter ne supprime pas le dressing de ce téléphone, ni la copie dans le compte. Si une autre personne se connecte ici, son dressing remplace l'affichage. Le vôtre reste dans votre compte.</p>
    </section>
  );
}

function Forms() {
  const [view, setView] = useState<View>("connexion");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function switchTo(next: View) {
    setView(next);
    setError(null);
    setInfo(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    if (!isPlausibleEmail(email)) {
      setError("Indiquez une adresse e-mail valide.");
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setError("Le compte en ligne n'est pas encore activé.");
      return;
    }
    if (view !== "oubli") {
      const issue = passwordIssue(password, view === "inscription" ? confirm : undefined);
      if (issue) {
        setError(issue);
        return;
      }
    }
    setPending(true);
    try {
      if (view === "connexion") {
        const { error: signError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signError) setError(frenchAuthError(signError.message));
        else toast.success("Vous êtes connecté");
      } else if (view === "inscription") {
        const { data, error: signError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/compte` },
        });
        if (signError) setError(frenchAuthError(signError.message));
        else if (data.session) toast.success("Compte créé");
        else setInfo("Un e-mail de confirmation a été envoyé. Ouvrez-le, puis revenez vous connecter.");
      } else {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/compte`,
        });
        if (resetError && !/not found/i.test(resetError.message)) setError(frenchAuthError(resetError.message));
        else setInfo("Si un compte existe avec cette adresse, un e-mail vient de partir. Ouvrez le lien depuis ce navigateur.");
      }
    } finally {
      setPending(false);
    }
  }

  const title = view === "inscription" ? "Créer un compte" : view === "oubli" ? "Mot de passe oublié" : "Se connecter";

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-3xl bg-card p-6 shadow-soft">
      <p className="text-sm text-muted-foreground">
        {view === "oubli"
          ? "Indiquez votre e-mail. Nous vous enverrons un lien pour choisir un nouveau mot de passe."
          : "Le compte sert à garder une copie privée de vos pièces, de vos tenues et de vos photos."}
      </p>
      <label className="block">
        <span className="eyebrow">E-mail</span>
        <input className="field mt-2" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} required aria-label="E-mail" />
      </label>
      {view !== "oubli" && (
        <label className="block">
          <span className="eyebrow">Mot de passe</span>
          <input className="field mt-2" type="password" autoComplete={view === "inscription" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Mot de passe" />
        </label>
      )}
      {view === "inscription" && (
        <label className="block">
          <span className="eyebrow">Confirmer le mot de passe</span>
          <input className="field mt-2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Confirmer le mot de passe" />
        </label>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {info && <p role="status" className="text-sm text-muted-foreground">{info}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Patientez…" : title}</Button>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {view !== "connexion" && <button type="button" className="text-primary underline underline-offset-4" onClick={() => switchTo("connexion")}>Se connecter</button>}
        {view !== "inscription" && <button type="button" className="text-primary underline underline-offset-4" onClick={() => switchTo("inscription")}>Créer un compte</button>}
        {view !== "oubli" && <button type="button" className="text-primary underline underline-offset-4" onClick={() => switchTo("oubli")}>Mot de passe oublié</button>}
      </div>
    </form>
  );
}

function NewPassword() {
  const auth = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const issue = passwordIssue(password, confirm);
    if (issue) {
      setError(issue);
      return;
    }
    const supabase = getSupabase();
    if (!supabase) return;
    setPending(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (updateError) {
      setError(frenchAuthError(updateError.message));
      return;
    }
    auth.clearRecovery();
    toast.success("Mot de passe mis à jour");
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-3xl bg-card p-6 shadow-soft">
      <p>Choisissez un nouveau mot de passe pour votre compte.</p>
      <label className="block">
        <span className="eyebrow">Nouveau mot de passe</span>
        <input className="field mt-2" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Nouveau mot de passe" />
      </label>
      <label className="block">
        <span className="eyebrow">Confirmer</span>
        <input className="field mt-2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Confirmer le nouveau mot de passe" />
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Patientez…" : "Enregistrer le mot de passe"}</Button>
    </form>
  );
}
