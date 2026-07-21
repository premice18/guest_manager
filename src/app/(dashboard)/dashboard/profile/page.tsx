"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  User,
  Shield,
  Settings,
  Calendar,
  Camera,
  Loader2,
  Save,
  LogOut,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ProfileTab = "profile" | "security" | "preferences";

// Génère une couleur pastel à partir d'un string (pour l'avatar)
function stringToColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 55%, 75%)`;
}

// Page de profil administrateur
export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");
  const [saving, setSaving] = useState(false);

  // Infos personnelles
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [bio, setBio] = useState("");

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Sécurité
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Préférences
  const [theme, setTheme] = useState("light");
  const [notifications, setNotifications] = useState(true);
  const [language, setLanguage] = useState("fr");

  // Stats
  const [eventCount, setEventCount] = useState(0);
  const [guestCount, setGuestCount] = useState(0);
  const [lastLogin, setLastLogin] = useState<string | null>(null);

  // Modale déconnexion multi-appareils
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);

  const loadProfile = useCallback(async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) {
      router.push("/login");
      return;
    }
    setUser(u);
    setEmail(u.email ?? "");

    // Tente de charger le profil depuis la table users ou public.profiles
    // (optionnel, dépend si une table profile a été créée)
    const { data: meta } = await supabase
      .from("events")
      .select("id")
      .eq("owner_id", u.id)
      .limit(1);
    if (meta) {
      const { count: evCount } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", u.id);
      setEventCount(evCount ?? 0);

      const { count: gCount } = await supabase
        .from("guests")
        .select("*", { count: "exact", head: true });

      // Tentative de récupération des infos depuis user_metadata
      setFirstName(u.user_metadata?.first_name ?? "");
      setLastName(u.user_metadata?.last_name ?? "");
      setPhone(u.user_metadata?.phone ?? "");
      setRole(u.user_metadata?.role ?? "");
      setBio(u.user_metadata?.bio ?? "");
      setTheme(u.user_metadata?.theme ?? "light");
      setNotifications(u.user_metadata?.notifications ?? true);
      setLanguage(u.user_metadata?.language ?? "fr");

      // Avatar depuis Supabase Storage
      const { data: avatarData } = supabase.storage
        .from("avatars")
        .getPublicUrl(`${u.id}/profile.jpg`);
      setAvatarUrl(avatarData?.publicUrl ?? null);
      setGuestCount(gCount ?? 0);

      // Dernière connexion
      setLastLogin(u.last_sign_in_at ?? null);
    }
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Upload de l'avatar
  const uploadAvatar = async () => {
    if (!avatarFile || !user) return;
    setUploading(true);
    try {
      const ext = avatarFile.name.split(".").pop();
      const filePath = `${user.id}/profile.${ext}`;

      // Supprime l'ancien avatar s'il existe
      await supabase.storage.from("avatars").remove([`${user.id}/profile.jpg`, `${user.id}/profile.png`, `${user.id}/profile.webp`]);

      const { error } = await supabase.storage
        .from("avatars")
        .upload(filePath, avatarFile, { upsert: true });

      if (error) {
        toast.error(error.message);
        return;
      }

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      setAvatarUrl(urlData?.publicUrl ?? null);
      setAvatarFile(null);
      setAvatarPreview(null);
      toast.success("Photo de profil mise à jour");
    } catch {
      toast.error("Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  };

  // Sauvegarde des informations personnelles
  const saveProfile = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: firstName,
          last_name: lastName,
          phone,
          role,
          bio,
          theme,
          notifications,
          language,
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Profil mis à jour");

      if (avatarFile) {
        await uploadAvatar();
      }
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  // Changement de mot de passe
  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Mot de passe modifié avec succès");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast.error("Erreur lors du changement de mot de passe");
    } finally {
      setChangingPassword(false);
    }
  };

  // Déconnexion de tous les appareils
  const logoutAllDevices = async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Déconnecté de tous les appareils");
      setLogoutAllOpen(false);
      router.push("/login");
    } catch {
      toast.error("Erreur lors de la déconnexion");
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-gold" />
      </main>
    );
  }

  const tabs: { key: ProfileTab; label: string; icon: typeof User }[] = [
    { key: "profile", label: "Profil", icon: User },
    { key: "security", label: "Sécurité", icon: Shield },
    { key: "preferences", label: "Préférences", icon: Settings },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-gold"
      >
        <ArrowLeft className="size-4" />
        Tableau de bord
      </Link>

      <h1 className="mb-8 font-serif text-3xl text-deep-black">Mon profil</h1>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Barre latérale de navigation */}
        <nav className="flex gap-2 lg:flex-col lg:w-56" aria-label="Navigation du profil">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === key
                  ? "bg-gold/10 text-gold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              aria-current={activeTab === key ? "page" : undefined}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}

          {/* Stats rapides */}
          <div className="mt-6 hidden space-y-3 lg:block">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Statistiques
            </p>
            <div className="space-y-2 rounded-lg bg-muted/50 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Événements</span>
                <span className="font-semibold">{eventCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Invités</span>
                <span className="font-semibold">{guestCount}</span>
              </div>
              {lastLogin && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Dernière connexion</span>
                  <span className="text-xs">
                    {new Date(lastLogin).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* Contenu principal */}
        <div className="flex-1 space-y-6">
          {/* ===== Onglet Profil ===== */}
          {activeTab === "profile" && (
            <>
              {/* Photo de profil */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Camera className="size-5 text-gold" />
                    Photo de profil
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4 sm:flex-row">
                  <div className="relative group">
                    <div
                      className="flex size-28 items-center justify-center rounded-full text-3xl font-bold text-white shadow-md"
                      style={{
                        backgroundColor: stringToColor(email ?? "?"),
                      }}
                    >
                      {avatarPreview ? (
                        <img
                          src={avatarPreview}
                          alt="Aperçu"
                          className="size-28 rounded-full object-cover"
                        />
                      ) : avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt="Photo de profil"
                          className="size-28 rounded-full object-cover"
                        />
                      ) : (
                        (firstName?.[0] ?? email?.[0] ?? "?").toUpperCase()
                      )}
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Modifier la photo"
                    >
                      <Camera className="size-8 text-white" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setAvatarFile(file);
                          setAvatarPreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="text-sm font-medium">
                      {avatarFile ? "Nouvelle photo sélectionnée" : avatarUrl ? "Photo existante" : "Aucune photo"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      JPG, PNG ou WebP. 200×200px recommandé.
                    </p>
                    {avatarPreview && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => {
                          setAvatarFile(null);
                          setAvatarPreview(null);
                        }}
                      >
                        Annuler
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Informations personnelles */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="size-5 text-gold" />
                    Informations personnelles
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="first-name">Prénom</Label>
                      <Input
                        id="first-name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="last-name">Nom</Label>
                      <Input
                        id="last-name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-email">Email</Label>
                      <Input id="profile-email" value={email} disabled className="bg-muted/50" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone">Téléphone</Label>
                      <Input
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+33 6 12 34 56 78"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="role">Fonction</Label>
                      <Input
                        id="role"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        placeholder="Organisateur, Wedding Planner..."
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="bio">Bio / Présentation</Label>
                      <textarea
                        id="bio"
                        rows={3}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        className="h-auto w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
                        placeholder="Quelques mots sur vous..."
                      />
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <Button
                      onClick={saveProfile}
                      disabled={saving}
                      className="bg-gold text-white hover:bg-gold/90"
                    >
                      {saving ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 size-4" />
                      )}
                      Enregistrer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* ===== Onglet Sécurité ===== */}
          {activeTab === "security" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-gold" />
                  Sécurité
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Changement de mot de passe */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Changer le mot de passe</h3>
                  <div className="space-y-3">
                    <div className="relative space-y-1.5">
                      <Label htmlFor="old-password">Ancien mot de passe</Label>
                      <div className="relative">
                        <Input
                          id="old-password"
                          type={showOld ? "text" : "password"}
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowOld(!showOld)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                          aria-label={showOld ? "Masquer" : "Afficher"}
                        >
                          {showOld ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="relative space-y-1.5">
                      <Label htmlFor="new-password">Nouveau mot de passe</Label>
                      <div className="relative">
                        <Input
                          id="new-password"
                          type={showNew ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNew(!showNew)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                          aria-label={showNew ? "Masquer" : "Afficher"}
                        >
                          {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={changePassword}
                      disabled={changingPassword || !oldPassword || !newPassword || !confirmPassword}
                      className="bg-gold text-white hover:bg-gold/90"
                    >
                      {changingPassword ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : null}
                      Changer le mot de passe
                    </Button>
                  </div>
                </div>

                <hr className="border-border" />

                {/* Déconnexion multi-appareils */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Sessions actives</h3>
                  <p className="text-sm text-muted-foreground">
                    Déconnectez-vous de tous les autres appareils connectés à votre compte.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setLogoutAllOpen(true)}
                    className="text-destructive"
                  >
                    <LogOut className="mr-2 size-4" />
                    Déconnecter tous les appareils
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ===== Onglet Préférences ===== */}
          {activeTab === "preferences" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="size-5 text-gold" />
                  Préférences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label>Thème</Label>
                  <div className="flex gap-3">
                    {["light", "dark"].map((t) => (
                      <button
                        key={t}
                        onClick={() => setTheme(t)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-colors",
                          theme === t
                            ? "border-gold bg-gold/10 text-gold"
                            : "border-border hover:border-gold/50"
                        )}
                      >
                        <div
                          className={cn(
                            "size-4 rounded-full border-2",
                            theme === t ? "border-gold bg-gold" : "border-muted-foreground"
                          )}
                        />
                        {t === "light" ? "Clair" : "Sombre"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="lang">Langue</Label>
                  <select
                    id="lang"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm sm:w-48"
                  >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </select>
                </div>

                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={notifications}
                    onChange={(e) => setNotifications(e.target.checked)}
                    className="size-4 rounded border-border"
                  />
                  <div>
                    <span className="font-medium">Notifications</span>
                    <p className="text-xs text-muted-foreground">
                      Recevoir des notifications lors des check-ins importants
                    </p>
                  </div>
                </label>

                <div className="flex justify-end">
                  <Button
                    onClick={saveProfile}
                    disabled={saving}
                    className="bg-gold text-white hover:bg-gold/90"
                  >
                    {saving ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 size-4" />
                    )}
                    Enregistrer les préférences
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats mobiles (uniquement en bas sur mobile) */}
          <div className="rounded-lg bg-muted/50 p-4 lg:hidden">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Statistiques
            </p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-lg font-bold">{eventCount}</p>
                <p className="text-xs text-muted-foreground">Événements</p>
              </div>
              <div>
                <p className="text-lg font-bold">{guestCount}</p>
                <p className="text-xs text-muted-foreground">Invités</p>
              </div>
              <div>
                <p className="text-lg font-bold">
                  {lastLogin ? new Date(lastLogin).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Dernière connexion</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modale déconnexion multi-appareils */}
      <Dialog open={logoutAllOpen} onOpenChange={setLogoutAllOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Déconnecter tous les appareils ?</DialogTitle>
            <DialogDescription>
              Vous allez être déconnecté de tous les appareils, y compris celui-ci. Vous devrez vous reconnecter.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogoutAllOpen(false)}>
              Annuler
            </Button>
            <Button onClick={logoutAllDevices} className="bg-destructive text-white hover:bg-destructive/90">
              <LogOut className="mr-2 size-4" />
              Déconnecter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
