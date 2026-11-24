function positiveInteger(value, fallback, maximum) {
  if (value === null || value === undefined || value === "") return fallback;
  const raw = String(value).trim();
  if (!/^\d{1,10}$/.test(raw)) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) return fallback;
  return Math.min(parsed, maximum);
}
module.exports={positiveInteger};
