"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/loading-spinner";

export default function LicensePage() {
	const [licenseText, setLicenseText] = useState("");
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchLicense = async () => {
			try {
				const response = await fetch(
					"https://raw.githubusercontent.com/RLAlpha49/Anicards/main/LICENSE"
				);

				if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

				const text = await response.text();
				setLicenseText(text);
				setError(null);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load license");
			} finally {
				setIsLoading(false);
			}
		};

		fetchLicense();
	}, []);

	return (
		<div className="container mx-auto px-4 py-8 max-w-3xl">
			{/* Animated header section */}
			<motion.header
				initial={{ opacity: 0, y: -20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
				className="text-center mb-8"
			>
				<h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent inline-block">
					Software License
				</h1>
				<p className="text-xl text-muted-foreground">
					MIT License - Open Source Initiative
				</p>
			</motion.header>

			{/* License content with motion effects */}
			<motion.div
				initial={{ opacity: 0, scale: 0.95 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ duration: 0.5, delay: 0.2 }}
				className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 max-w-2xl mx-auto"
			>
				<div className="mb-6 flex items-center justify-between">
					<div className="flex items-center space-x-2">
						<FileText className="h-6 w-6 text-primary" />
						<h2 className="text-2xl font-semibold">MIT License</h2>
					</div>
					<Button asChild variant="outline">
						<Link
							href="https://github.com/RLAlpha49/Anicards/blob/main/LICENSE"
							target="_blank"
							rel="noopener noreferrer"
						>
							View on GitHub
						</Link>
					</Button>
				</div>

				{isLoading ? (
					<div className="flex justify-center p-8">
						<LoadingSpinner text="Loading license..." />
					</div>
				) : error ? (
					<Alert variant="destructive" className="mb-4">
						<AlertCircle className="h-4 w-4" />
						<span>{error}</span>
						<Button
							variant="outline"
							className="ml-4"
							onClick={() => window.location.reload()}
						>
							Retry
						</Button>
					</Alert>
				) : (
					<pre className="whitespace-pre-wrap font-mono text-sm p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 max-w-full overflow-x-auto">
						{licenseText}
					</pre>
				)}
			</motion.div>
		</div>
	);
}
