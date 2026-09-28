export function emitMetric(event, detail = {}) {
  try {
    const payload = JSON.stringify({ event, ...detail });
    console.info("tabSidian.metric", payload);
  } catch (error) {
    console.info("tabSidian.metric", event, detail);
  }
}
