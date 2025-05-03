"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";
import { siDiscord, siAnilist } from "simple-icons";
import { motion } from "framer-motion";

// Custom component to render the Discord icon using Simple Icons.
const SimpleDiscordIcon = ({ size = 32 }: { size?: number }) => (
  <svg
    className="transition-transform group-hover:scale-110"
    role="img"
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={`#${siDiscord.hex}`}
  >
    <title>{siDiscord.title}</title>
    <path d={siDiscord.path} />
  </svg>
);

// Custom component to render the AniList icon using Simple Icons.
const SimpleAniListIcon = ({ size = 32 }: { size?: number }) => (
  <svg
    className="transition-transform group-hover:scale-110"
    role="img"
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={`#${siAnilist.hex}`}
  >
    <title>{siAnilist.title}</title>
    <path d={siAnilist.path} />
  </svg>
);

export default function ContactPage() {
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
          className="mt-4 text-xl text-muted-foreground"
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
                },
                {
                  href: "https://github.com/RLAlpha49",
                  icon: Github,
                },
                {
                  href: "https://anilist.co/user/Alpha49",
                  icon: SimpleAniListIcon,
                },
              ].map((link, index) => (
                <Link
                  key={index}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-full p-3 transition-all duration-300 hover:bg-muted/70 dark:hover:bg-muted/50"
                >
                  <link.icon
                    size={40}
                    className="transition-transform group-hover:scale-110"
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
              className="mb-4 text-muted-foreground"
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
                <Link href="mailto:contact@alpha49.com" className="text-lg">
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
