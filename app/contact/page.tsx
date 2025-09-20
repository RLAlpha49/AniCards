"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { trackExternalLinkClick } from "@/lib/utils/google-analytics";
import { usePageSEO } from "@/hooks/use-page-seo";
import {
  SimpleDiscordIcon,
  SimpleGithubIcon,
  SimpleAniListIcon,
} from "@/components/icons/simple-icons";

export default function ContactPage() {
  usePageSEO("contact");

  const handleSocialLinkClick = (platform: string) => {
    trackExternalLinkClick(platform, "contact_page");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 px-4 py-12 dark:from-gray-900 dark:via-slate-800 dark:to-blue-950">
      {/* Background decorative elements */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-80 w-80 rounded-full bg-gradient-to-br from-blue-400/20 to-purple-600/20 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-gradient-to-tr from-pink-400/20 to-orange-600/20 blur-3xl"></div>
        <div className="absolute left-1/2 top-1/2 h-60 w-60 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-purple-400/10 to-cyan-400/10 blur-3xl"></div>
      </div>

      <div className="container relative z-10 mx-auto max-w-4xl">
        {/* Animated header section */}
        <motion.header
          className="mb-16 text-center"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="mb-4 inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-blue-100 to-purple-100 px-6 py-2 dark:from-blue-900/30 dark:to-purple-900/30">
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Let&apos;s Connect
            </span>
          </div>
          <h1 className="mb-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-5xl font-bold text-transparent md:text-6xl">
            Get in Touch
          </h1>
          <motion.p
            className="mx-auto max-w-2xl text-xl leading-relaxed text-gray-600 dark:text-gray-300"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Ready to connect? Find me on these platforms or drop me a line
            directly
          </motion.p>
        </motion.header>

        <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
          {/* Social Connections */}
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <div className="rounded-3xl border-2 border-blue-100/50 bg-white/70 p-8 shadow-2xl backdrop-blur-xl dark:border-blue-900/30 dark:bg-gray-800/70">
              <div className="mb-6 text-center">
                <h2 className="mb-2 text-2xl font-bold text-gray-800 dark:text-gray-200">
                  Find Me On
                </h2>
                <div className="mx-auto h-1 w-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"></div>
              </div>

              <div className="grid gap-4">
                {[
                  {
                    href: "https://discordid.netlify.app/?id=251479989378220044",
                    icon: SimpleDiscordIcon,
                    name: "discord",
                    label: "Discord",
                    description: "Chat with me directly",
                    gradient: "from-gray-700 to-indigo-400",
                    bgGradient:
                      "from-gray-50 to-indigo-50 dark:from-gray-900/30 dark:to-indigo-950/30",
                  },
                  {
                    href: "https://github.com/RLAlpha49",
                    icon: SimpleGithubIcon,
                    name: "github",
                    label: "GitHub",
                    description: "Check out my projects",
                    iconClass: "text-black dark:text-white",
                    gradient: "from-gray-600 to-gray-800",
                    bgGradient:
                      "from-gray-50 to-gray-100 dark:from-gray-800/30 dark:to-gray-900/30",
                  },
                  {
                    href: "https://anilist.co/user/Alpha49",
                    icon: SimpleAniListIcon,
                    name: "anilist",
                    label: "AniList",
                    description: "See my anime & manga stats",
                    gradient: "from-cyan-700 to-blue-400",
                    bgGradient:
                      "from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30",
                  },
                ].map((link, index) => (
                  <motion.div
                    key={link.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.4 + index * 0.1 }}
                  >
                    <Link
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`group flex items-center gap-4 rounded-2xl border border-gray-200/50 bg-gradient-to-r p-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg dark:border-gray-700/50 ${link.bgGradient}`}
                      onClick={() => handleSocialLinkClick(link.name)}
                      aria-label={`Visit my ${link.name} profile`}
                    >
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r ${link.gradient} text-white shadow-lg`}
                      >
                        <link.icon
                          size={24}
                          className={`transition-transform group-hover:scale-110 ${link.iconClass || "text-white"}`}
                        />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800 dark:text-gray-200">
                          {link.label}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {link.description}
                        </p>
                      </div>
                      <div className="text-gray-400 transition-transform group-hover:translate-x-1 dark:text-gray-500">
                        →
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Direct Contact & Additional Info */}
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {/* Email Contact */}
            <div className="rounded-3xl border-2 border-purple-100/50 bg-white/70 p-8 shadow-2xl backdrop-blur-xl dark:border-purple-900/30 dark:bg-gray-800/70">
              <div className="mb-6 text-center">
                <h2 className="mb-2 text-2xl font-bold text-gray-800 dark:text-gray-200">
                  Direct Contact
                </h2>
                <div className="mx-auto h-1 w-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"></div>
              </div>

              <motion.div
                className="space-y-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.6 }}
              >
                <div className="rounded-2xl bg-gradient-to-r from-purple-50 to-pink-50 p-4 text-center dark:from-purple-950/20 dark:to-pink-950/20">
                  <p className="mb-4 text-gray-600 dark:text-gray-400">
                    🚀 Ready to collaborate or have questions about my projects?
                  </p>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="inline-block w-full"
                  >
                    <Button
                      asChild
                      className="w-full rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 px-8 py-6 text-lg font-semibold text-white shadow-lg transition-all duration-200 hover:from-purple-700 hover:via-pink-700 hover:to-red-700 hover:shadow-xl"
                    >
                      <Link
                        href="mailto:contact@alpha49.com"
                        onClick={() => handleSocialLinkClick("email")}
                      >
                        📧 contact@alpha49.com
                      </Link>
                    </Button>
                  </motion.div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Call to Action */}
        <motion.div
          className="mt-12 text-center"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
        >
          <div className="rounded-2xl border border-gray-200/50 bg-gradient-to-r from-blue-50/50 via-purple-50/50 to-pink-50/50 p-6 backdrop-blur-sm dark:border-gray-700/50 dark:from-blue-950/20 dark:via-purple-950/20 dark:to-pink-950/20">
            <p className="text-lg text-gray-600 dark:text-gray-300">
              <span className="font-semibold">💡 Tip:</span> Found a bug or have
              a feature request for AniCards?
              <br className="hidden sm:block" />
              Feel free to reach out or create an issue on GitHub!
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
