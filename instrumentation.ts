/**
 * Tareas del propio servidor de la web. Resumen diario de la redacción: a partir de las 8:00 (Madrid), una vez al día
 * (cms/newsroom.ts, dailyDigestTick). Así no hace falta ninguna tarea programada en el servidor (cron).
 * NEWSROOM_DIGEST_ENABLED=false lo desactiva (pruebas).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.CMS_ENABLED !== "true" || process.env.NEWSROOM_DIGEST_ENABLED === "false") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const tick = async () => {
    try {
      const [{ contentClient }, { dailyDigestTick }] = await Promise.all([import("./lib/payload-content"), import("./cms/newsroom")]);
      const sent = await dailyDigestTick(await contentClient());
      if (sent) console.log(`Resumen diario de la redacción: ${sent.length} correo(s)`);
    } catch (error) {
      console.error("No se pudo preparar el resumen diario de la redacción", error);
    }
  };
  setTimeout(tick, 60_000).unref?.();
  setInterval(tick, 5 * 60_000).unref?.();
}
