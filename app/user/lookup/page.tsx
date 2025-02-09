"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// UserLookupPage component for looking up a user by ID
export default function UserLookupPage() {
	const router = useRouter(); // Hook for client-side navigation
	const [input, setInput] = useState(""); // State for input field value (user ID)
	const [loading, setLoading] = useState(false); // State to manage loading state during lookup
	const [error, setError] = useState(""); // State to store and display error messages

	// Handler for form submission
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault(); // Prevent default form submission behavior
		setLoading(true); // Set loading state to true when form is submitted
		setError(""); // Clear any previous errors

		try {
			// Check if input is a numeric ID using regex
			if (/^\d+$/.test(input)) {
				router.push(`/user?userId=${input}`); // Redirect to user page with the provided userId
			} else {
				setError("Invalid user ID"); // Set error state if input is not numeric
			}
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
		} catch (err) {
			setError("Invalid user ID"); // Set error state for any exceptions during processing
		} finally {
			setLoading(false); // Set loading state back to false after submission attempt (success or fail)
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
						onChange={(e) => setInput(e.target.value)} // Update input state on change
						className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
						placeholder="Enter numeric ID"
						disabled={loading} // Disable input when loading
					/>
				</div>
				<button
					type="submit"
					disabled={loading} // Disable button when loading
					className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
				>
					{loading ? "Loading..." : "View Cards"}
					{/* Display "Loading..." when loading */}
				</button>
				{error && <p className="text-red-500 text-sm mt-2">{error}</p>}
				{/* Display error message if error state is set */}
			</form>
		</div>
	);
}
