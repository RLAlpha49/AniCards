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
    <div className="container mx-auto max-w-4xl px-4 py-12">
      {/* Animated header section */}
      <motion.header
        className="mb-16 text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="inline-block bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-4xl font-bold text-transparent">
          Get in Touch
        </h1>
        <motion.p
          className="mt-4 text-xl text-gray-600 dark:text-gray-400"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          Connect with me through these platforms
        </motion.p>
      </motion.header>

      <div className="mx-auto grid max-w-2xl gap-12 md:grid-cols-1">
        {/* Social Connections */}
        <motion.div
          className="space-y-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <motion.div
            className="rounded-2xl border bg-gradient-to-br from-background to-muted/50 p-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
          >
            <h2 className="mb-6 text-center text-2xl font-semibold">
              Find Me On
            </h2>
            <div className="flex justify-center space-x-8">
              {[
                {
                  href: "https://discordid.netlify.app/?id=251479989378220044",
                  icon: SimpleDiscordIcon,
                  name: "discord",
                },
                {
                  href: "https://github.com/RLAlpha49",
                  icon: SimpleGithubIcon,
                  name: "github",
                  iconClass: "text-black dark:text-white",
                },
                {
                  href: "https://anilist.co/user/Alpha49",
                  icon: SimpleAniListIcon,
                  name: "anilist",
                },
              ].map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-full p-3 transition-all duration-300 hover:bg-muted/70 dark:hover:bg-muted/50"
                  onClick={() => handleSocialLinkClick(link.name)}
                  aria-label={`Visit my ${link.name} profile`}
                >
                  <link.icon
                    size={40}
                    className={`transition-transform group-hover:scale-110 ${link.iconClass || ""}`}
                  />
                </Link>
              ))}
            </div>
          </motion.div>

          <motion.div
            className="rounded-2xl border bg-gradient-to-br from-background to-muted/50 p-8 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              type: "spring",
              stiffness: 100,
              damping: 20,
              delay: 0.8,
            }}
          >
            <h2 className="mb-4 text-2xl font-semibold">Direct Contact</h2>
            <motion.p
              className="mb-4 text-gray-600 dark:text-gray-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1 }}
            >
              Feel free to reach out via email
            </motion.p>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-block"
            >
              <Button
                asChild
                variant="outline"
                className="mx-auto w-full max-w-xs"
              >
                <Link
                  href="mailto:contact@alpha49.com"
                  className="text-lg"
                  onClick={() => handleSocialLinkClick("email")}
                >
                  contact@alpha49.com
                </Link>
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
