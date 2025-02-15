"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export default function ProjectsPage() {
	const projects = [
		{
			name: "Anilist Custom List Manager",
			description:
				"Manage your custom lists on Anilist and automatically set your entries to them based on conditions you set.",
			url: "https://github.com/RLAlpha49/Anilist-Custom-List-Manager",
		},
		{
			name: "Kenmai to Anilist",
			description:
				"A simple application to update your Anilist entries from a Kenmai export file.",
			url: "https://github.com/RLAlpha49/Anilist-Manga-Updater",
		},
		{
			name: "AniSearch",
			description:
				"Uses machine learning and a given description to find the most relevant anime or manga.",
			url: "https://github.com/RLAlpha49/AniSearch",
		},
		{
			name: "Spotify Skip Tracker",
			description: "A simple application to track your Spotify skips.",
			url: "https://github.com/RLAlpha49/SpotifySkipTracker",
		},
	];

	return (
		<div className="container mx-auto px-4 py-8">
			<motion.header
				initial={{ opacity: 0, y: -20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
				className="text-center mb-8"
			>
				<h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent inline-block leading-snug">
					My Other Projects
				</h1>
				<p className="text-xl text-muted-foreground mt-4 leading-snug">
					Check out some of my other projects below.
				</p>
			</motion.header>

			<div className="grid gap-6 justify-items-center">
				{projects.map((project, index) => (
					<motion.div
						key={index}
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: index * 0.1 }}
						className="border rounded-lg p-6 shadow-sm hover:shadow-lg transition-shadow bg-background/50 w-1/2"
					>
						<h2 className="text-2xl font-semibold">{project.name}</h2>
						<p className="mt-2 text-muted-foreground">{project.description}</p>
						<div className="mt-4">
							<a
								href={project.url}
								target="_blank"
								rel="noopener noreferrer"
								className="text-blue-600 hover:underline"
							>
								Visit Project
							</a>
						</div>
					</motion.div>
				))}
			</div>

			<div className="mt-8 text-center">
				<Link href="/">
					<Button variant="outline">Go Back Home</Button>
				</Link>
			</div>
		</div>
	);
}
