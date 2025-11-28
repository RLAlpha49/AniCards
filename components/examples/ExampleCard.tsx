"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ImageWithSkeleton } from "@/components/ImageWithSkeleton";
import { Play, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface CardVariant {
  name: string;
  url: string;
  description?: string;
}

interface ExampleCardProps {
  variant: CardVariant;
  cardTypeTitle: string;
  gradient: string;
  onOpenGenerator: () => void;
  index?: number;
}

export function ExampleCard({
  variant,
  cardTypeTitle,
  gradient,
  onOpenGenerator,
  index = 0,
}: Readonly<ExampleCardProps>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="group w-full"
    >
      <Card className="overflow-hidden border-0 bg-white/80 shadow-lg shadow-slate-200/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:bg-slate-800/80 dark:shadow-slate-900/50">
        <CardContent className="p-0">
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-100 to-slate-50 p-6 dark:from-slate-900 dark:to-slate-800">
            <div
              className={cn(
                "absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-r opacity-20 blur-2xl transition-all group-hover:scale-150 group-hover:opacity-30",
                gradient,
              )}
            />

            <div className="relative flex items-center justify-center">
              <ImageWithSkeleton
                src={variant.url}
                alt={`${cardTypeTitle} - ${variant.name}`}
                className="h-auto w-full rounded-lg shadow-sm transition-transform duration-300 group-hover:scale-[1.02]"
              />
            </div>

            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/0 transition-colors duration-300 group-hover:bg-slate-900/60">
              <Button
                onClick={onOpenGenerator}
                className="translate-y-4 rounded-full bg-white text-slate-900 opacity-0 shadow-lg transition-all duration-300 hover:bg-slate-100 group-hover:translate-y-0 group-hover:opacity-100"
              >
                <Play className="mr-2 h-4 w-4 fill-current" />
                Create This Card
              </Button>
            </div>
          </div>

          <div className="p-5">
            <div className="mb-2 flex items-start justify-between gap-2">
              <h4 className="font-bold text-slate-900 dark:text-white">
                {variant.name}
              </h4>
              <a
                href={variant.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-slate-400 transition-colors hover:text-blue-600 dark:text-slate-500 dark:hover:text-blue-400"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {cardTypeTitle}
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
