/**
 * Calculates milestone progress for achievement tracking
 * @param value - Current value to evaluate against milestones
 * @returns Object containing progress data for visualization
 */
export function calculateMilestones(value: number) {
	// Base milestones up to 1000
	const baseMilestones = [100, 250, 500, 750, 1000];
	const dynamicMilestones: number[] = [];

	// Calculate dynamic milestones beyond 1000
	const thousands = Math.floor(value / 1000);
	const maxMilestone = (thousands + 1) * 1000;

	// Generate milestones in 1000 increments starting from 2000
	for (let i = 2000; i <= maxMilestone; i += 1000) {
		dynamicMilestones.push(i);
	}

	// Combine and deduplicate milestones
	const allMilestones = Array.from(new Set([...baseMilestones, ...dynamicMilestones])).sort(
		(a, b) => a - b
	);

	// Find surrounding milestones for progress calculation
	const previousMilestone = allMilestones
		.filter((m) => m < value)
		.reduce((a, b) => Math.max(a, b), 0); // Get closest lower milestone

	const currentMilestone = allMilestones.find((m) => m >= value) || (thousands + 1) * 1000; // Fallback to next 1000

	// Calculate progress percentage between milestones
	const range = currentMilestone - previousMilestone;
	const percentage =
		previousMilestone === currentMilestone ? 100 : ((value - previousMilestone) / range) * 100;

	// SVG circle calculations for progress visualization
	const radius = 40;
	const circumference = 2 * Math.PI * radius;
	const dashoffset = circumference * (1 - percentage / 100);

	return {
		previousMilestone,
		currentMilestone,
		percentage: Math.min(Math.max(Math.round(percentage), 0), 100), // Clamp 0-100
		dasharray: circumference.toFixed(2),
		dashoffset: dashoffset.toFixed(2),
	};
}
