"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { trackExternalLinkClick } from "@/lib/utils/google-analytics";
import { usePageSEO } from "@/hooks/use-page-seo";
import {
  SimpleDiscordIcon,
  SimpleGithubIcon,
  SimpleAniListIcon,
} from "@/components/icons/simple-icons";
import { Mail, Sparkles, ArrowRight, MessageCircle } from "lucide-react";
import { GridPattern } from "../../components/ui/grid-pattern";

export default function ContactPage() {
  usePageSEO("contact");

  const handleSocialLinkClick = (platform: string) => {
    trackExternalLinkClick(platform, "contact_page");
  };

  const socialLinks = [
    {
      href: "https://discordid.netlify.app/?id=251479989378220044",
      icon: SimpleDiscordIcon,
      name: "discord",
      label: "Discord",
      description: "Chat with me directly",
      color: "bg-[#5865F2]",
      textColor: "text-white",
    },
    {
      href: "https://github.com/RLAlpha49",
      icon: SimpleGithubIcon,
      name: "github",
      label: "GitHub",
      description: "Check out my projects",
      color: "bg-[#333]",
      textColor: "text-white",
    },
    {
      href: "https://anilist.co/user/Alpha49",
      icon: SimpleAniListIcon,
      name: "anilist",
      label: "AniList",
      description: "See my anime & manga stats",
      color: "bg-[#02A9FF]",
      textColor: "text-white",
    },
  ];

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      <GridPattern className="z-0" includeGradients={true} />

      <div className="container relative z-10 mx-auto px-4 py-24">
        {/* Header */}
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center rounded-full border border-blue-200 bg-blue-50/80 px-4 py-1.5 text-sm font-medium text-blue-600 backdrop-blur-sm dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            <span>Let&apos;s Connect</span>
          </motion.div>

          <motion.h1
            className="mb-6 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-5xl md:text-6xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Get in{" "}
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Touch
            </span>
          </motion.h1>

          <motion.p
            className="text-lg text-slate-600 dark:text-slate-400"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Have a question, suggestion, or just want to say hi? I&apos;d love
            to hear from you.
          </motion.p>
        </div>

        {/* Content Grid */}
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
          {/* Social Platforms */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="h-full"
          >
            <Card className="h-full border-gray-200 bg-white/80 shadow-xl backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/80">
              <CardContent className="p-8">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Social Platforms
                  </h2>
                </div>
                <div className="space-y-4">
                  {socialLinks.map((link, index) => (
                    <motion.div
                      key={link.name}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.4 + index * 0.1 }}
                    >
                      <Link
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleSocialLinkClick(link.name)}
                        className="group flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:scale-[1.02] hover:shadow-md dark:border-gray-800 dark:bg-gray-800/50"
                      >
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-lg ${link.color} ${link.textColor} shadow-sm transition-transform group-hover:scale-110`}
                        >
                          <link.icon size={24} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900 dark:text-white">
                            {link.label}
                          </h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {link.description}
                          </p>
                        </div>
                        <ArrowRight className="h-5 w-5 text-slate-300 transition-transform group-hover:translate-x-1 dark:text-slate-600" />
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Direct Contact */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="h-full"
          >
            <Card className="h-full border-gray-200 bg-white/80 shadow-xl backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/80">
              <CardContent className="flex h-full flex-col items-center justify-center p-8 text-center">
                <div className="mb-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 p-6 text-white shadow-lg shadow-purple-500/20">
                  <Mail className="h-10 w-10" />
                </div>
                <h2 className="mb-3 text-2xl font-bold text-slate-900 dark:text-white">
                  Direct Contact
                </h2>
                <p className="mb-8 max-w-sm text-slate-600 dark:text-slate-400">
                  Prefer email? No problem. Send me a message and I&apos;ll get
                  back to you as soon as possible.
                </p>
                <Button
                  asChild
                  size="lg"
                  className="h-14 w-full max-w-xs rounded-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-lg font-semibold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl hover:shadow-blue-500/25"
                >
                  <Link
                    href="mailto:contact@alpha49.com"
                    onClick={() => handleSocialLinkClick("email")}
                  >
                    <Mail className="mr-2 h-5 w-5" />
                    contact@alpha49.com
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Footer Note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-16 text-center"
        >
          <div className="inline-block rounded-2xl border border-gray-200 bg-white/50 px-6 py-4 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/50">
            <p className="text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-900 dark:text-white">
                💡 Tip:
              </span>{" "}
              Found a bug or have a feature request? Feel free to open an issue
              on{" "}
              <Link
                href="https://github.com/RLAlpha49/AniCards/issues"
                target="_blank"
                className="font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                GitHub
              </Link>
              .
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
