export function calculateMilestones(value: number) {
	const baseMilestones = [100, 250, 500, 750, 1000];
	const dynamicMilestones: number[] = [];
	
	// Calculate the next full 1000 milestone after the value
	const thousands = Math.floor(value / 1000);
	const maxMilestone = (thousands + 1) * 1000;

	// Generate dynamic milestones starting from 2000
	for (let i = 2000; i <= maxMilestone; i += 1000) {
		dynamicMilestones.push(i);
	}

	// Combine and sort all milestones
	const allMilestones = Array.from(
		new Set([...baseMilestones, ...dynamicMilestones])
	).sort((a, b) => a - b);

	// Find surrounding milestones
	const previousMilestone = allMilestones
		.filter(m => m < value)
		.reduce((a, b) => Math.max(a, b), 0);

	const currentMilestone = allMilestones.find(m => m >= value) || 
		(thousands + 1) * 1000;

	// Calculate progress between milestones
	const range = currentMilestone - previousMilestone;
	const percentage = previousMilestone === currentMilestone ? 100 : 
		((value - previousMilestone) / range) * 100;

	// Circle calculations
	const radius = 40;
	const circumference = 2 * Math.PI * radius;
	const dashoffset = circumference * (1 - percentage/100);

	return {
		previousMilestone,
		currentMilestone,
		percentage: Math.min(Math.max(Math.round(percentage), 0), 100),
		dasharray: circumference.toFixed(2),
		dashoffset: dashoffset.toFixed(2)
	};
}
