// Runs once when the Next.js server starts: log resolved DATA_DIR, seed/reconcile settings history.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initDataStore } = await import("@/lib/server-store");
    try {
      initDataStore();
    } catch (e) {
      console.error("[milkwise] settings history init failed", e);
    }
  }
}
