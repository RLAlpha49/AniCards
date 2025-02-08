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
import type React from "react";

export default function HomePage() {
	const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);

	return (
		<div className="container mx-auto px-4 py-8">
			<header className="text-center mb-16">
				<h1 className="text-5xl font-bold mb-4">Welcome to Anicards</h1>
				<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
					Discover insights about your anime and manga journey with personalized stat
					cards!
				</p>
			</header>

			<section className="mb-16 text-center max-w-3xl mx-auto">
				<h2 className="text-3xl font-semibold mb-4">What is Anicards?</h2>
				<p className="text-lg mb-6">
					Anicards is an innovative app that transforms your Anilist data into beautiful,
					shareable stat cards. It provides a unique way to visualize your anime and manga
					consumption habits, preferences, and social activity.
				</p>
				<Button size="lg" onClick={() => setIsGeneratorOpen(true)}>
					Get Started
					<ChevronRight className="ml-2 h-5 w-5" />
				</Button>
			</section>

			<section className="mb-16">
				<h2 className="text-3xl font-semibold mb-8 text-center">Features</h2>
				<div className="flex flex-wrap justify-center gap-6">
					<FeatureCard
						className="w-full md:w-[400px]"
						icon={BarChart2}
						title="Comprehensive Stats"
						description="View detailed statistics about your anime and manga, including watch time, episode count, and score distribution."
					/>
					<FeatureCard
						className="w-full md:w-[400px]"
						icon={Users}
						title="Social Insights"
						description="Track your Anilist social activity, including followers, following, and engagement metrics."
					/>
					<FeatureCard
						className="w-full md:w-[400px]"
						icon={BookOpen}
						title="Manga Analysis"
						description="Dive deep into your manga reading habits with chapter and volume counts, mean scores, and more."
					/>
					<FeatureCard
						className="w-full md:w-[400px]"
						icon={Tag}
						title="Genre & Tag Breakdown"
						description="Discover your top anime and manga genres and tags to understand your preferences better."
					/>
					<FeatureCard
						className="w-full md:w-[400px]"
						icon={Mic}
						title="Voice Actor Highlights"
						description="Find out which voice actors appear most frequently in your favorite anime."
					/>
					<FeatureCard
						className="w-full md:w-[400px]"
						icon={Building2}
						title="Studio Insights"
						description="See which animation studios produce your most-watched anime."
					/>
					<FeatureCard
						className="w-full md:w-[400px]"
						icon={User}
						title="Staff Spotlight"
						description="Identify the directors, writers, and other staff members behind your favorite works."
					/>
					<FeatureCard
						className="w-full md:w-[400px]"
						icon={BookType}
						title="Manga Creator Focus"
						description="Explore the mangaka and staff responsible for your top-rated manga."
					/>
				</div>
			</section>

			<section className="text-center max-w-3xl mx-auto">
				<h2 className="text-3xl font-semibold mb-6">
					Ready to see your anime and manga journey in a new light?
				</h2>
				<Button size="lg" onClick={() => setIsGeneratorOpen(true)}>
					Create Your Anicards
					<ChevronRight className="ml-2 h-5 w-5" />
				</Button>
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
		<Card className={`${className || ""}`}>
			<CardHeader>
				<Icon className="h-10 w-10 mb-2 text-primary" />
				<CardTitle className="text-xl">{title}</CardTitle>
			</CardHeader>
			<CardContent>
				<p>{description}</p>
			</CardContent>
		</Card>
	);
}
