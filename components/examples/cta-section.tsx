"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Sparkles } from "lucide-react";

interface CTASectionProps {
  onOpenGenerator: () => void;
}

export function CTASection({ onOpenGenerator }: Readonly<CTASectionProps>) {
  return (
    <section className="relative w-full overflow-hidden py-24 lg:py-32">
      {/* Background gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-3xl" />
        <div className="absolute -right-1/4 bottom-0 h-[500px] w-[500px] rounded-full bg-gradient-to-r from-pink-500/20 to-orange-500/20 blur-3xl" />
      </div>

      <div className="container relative mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-4xl"
        >
          <div className="rounded-3xl border border-slate-200/50 bg-gradient-to-br from-white/80 via-white/60 to-slate-100/80 p-8 text-center shadow-2xl shadow-slate-200/50 backdrop-blur-xl dark:border-slate-700/50 dark:from-slate-800/80 dark:via-slate-800/60 dark:to-slate-900/80 dark:shadow-slate-900/50 sm:p-12 lg:p-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="space-y-6"
            >
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
              >
                <span className="inline-flex items-center gap-2 rounded-full border border-blue-200/50 bg-blue-50/80 px-4 py-2 text-sm font-medium text-blue-700 dark:border-blue-700/50 dark:bg-blue-950/50 dark:text-blue-300">
                  <Sparkles className="h-4 w-4" />
                  Start Creating
                </span>
              </motion.div>

              <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl">
                Ready to Create{" "}
                <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Your Own Cards
                </span>
                ?
              </h2>

              <p className="mx-auto max-w-2xl text-lg text-slate-600 dark:text-slate-300">
                These examples use real data from{" "}
                <a
                  href="https://anilist.co/user/Alpha49"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  @Alpha49
                </a>
                . Generate your personalized cards with your own AniList
                statistics in seconds!
              </p>

              <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
                <Button
                  size="lg"
                  onClick={onOpenGenerator}
                  className="group h-14 min-w-[220px] rounded-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-lg font-semibold shadow-lg shadow-purple-500/25 transition-all hover:scale-105 hover:shadow-xl hover:shadow-purple-500/30"
                >
                  <Play className="mr-2 h-5 w-5 fill-current" />
                  Create Your Cards
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Button>

                <Link href="/search">
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-14 min-w-[180px] rounded-full border-2 text-lg font-medium"
                  >
                    Browse User Cards
                  </Button>
                </Link>
              </div>

              <p className="pt-4 text-sm text-slate-500 dark:text-slate-400">
                ✨ Free forever • No account needed • Instant generation
              </p>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
