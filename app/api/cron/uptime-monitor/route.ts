export async function POST(request: Request) {
  // Check for the required cron secret
  const CRON_SECRET = process.env.CRON_SECRET;
  const cronSecretHeader = request.headers.get("x-cron-secret");

  if (CRON_SECRET) {
    if (cronSecretHeader !== CRON_SECRET) {
      console.error("🔒 [Uptime Monitor] Unauthorized: Invalid Cron secret");
      return new Response("Unauthorized", { status: 401 });
    }
  } else {
    console.warn(
      "No CRON_SECRET env variable set. Skipping authorization check.",
    );
  }

  const startTime = Date.now();
  console.log("🛠️ [Uptime Monitor] Starting uptime check...");

  // Define list of routes to monitor
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://anicards.alpha49.com";
  const routes = [
    "/",
    "/search",
    "/contact",
    "/settings",
    "/projects",
    "/license",
  ];
  const urls = routes.map((route) => `${baseUrl}${route}`);

  // Function to check a single route
  async function checkRoute(url: string): Promise<{
    url: string;
    ok: boolean;
    status: number | null;
    error?: string;
  }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 5000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      return { url, ok: res.ok, status: res.status };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      clearTimeout(timeoutId);
      return { url, ok: false, status: null, error: error.message };
    }
  }

  // Check all routes concurrently
  const results = await Promise.all(urls.map((url) => checkRoute(url)));
  const duration = Date.now() - startTime;
  const successCount = results.filter((result) => result.ok).length;

  results.forEach((result) => {
    if (result.ok) {
      console.log(
        `✅ [Uptime Monitor] ${result.url} is up. Status: ${result.status}`,
      );
    } else {
      console.error(
        `🔥 [Uptime Monitor] ${result.url} check failed${
          result.error ? `: ${result.error}` : ""
        }`,
      );
    }
  });

  const summary = `Uptime check completed in ${duration}ms: ${successCount}/${urls.length} endpoints are up.`;
  console.log(`🛠️ [Uptime Monitor] ${summary}`);
  return new Response(JSON.stringify({ summary, details: results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
