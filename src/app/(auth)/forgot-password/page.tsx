"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowLeft, MailCheck } from "lucide-react";

// Schéma de validation de l'email de récupération
const forgotSchema = z.object({
  email: z.string().email("Adresse email invalide"),
});

type ForgotForm = z.infer<typeof forgotSchema>;

// Page de récupération de mot de passe : envoie un email de réinitialisation
export default function ForgotPasswordPage() {
  const prefersReducedMotion = useReducedMotion();
  const router = useRouter();
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
  });

  // Envoie l'email de réinitialisation via Supabase Auth
  const onSubmit = async (data: ForgotForm) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Un email de réinitialisation vous a été envoyé.");
      router.push("/login");
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
                Mot de passe oublié
              </CardTitle>
              <CardDescription>
                Saisissez votre email pour recevoir un lien de réinitialisation
              </CardDescription>
              <div className="mx-auto mt-3 h-0.5 w-12 rounded-full bg-gold/60" />
            </CardHeader>
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <div className="mb-2 flex items-start gap-2 text-sm text-muted-foreground">
                    <MailCheck className="mt-0.5 size-4 shrink-0 text-gold" />
                    <span>
                      Vous recevrez un email avec un lien sécurisé pour définir
                      un nouveau mot de passe.
                    </span>
                  </div>
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
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -12 }}
                        transition={prefersReducedMotion ? { duration: 0 } : { type: "tween" as const }}
                        className="text-sm text-destructive"
                      >
                        {errors.email.message}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
                <div className="space-y-3 pt-2">
                  <Button
                    type="submit"
                    className="w-full bg-gold text-deep-black hover:bg-gold/90"
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? "Envoi en cours..."
                      : "Envoyer le lien de réinitialisation"}
                  </Button>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-gold"
                  >
                    <ArrowLeft className="size-4" />
                    Retour à la connexion
                  </Link>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      </motion.div>
    </div>
  );
}