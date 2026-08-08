"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { useReceptionStore } from "@/lib/store/reception-store";
import { isSafeRedirect } from "@/lib/redirect";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";

// ===== Variantes d'animation Framer Motion =====
const cardEntrance = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, damping: 22, stiffness: 100 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, damping: 18, stiffness: 80 },
  },
};

const stagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

const errorAnimation = {
  initial: { opacity: 0, x: -12 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -12 },
  transition: { type: "spring" as const, damping: 10, stiffness: 180 },
};

// Schéma de validation du formulaire de connexion
const loginSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(1, "Le mot de passe est requis"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const prefersReducedMotion = useReducedMotion();
  const router = useRouter();
  // Client Supabase créé une seule fois (état paresseux) — fix audit.
  const [supabase] = useState(() => createClient());
  const [showPassword, setShowPassword] = useState(false);
  // Au montage, on purge le store local de la réception : un utilisateur qui
  // revient à l'écran de connexion (post-logout) ne doit pas laisser les
  // invités/actions de son précédent compte dans le stockage persistant
  // (fix audit : fuite inter-comptes). Navire vite côté localStorage.
  useEffect(() => {
    useReceptionStore.getState().clearAll();
  }, []);
  // Route d'origine (fournie par le proxy) pour y revenir après connexion
  // Seuls les chemins locaux sûrs sont acceptés (même logique que le callback)
  const nextPath =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("next")
      : null;
  const redirectTo = nextPath && isSafeRedirect(nextPath) ? nextPath : "/dashboard";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  // Soumet les identifiants à Supabase Auth
  const onSubmit = async (data: LoginForm) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        // Message d'erreur convivial selon le type d'échec
        const message = error.message.toLowerCase().includes("not confirmed")
          ? "Votre email n'est pas confirmé. Vérifiez votre boîte de réception."
          : "Email ou mot de passe incorrect.";
        toast.error(message);
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      // Capture les erreurs réseau inattendues
      toast.error("Une erreur est survenue lors de la connexion.");
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-off-white p-4">
      {/* Motif de fond subtil */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(#C9A96E 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Carte de connexion avec animation d'entrée */}
      <motion.div
        initial={prefersReducedMotion ? false : "hidden"}
        animate={prefersReducedMotion ? {} : "visible"}
        variants={cardEntrance}
        className="w-full max-w-md"
      >
        {/* Bordure dégradée dorée */}
        <div className="rounded-xl bg-gradient-to-br from-gold/40 via-gold/10 to-gold/40 p-[1px] shadow-lg shadow-gold/5">
          <Card className="w-full max-w-md rounded-[11px] border-0 bg-off-white shadow-none">
            <CardHeader className="text-center">
              <div className="mb-3 flex justify-center">
                <Image
                  src="/logo.svg"
                  alt="Guest Manager"
                  width={56}
                  height={56}
                  className="size-14"
                  priority
                />
              </div>
              <CardTitle className="font-serif text-3xl text-gold">
                Guest Manager
              </CardTitle>
              <CardDescription>
                Connectez-vous à votre espace
              </CardDescription>
              {/* Ligne décorative dorée sous le titre */}
              <div className="mx-auto mt-3 h-0.5 w-12 rounded-full bg-gold/60" />
            </CardHeader>
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <CardContent className="space-y-5">
                {/* Champ Email */}
                <motion.div
                  variants={stagger}
                  initial={prefersReducedMotion ? false : "hidden"}
                  animate={prefersReducedMotion ? {} : "visible"}
                  className="space-y-5"
                >
                  <motion.div variants={fadeUp} className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="vous@exemple.com"
                      autoComplete="email"
                      {...register("email")}
                      aria-invalid={!!errors.email}
                    />
                    <AnimatePresence mode="wait">
                      {errors.email && (
                        <motion.p
                          key="email-error"
                          {...errorAnimation}
                          transition={prefersReducedMotion ? { duration: 0 } : errorAnimation.transition}
                          className="text-sm text-destructive"
                        >
                          {errors.email.message}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* Champ Mot de passe avec toggle de visibilité */}
                  <motion.div variants={fadeUp} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Mot de passe</Label>
                      <Link
                        href="/forgot-password"
                        className="text-xs text-gold transition-colors hover:underline"
                      >
                        Mot de passe oublié ?
                      </Link>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        {...register("password")}
                        aria-invalid={!!errors.password}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-gold"
                        aria-label={
                          showPassword
                            ? "Masquer le mot de passe"
                            : "Afficher le mot de passe"
                        }
                      >
                        {showPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                    <AnimatePresence mode="wait">
                      {errors.password && (
                        <motion.p
                          key="password-error"
                          {...errorAnimation}
                          transition={prefersReducedMotion ? { duration: 0 } : errorAnimation.transition}
                          className="text-sm text-destructive"
                        >
                          {errors.password.message}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </motion.div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <motion.div
                  whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                  whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
                  className="w-full"
                >
                  <Button
                    type="submit"
                    className="w-full bg-gold text-deep-black transition-colors hover:bg-gold/90"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Connexion..." : "Se connecter"}
                  </Button>
                </motion.div>
                <p className="text-sm text-muted-foreground">
                  Pas encore de compte ?{" "}
                  <Link
                    href="/register"
                    className="text-gold transition-colors hover:underline"
                  >
                    Créer un compte
                  </Link>
                </p>
              </CardFooter>
            </form>
          </Card>
        </div>
      </motion.div>
    </div>
  );
}
