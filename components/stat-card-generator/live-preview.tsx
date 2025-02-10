import { Label } from "@/components/ui/label";
import React from "react";

interface LivePreviewProps {
	previewSVG: string;
}

export const LivePreview = React.memo(function LivePreview({ previewSVG }: LivePreviewProps) {
	return (
		<div className="space-y-2">
			<Label>Live Preview</Label>
			<div className="p-4 rounded-lg border backdrop-blur-sm flex justify-center">
				<div dangerouslySetInnerHTML={{ __html: previewSVG }} />
			</div>
			<p className="text-xs text-muted-foreground">
				Preview updates automatically with color changes
			</p>
		</div>
	);
});
