function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function money(value) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function clampNumber(value, min, max) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function groupBy(items, key) {
  return items.reduce((map, item) => {
    const groupKey = item[key];
    if (!map.has(groupKey)) map.set(groupKey, []);
    map.get(groupKey).push(item);
    return map;
  }, new Map());
}

function shortError(error) {
  return String(error?.message || error || "unknown error").slice(0, 90);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function normalizeOutcomeLabel(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseOutcomeLabels(value) {
  return [...new Set(String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean))];
}
