"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion, useReducedMotion } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";

// Schéma de validation du nouveau mot de passe
const resetSchema = z
  .object({
    password: z
      .string()
      .min(6, "Le mot de passe doit contenir au moins 6 caractères"),
    confirmPassword: z
      .string()
      .min(1, "Veuillez confirmer le mot de passe"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

type ResetForm = z.infer<typeof resetSchema>;

// Page de définition d'un nouveau mot de passe (après clic sur l'email de récupération)
export default function ResetPasswordPage() {
  const prefersReducedMotion = useReducedMotion();
  const router = useRouter();
  // Client Supabase créé une seule fois (état paresseux) — fix audit.
  const [supabase] = useState(() => createClient());
  const [checking, setChecking] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
  });

  // Vérifie que la session de récupération est valide (lien reçu par email)
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data.session) {
        setChecking(false);
        toast.error("Lien invalide ou expiré.");
        return;
      }
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Met à jour le mot de passe avec la session de récupération
  const onSubmit = async (data: ResetForm) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Mot de passe mis à jour. Vous pouvez vous connecter.");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Une erreur est survenue. Réessayez.");
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-off-white p-4">
      {/* Motif de fond subtil */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "radial-gradient(#C9A96E 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 40 }}
        animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 100 }}
        className="w-full max-w-md"
      >
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
                Nouveau mot de passe
              </CardTitle>
              <CardDescription>
                Choisissez un nouveau mot de passe pour votre compte
              </CardDescription>
              <div className="mx-auto mt-3 h-0.5 w-12 rounded-full bg-gold/60" />
            </CardHeader>

            {checking ? (
              <CardContent className="flex flex-col items-center justify-center gap-3 py-10">
                <Loader2 className="size-6 animate-spin text-gold" />
                <p className="text-sm text-muted-foreground">
                  Vérification du lien...
                </p>
              </CardContent>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="password">Nouveau mot de passe</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        autoComplete="new-password"
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
                    {errors.password && (
                      <p className="text-sm text-destructive">
                        {errors.password.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">
                      Confirmer le mot de passe
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirm ? "text" : "password"}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        {...register("confirmPassword")}
                        aria-invalid={!!errors.confirmPassword}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        tabIndex={-1}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-gold"
                        aria-label={
                          showConfirm
                            ? "Masquer le mot de passe"
                            : "Afficher le mot de passe"
                        }
                      >
                        {showConfirm ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-sm text-destructive">
                        {errors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3 pt-2">
                    <Button
                      type="submit"
                      className="w-full bg-gold text-deep-black hover:bg-gold/90"
                      disabled={isSubmitting}
                    >
                      {isSubmitting
                        ? "Mise à jour..."
                        : "Mettre à jour le mot de passe"}
                    </Button>
                    <Link
                      href="/login"
                      className="block text-center text-sm text-muted-foreground transition-colors hover:text-gold"
                    >
                      Retour à la connexion
                    </Link>
                  </div>
                </CardContent>
              </form>
            )}
          </Card>
        </div>
      </motion.div>
    </div>
  );
}