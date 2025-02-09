"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
	ChevronRight,
	BarChart2,
	Users,
	BookOpen,
	Tag,
	Mic,
	Building2,
	User,
	BookType,
} from "lucide-react";
import { StatCardGenerator } from "@/components/stat-card-generator";
import { motion } from "framer-motion";
import type React from "react";

export default function HomePage() {
	const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);

	return (
		<div className="container mx-auto px-4 py-8">
			<header className="text-center mb-16">
				<motion.div
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5 }}
				>
					<h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent inline-block">
						Welcome to Anicards
					</h1>
				</motion.div>
				<motion.p
					className="text-xl text-muted-foreground max-w-2xl mx-auto"
					initial={{ opacity: 0, scale: 0.95 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ duration: 0.5, delay: 0.3 }}
				>
					Discover insights about your anime and manga journey with personalized stat
					cards!
				</motion.p>
			</header>

			<section className="mb-16 text-center max-w-3xl mx-auto">
				<motion.h2
					className="text-3xl font-semibold mb-4"
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.4 }}
				>
					What is Anicards?
				</motion.h2>
				<motion.p
					className="text-lg mb-6"
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.6 }}
				>
					Anicards is an app that transforms your Anilist data into beautiful, shareable
					stat cards. It provides a unique way to visualize your anime and manga
					consumption habits, preferences, and social activity.
				</motion.p>
				<motion.div
					initial={{ opacity: 0, scale: 0.9 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ duration: 0.5, delay: 0.8 }}
				>
					<Button
						size="lg"
						onClick={() => setIsGeneratorOpen(true)}
						className="transition-transform duration-200 hover:scale-[1.02] transform-gpu"
					>
						Get Started
						<ChevronRight className="ml-2 h-5 w-5" />
					</Button>
				</motion.div>
			</section>

			<section className="mb-16">
				<h2 className="text-3xl font-semibold mb-8 text-center">Features</h2>
				<div className="flex flex-wrap justify-center gap-6">
					{[
						{
							icon: BarChart2,
							title: "Comprehensive Stats",
							description:
								"View detailed statistics about your anime and manga, including watch time, episode count, and score distribution.",
						},
						{
							icon: Users,
							title: "Social Insights",
							description:
								"Track your Anilist social activity, including followers, following, and engagement metrics.",
						},
						{
							icon: BookOpen,
							title: "Manga Analysis",
							description:
								"Dive deep into your manga reading habits with chapter and volume counts, mean scores, and more.",
						},
						{
							icon: Tag,
							title: "Genre & Tag Breakdown",
							description:
								"Discover your top anime and manga genres and tags to understand your preferences better",
						},
						{
							icon: Mic,
							title: "Voice Actor Highlights",
							description:
								"Find out which voice actors appear most frequently in your anime.",
						},
						{
							icon: Building2,
							title: "Studio Insights",
							description:
								"See which animation studios produce your most-watched anime.",
						},
						{
							icon: User,
							title: "Staff Spotlight",
							description:
								"Identify the directors, writers, and other staff members behind your anime.",
						},
						{
							icon: BookType,
							title: "Manga Creator Focus",
							description:
								"Explore the mangaka and staff responsible for your manga.",
						},
					].map((feature, index) => (
						<motion.div
							key={feature.title}
							className="w-full md:w-[400px]"
							initial={{ opacity: 0, y: 20, scale: 0.95 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							transition={{
								type: "spring",
								stiffness: 100,
								damping: 20,
								delay: 0.1 * index,
							}}
							whileHover={{
								scale: 1.02,
								transition: { duration: 0.2 },
							}}
						>
							<FeatureCard
								icon={feature.icon}
								title={feature.title}
								description={feature.description}
								className="hover:shadow-lg transition-shadow duration-300"
							/>
						</motion.div>
					))}
				</div>
			</section>

			<section className="text-center max-w-3xl mx-auto">
				<motion.h2
					className="text-3xl font-semibold mb-6"
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 1.6 }}
				>
					Ready to see your anime and manga journey in a new light?
				</motion.h2>
				<motion.div
					whileHover={{ scale: 1.05 }}
					whileTap={{ scale: 0.95 }}
					className="inline-block"
				>
					<Button
						size="lg"
						onClick={() => setIsGeneratorOpen(true)}
						className="transition-transform duration-200 hover:scale-[1.02] transform-gpu"
					>
						Create Your Anicards
						<ChevronRight className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
					</Button>
				</motion.div>
			</section>

			<StatCardGenerator
				isOpen={isGeneratorOpen}
				onClose={() => setIsGeneratorOpen(false)}
				className={`transition-opacity duration-300 ${
					isGeneratorOpen ? "opacity-100" : "opacity-0"
				}`}
			/>
		</div>
	);
}

interface FeatureCardProps {
	icon: React.ElementType;
	title: string;
	description: string;
	className?: string;
}

function FeatureCard({ icon: Icon, title, description, className }: FeatureCardProps) {
	return (
		<motion.div whileHover={{ y: -5 }}>
			<Card className={`${className || ""} relative overflow-hidden group`}>
				<motion.div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
				<CardHeader>
					<motion.div
						className="inline-block"
						whileHover={{ rotate: 15, scale: 1.1 }}
						transition={{ type: "spring" }}
					>
						<Icon className="h-10 w-10 mb-2 text-primary transition-colors duration-300 group-hover:text-blue-600" />
					</motion.div>
					<CardTitle className="text-xl">{title}</CardTitle>
				</CardHeader>
				<CardContent>
					<motion.p
						className="text-muted-foreground"
						whileHover={{ color: "hsl(var(--foreground))" }}
					>
						{description}
					</motion.p>
				</CardContent>
			</Card>
		</motion.div>
	);
}
