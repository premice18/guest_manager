"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Users,
  LayoutDashboard,
  QrCode,
  FileText,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

// ===== Variantes d'animation Framer Motion =====
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, damping: 20, stiffness: 100 },
  },
};

const fadeUpDelayed = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      damping: 18,
      stiffness: 80,
      delay: 0.2,
    },
  },
};

const stagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15 },
  },
};

const staggerFast = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

// Page d'accueil vitrine pour Guest Manager
export default function LandingPage() {
  const prefersReducedMotion = useReducedMotion();
  const router = useRouter();
  const supabase = createClient();
  const [isChecking, setIsChecking] = useState(true);

  // Vérification de session côté client (remplace le serveur asynchrone)
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.push("/dashboard");
      }
      setIsChecking(false);
    };
    checkUser();
  }, [router, supabase]);

  // Écran de chargement le temps de vérifier la session
  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-off-white">
        <div className="size-10 animate-spin rounded-full border-[3px] border-gold/20 border-t-gold" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-off-white">
      {/* ===== Header / Navigation ===== */}
      <header className="border-b border-border bg-white/80 backdrop-blur-sm transition-colors">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 transition-colors hover:opacity-80"
          >
            <Image
              src="/logo.svg"
              alt="Guest Manager"
              width={40}
              height={40}
              className="size-10"
              priority
            />
            <span className="font-serif text-xl text-gold sm:text-2xl">
              Guest Manager
            </span>
          </Link>

          {/* Navigation : liens vers connexion et inscription */}
          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-anthracite transition-colors hover:bg-muted sm:inline-block"
            >
              Se connecter
            </Link>
            <Link href="/register">
              <Button size="sm">S&rsquo;inscrire</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* ===== Hero Section avec animations d'entrée ===== */}
        <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24 lg:pt-32">
          {/* Éléments décoratifs flottants */}
          <motion.div
            animate={prefersReducedMotion ? {} : { y: [0, -12, 0] }}
            transition={{
              repeat: Infinity,
              duration: 4,
              ease: "easeInOut",
            }}
            className="pointer-events-none absolute -right-32 -top-32 size-96 rounded-full bg-gold/5 blur-3xl"
          />
          <motion.div
            animate={prefersReducedMotion ? {} : { y: [0, 12, 0] }}
            transition={{
              repeat: Infinity,
              duration: 5,
              ease: "easeInOut",
            }}
            className="pointer-events-none absolute -bottom-32 -left-32 size-96 rounded-full bg-gold/5 blur-3xl"
          />

          <motion.div
            initial={prefersReducedMotion ? false : "hidden"}
            animate={prefersReducedMotion ? {} : "visible"}
            variants={stagger}
            className="relative mx-auto max-w-4xl text-center"
          >
            {/* Badge "Nouveau" avec animation pulse */}
            <motion.div
              variants={fadeUp}
              animate={prefersReducedMotion ? {} : { scale: [1, 1.03, 1] }}
              transition={{
                repeat: Infinity,
                duration: 3,
                ease: "easeInOut",
                delay: 1,
              }}
              className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-xs font-medium text-gold transition-colors"
            >
              <Sparkles className="size-3.5" />
              Application haut de gamme pour vos réceptions
            </motion.div>

            {/* Titre principal */}
            <motion.h1
              variants={fadeUp}
              className="font-serif text-4xl leading-tight text-deep-black sm:text-5xl lg:text-6xl"
            >
              Guest Manager
            </motion.h1>

            {/* Sous-titre doré */}
            <motion.p
              variants={fadeUp}
              className="mt-4 font-serif text-xl text-gold sm:text-2xl"
            >
              L&rsquo;art de recevoir, simplifié.
            </motion.p>

            {/* Description */}
            <motion.p
              variants={fadeUp}
              className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-anthracite sm:text-lg"
            >
              Organisez vos événements avec élégance : gérez vos
              invités, créez votre plan de table et accueillez en temps
              réel, le tout depuis une interface raffinée.
            </motion.p>

            {/* Appels à l'action avec micro-interactions */}
            <motion.div
              variants={fadeUp}
              className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
            >
              <Link href="/register">
                <motion.div
                  whileHover={prefersReducedMotion ? {} : { scale: 1.03 }}
                  whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}
                >
                  <Button
                    size="lg"
                    className="w-full bg-gold text-deep-black transition-colors hover:bg-gold/90 sm:w-auto"
                  >
                    Créer un compte
                    <ArrowRight className="ml-2 size-4" />
                  </Button>
                </motion.div>
              </Link>
              <Link href="/login">
                <motion.div
                  whileHover={prefersReducedMotion ? {} : { scale: 1.03 }}
                  whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}
                >
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full transition-colors sm:w-auto"
                  >
                    Déjà un compte
                  </Button>
                </motion.div>
              </Link>
            </motion.div>
          </motion.div>
        </section>

        {/* ===== Section Fonctionnalités avec cartes animées ===== */}
        <section className="px-4 pb-20 sm:px-6 sm:pb-28">
          <div className="mx-auto max-w-6xl">
            {/* Titre de section */}
            <motion.div
              initial={prefersReducedMotion ? false : "hidden"}
              whileInView={prefersReducedMotion ? {} : "visible"}
              viewport={{ once: true }}
              variants={stagger}
              className="mb-12 text-center sm:mb-16"
            >
              <motion.h2
                variants={fadeUp}
                className="font-serif text-3xl text-deep-black sm:text-4xl"
              >
                Tout ce qu&rsquo;il vous faut
              </motion.h2>
              <motion.p
                variants={fadeUpDelayed}
                className="mt-3 text-muted-foreground"
              >
                Une suite d&rsquo;outils pensés pour les organisateurs
                exigeants
              </motion.p>
            </motion.div>

            {/* Grille des cartes fonctionnalités avec stagger */}
            <motion.div
              initial={prefersReducedMotion ? false : "hidden"}
              whileInView={prefersReducedMotion ? {} : "visible"}
              viewport={{ once: true, margin: "-50px" }}
              variants={staggerFast}
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
            >
              {/* Carte 1 : Gestion des invités */}
              <motion.div
                variants={fadeUp}
                whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
              >
                <Card className="group border-border/60 bg-white shadow-sm transition-all duration-300 hover:shadow-md hover:border-l-2 hover:border-l-gold">
                  <CardHeader>
                    <div className="mb-3 flex size-12 items-center justify-center rounded-lg bg-gold/10 transition-colors group-hover:bg-gold/20">
                      <Users className="size-6 text-gold transition-colors" />
                    </div>
                    <CardTitle className="text-lg">
                      Gestion des invités
                    </CardTitle>
                    <CardDescription>
                      Importez, catégorisez et organisez vos listes
                      (singletons, couples, familles).
                    </CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>

              {/* Carte 2 : Plan de salle intuitif */}
              <motion.div
                variants={fadeUp}
                whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
              >
                <Card className="group border-border/60 bg-white shadow-sm transition-all duration-300 hover:shadow-md hover:border-l-2 hover:border-l-gold">
                  <CardHeader>
                    <div className="mb-3 flex size-12 items-center justify-center rounded-lg bg-gold/10 transition-colors group-hover:bg-gold/20">
                      <LayoutDashboard className="size-6 text-gold transition-colors" />
                    </div>
                    <CardTitle className="text-lg">
                      Plan de salle intuitif
                    </CardTitle>
                    <CardDescription>
                      Placez vos invités par glisser-déposer sur des
                      tables personnalisables.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>

              {/* Carte 3 : Check-in temps réel */}
              <motion.div
                variants={fadeUp}
                whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
              >
                <Card className="group border-border/60 bg-white shadow-sm transition-all duration-300 hover:shadow-md hover:border-l-2 hover:border-l-gold">
                  <CardHeader>
                    <div className="mb-3 flex size-12 items-center justify-center rounded-lg bg-gold/10 transition-colors group-hover:bg-gold/20">
                      <QrCode className="size-6 text-gold transition-colors" />
                    </div>
                    <CardTitle className="text-lg">
                      Check-in temps réel
                    </CardTitle>
                    <CardDescription>
                      Accueillez vos invités en un clic, synchronisation
                      instantanée sur toutes les tablettes.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>

              {/* Carte 4 : Exports professionnels */}
              <motion.div
                variants={fadeUp}
                whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
              >
                <Card className="group border-border/60 bg-white shadow-sm transition-all duration-300 hover:shadow-md hover:border-l-2 hover:border-l-gold">
                  <CardHeader>
                    <div className="mb-3 flex size-12 items-center justify-center rounded-lg bg-gold/10 transition-colors group-hover:bg-gold/20">
                      <FileText className="size-6 text-gold transition-colors" />
                    </div>
                    <CardTitle className="text-lg">
                      Exports professionnels
                    </CardTitle>
                    <CardDescription>
                      Générez des PDF pour le traiteur, le
                      maître d&rsquo;hôtel ou le staff.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ===== Section Call-to-Action finale ===== */}
        <section className="bg-deep-black px-4 py-16 sm:py-24">
          <motion.div
            initial={prefersReducedMotion ? false : "hidden"}
            whileInView={prefersReducedMotion ? {} : "visible"}
            viewport={{ once: true }}
            variants={stagger}
            className="mx-auto max-w-3xl text-center"
          >
            <motion.h2
              variants={fadeUp}
              className="font-serif text-3xl text-white sm:text-4xl"
            >
              Prêt à révolutionner vos réceptions ?
            </motion.h2>
            <motion.p
              variants={fadeUpDelayed}
              className="mt-4 text-lg text-white/70"
            >
              Rejoignez les organisateurs qui font confiance à Guest
              Manager pour des événements d&rsquo;exception.
            </motion.p>
            <motion.div
              variants={fadeUp}
              className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
            >
              <Link href="/register">
                <motion.div
                  whileHover={prefersReducedMotion ? {} : { scale: 1.03 }}
                  whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}
                >
                  <Button
                    size="lg"
                    className="w-full bg-gold text-deep-black transition-colors hover:bg-gold/90 sm:w-auto"
                  >
                    Commencer gratuitement
                    <ArrowRight className="ml-2 size-4" />
                  </Button>
                </motion.div>
              </Link>
              <Link href="/login">
                <motion.div
                  whileHover={prefersReducedMotion ? {} : { scale: 1.03 }}
                  whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}
                >
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full border-white/20 text-white transition-colors hover:bg-white/10 sm:w-auto"
                  >
                    Se connecter
                  </Button>
                </motion.div>
              </Link>
            </motion.div>
          </motion.div>
        </section>
      </main>

      {/* ===== Footer ===== */}
      <footer className="border-t border-border bg-white px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-gold" />
            <span className="font-serif text-sm text-gold">
              Guest Manager
            </span>
          </div>
          <nav className="flex gap-6 text-sm text-muted-foreground">
            <Link
              href="/login"
              className="transition-colors hover:text-gold"
            >
              Connexion
            </Link>
            <Link
              href="/register"
              className="transition-colors hover:text-gold"
            >
              Inscription
            </Link>
          </nav>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Guest Manager. Tous
            droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
}
