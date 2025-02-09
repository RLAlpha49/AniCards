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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractErrorInfo(error: any): any {
	let errInfo = error.errInfo;
	let previousErrInfo = null;
	while (errInfo) {
		previousErrInfo = errInfo;
		if (errInfo.details && errInfo.details.schemaRulesNotSatisfied) {
			errInfo = errInfo.details.schemaRulesNotSatisfied[0];
		} else if (errInfo.propertiesNotSatisfied) {
			errInfo = errInfo.propertiesNotSatisfied[0];
		} else if (errInfo.details) {
			// Check if the next details object has propertiesNotSatisfied
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
