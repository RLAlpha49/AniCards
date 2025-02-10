import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

export function UpdateNotice() {
	return (
		<Alert className="border-blue-500 bg-blue-500/10">
			<Info className="h-5 w-5 text-blue-500" />
			<div className="ml-3">
				<AlertTitle className="text-blue-500 text-lg">Update Notice</AlertTitle>
				<AlertDescription className="text-foreground">
					<div className="space-y-2">
						<p>SVGs are cached for 24 hours. If your changes don&apos;t appear:</p>
						<ul className="list-disc pl-6">
							<li>
								Hard refresh with <kbd>Ctrl</kbd>+<kbd>F5</kbd> (Windows) or{" "}
								<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> (Mac)
							</li>
							<li>Clear browser cache</li>
							<li>Wait up to 24 hours for cache expiration</li>
						</ul>
					</div>
				</AlertDescription>
			</div>
		</Alert>
	);
}
