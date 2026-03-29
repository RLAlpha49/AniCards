import { LoadingSpinner } from "@/components/LoadingSpinner";
import PageShell from "@/components/PageShell";

export default function Loading() {
  return (
    <PageShell>
      <div className="
        relative z-10 container mx-auto flex min-h-screen items-center justify-center px-4
      ">
        <LoadingSpinner size="lg" text="Loading user data..." />
      </div>
    </PageShell>
  );
}
