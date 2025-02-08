import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export async function svgToPng(svgUrl: string): Promise<string> {
	const response = await fetch(svgUrl);
	const svgText = await response.text();

	const img = new Image();
	img.src = `data:image/svg+xml;base64,${btoa(svgText)}`;

	return new Promise((resolve) => {
		img.onload = () => {
			const canvas = document.createElement("canvas");
			canvas.width = img.width;
			canvas.height = img.height;
			const ctx = canvas.getContext("2d");
			ctx?.drawImage(img, 0, 0);
			resolve(canvas.toDataURL("image/png"));
		};
	});
}

export function copyToClipboard(text: string): Promise<void> {
	return navigator.clipboard.writeText(text);
}
