"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function UserLookupPage() {
	const router = useRouter();
	const [input, setInput] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError("");

		try {
			// Check if input is numeric ID
			if (/^\d+$/.test(input)) {
				router.push(`/user?userId=${input}`);
			} else {
				setError("Invalid user ID");
			}
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
		} catch (err) {
			setError("Invalid user ID");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="container mx-auto p-4 max-w-md">
			<form onSubmit={handleSubmit} className="space-y-4">
				<div>
					<label className="block text-sm font-medium mb-2">AniList User ID</label>
					<input
						type="text"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
						placeholder="Enter numeric ID"
						disabled={loading}
					/>
				</div>
				<button
					type="submit"
					disabled={loading}
					className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
				>
					{loading ? "Loading..." : "View Cards"}
				</button>
				{error && <p className="text-red-500 text-sm mt-2">{error}</p>}
			</form>
		</div>
	);
}
