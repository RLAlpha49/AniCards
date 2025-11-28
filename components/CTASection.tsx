"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button, type ButtonProps } from "@/components/ui/Button";

export type CTAButton = Readonly<{
  label: React.ReactNode;
  href?: string;
  onClick?: () => void;
  asChild?: boolean;
  className?: string;
  variant?: ButtonProps["variant"];
  icon?: React.ReactNode;
}>;

type CTASectionProps = Readonly<{
  badge?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  primary?: CTAButton;
  secondary?: CTAButton;
  variant?: "light" | "dark";
  className?: string;
  maxWidth?: string;
}>;

export default function CTASection({
  badge,
  title,
  subtitle,
  primary,
  secondary,
  variant = "light",
  className = "",
  maxWidth = "max-w-4xl",
}: CTASectionProps) {
  const containerClass =
    variant === "dark"
      ? "relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-16 text-white shadow-2xl dark:from-slate-800 dark:to-slate-900 sm:px-12"
      : "rounded-3xl border border-slate-200/50 bg-gradient-to-br from-white/80 via-white/60 to-slate-100/80 p-8 text-center shadow-2xl shadow-slate-200/50 backdrop-blur-xl dark:border-slate-700/50 dark:from-slate-800/80 dark:via-slate-800/60 dark:to-slate-900/80 dark:shadow-slate-900/50 sm:p-12 lg:p-16";

  const renderButton = (btn?: CTAButton) => {
    if (!btn) return null;
    const common: Partial<ButtonProps> = {
      size: "lg",
      className: btn.className ?? undefined,
    };

    if (btn.asChild && btn.href) {
      return (
        <Button
          {...common}
          asChild
          className={btn.className}
          variant={btn.variant ?? undefined}
        >
          <Link href={btn.href} onClick={btn.onClick}>
            <span className="flex items-center justify-center gap-2">
              {btn.label}
              {btn.icon}
            </span>
          </Link>
        </Button>
      );
    }

    return (
      <Button
        {...common}
        onClick={btn.onClick}
        variant={btn.variant ?? "default"}
        className={btn.className}
      >
        <span className="flex items-center justify-center gap-2">
          {btn.label}
          {btn.icon}
        </span>
      </Button>
    );
  };

  return (
    <section className={`relative w-full overflow-hidden ${className}`}>
      <div className="container relative mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className={`mx-auto ${maxWidth}`}
        >
          <div className={containerClass}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="space-y-6"
            >
              {badge}

              <h2
                className={`${
                  variant === "dark"
                    ? "text-3xl font-bold sm:text-4xl"
                    : "text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl lg:text-4xl"
                }`}
              >
                {title}
              </h2>

              {subtitle && (
                <p
                  className={`${
                    variant === "dark"
                      ? "mb-8 text-lg text-slate-300"
                      : "mx-auto max-w-2xl text-lg text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {subtitle}
                </p>
              )}

              <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
                {primary && renderButton(primary)}
                {secondary && renderButton(secondary)}
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
