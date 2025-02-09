import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Utility functions for common application needs

/**
 * Tailwind CSS class name merger
 * Combines class values and resolves conflicts
 */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Converts SVG URL to PNG data URL via API
 * @throws Error if conversion fails
 */
export async function svgToPng(svgUrl: string): Promise<string> {
	try {
		const response = await fetch("/api/convert", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ svgUrl }),
		});

		const { pngDataUrl } = await response.json();
		return pngDataUrl;
	} catch (error) {
		console.error("Conversion failed:", error);
		throw error;
	}
}

/**
 * Wrapper for clipboard API with error handling
 */
export function copyToClipboard(text: string): Promise<void> {
	return navigator.clipboard.writeText(text);
}

/**
 * Recursively extracts error information from MongoDB validation errors
 * @param error - Error object from MongoDB validation
 * @returns Deepest available error information
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractErrorInfo(error: any): any {
	let errInfo = error.errInfo;
	let previousErrInfo = null;

	// Traverse error tree to find root cause
	while (errInfo) {
		previousErrInfo = errInfo;

		// Handle different error structure variations
		if (errInfo.details && errInfo.details.schemaRulesNotSatisfied) {
			errInfo = errInfo.details.schemaRulesNotSatisfied[0];
		} else if (errInfo.propertiesNotSatisfied) {
			errInfo = errInfo.propertiesNotSatisfied[0];
		} else if (errInfo.details) {
			// Handle nested error details
			if (errInfo.details[0].propertiesNotSatisfied) {
				errInfo = errInfo.details[0];
			} else if (errInfo.details[0].details) {
				errInfo = errInfo.details[0].details[0];
			} else {
				break;
			}
		} else {
			break;
		}
	}

	return previousErrInfo;
}
