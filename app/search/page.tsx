"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { LoadingOverlay } from "@/components/loading-spinner";

export default function UserLookupPage() {
	const router = useRouter();
	const [userId, setUserId] = useState("");
	const [username, setUsername] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		if (!userId && !username) {
			setError("Please enter either a User ID or Username");
			return;
		}

		setLoading(true);

		const params = new URLSearchParams();
		if (userId) params.set("userId", userId);
		if (username) params.set("username", username);

		router.push(`/user?${params.toString()}`);
	};

	return (
		<div className="container flex flex-col items-center justify-center mx-auto px-4 py-12 max-w-2xl">
			{loading && <LoadingOverlay text="Loading..." />}
			<motion.header
				className="text-center mb-12"
				initial={{ opacity: 0, y: -20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
			>
				<h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent inline-block">
					Find User Stats
				</h1>
				<motion.p
					className="text-xl text-muted-foreground mt-4"
					initial={{ opacity: 0, scale: 0.95 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ duration: 0.5, delay: 0.3 }}
				>
					Search by AniList User ID or Username
				</motion.p>
			</motion.header>

			<motion.div
				className="search-container  bg-gradient-to-br from-background to-muted/50 p-8 rounded-2xl border"
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ type: "spring", stiffness: 100, damping: 20 }}
			>
				<form onSubmit={handleSubmit} className="space-y-6">
					{error && (
						<Alert variant="destructive">
							<Info className="h-4 w-4" />
							<AlertTitle>Error</AlertTitle>
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					<motion.div
						className="space-y-3"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.2 }}
					>
						<Label htmlFor="userId" className="text-lg">
							User ID
						</Label>
						<Input
							id="userId"
							value={userId}
							onChange={(e) => setUserId(e.target.value)}
							placeholder="Enter numeric AniList ID"
							className="bg-accent/20 hover:bg-accent/30 transition-colors"
						/>
					</motion.div>

					<motion.div
						className="space-y-3"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.4 }}
					>
						<div className="flex items-center justify-between">
							<Label htmlFor="username" className="text-lg">
								Username
							</Label>
							<span className="text-sm text-muted-foreground">Case insensitive</span>
						</div>
						<Input
							id="username"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							placeholder="Enter AniList username"
							className="bg-accent/20 hover:bg-accent/30 transition-colors"
						/>
					</motion.div>

					<motion.div
						className="pt-6"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.6 }}
					>
						<Button
							type="submit"
							size="lg"
							className="w-full text-lg transition-transform hover:scale-[1.02]"
						>
							View Stats
							<span className="ml-2">→</span>
						</Button>
					</motion.div>
				</form>
			</motion.div>

			<motion.p
				className="text-muted-foreground text-sm text-center mt-6"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.8 }}
			>
				Note: User ID search takes precedence when both fields are filled
			</motion.p>
		</div>
	);
}
