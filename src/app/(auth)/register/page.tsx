"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
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

// Schéma de validation du formulaire d'inscription
const registerSchema = z
  .object({
    email: z.string().email("Adresse email invalide"),
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

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const prefersReducedMotion = useReducedMotion();
  const router = useRouter();
  const supabase = createClient();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  // Crée un nouveau compte utilisateur via Supabase Auth
  const onSubmit = async (data: RegisterForm) => {
    try {
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success(
        "Compte créé ! Vérifiez votre email pour confirmer l'inscription.",
      );
      router.push("/login");
    } catch (err) {
      // Capture les erreurs réseau inattendues
      toast.error("Une erreur est survenue lors de l'inscription.");
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

      {/* Carte d'inscription avec animation d'entrée */}
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
                Créez votre compte
              </CardDescription>
              {/* Ligne décorative dorée sous le titre */}
              <div className="mx-auto mt-3 h-0.5 w-12 rounded-full bg-gold/60" />
            </CardHeader>
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <CardContent className="space-y-5">
                <motion.div
                  variants={stagger}
                  initial={prefersReducedMotion ? false : "hidden"}
                  animate={prefersReducedMotion ? {} : "visible"}
                  className="space-y-5"
                >
                  {/* Champ Email */}
                  <motion.div variants={fadeUp} className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="vous@exemple.com"
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
                    <Label htmlFor="password">Mot de passe</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
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

                  {/* Champ Confirmation mot de passe avec toggle */}
                  <motion.div
                    variants={fadeUp}
                    className="space-y-2"
                  >
                    <Label htmlFor="confirm-password">
                      Confirmer le mot de passe
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={
                          showConfirmPassword ? "text" : "password"
                        }
                        placeholder="••••••••"
                        {...register("confirmPassword")}
                        aria-invalid={!!errors.confirmPassword}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        tabIndex={-1}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-gold"
                        aria-label={
                          showConfirmPassword
                            ? "Masquer le mot de passe"
                            : "Afficher le mot de passe"
                        }
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                    <AnimatePresence mode="wait">
                      {errors.confirmPassword && (
                        <motion.p
                          key="confirm-password-error"
                          {...errorAnimation}
                          transition={prefersReducedMotion ? { duration: 0 } : errorAnimation.transition}
                          className="text-sm text-destructive"
                        >
                          {errors.confirmPassword.message}
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
                    {isSubmitting
                      ? "Inscription..."
                      : "Créer un compte"}
                  </Button>
                </motion.div>
                <p className="text-sm text-muted-foreground">
                  Déjà un compte ?{" "}
                  <Link
                    href="/login"
                    className="text-gold transition-colors hover:underline"
                  >
                    Se connecter
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
