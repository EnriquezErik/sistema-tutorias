// Resolve using the original saved period and date, including inactive historical periods.
async function resolveDraftPeriod(client, incoming, previous) {
  if (previous?.periodId && previous?.period) return {id:previous.periodId,name:previous.period};
  const original=previous||incoming;
  const start=original.activeCorrection?.originalStart||original.start;
  if(!Number.isFinite(Date.parse(start)))return null;
  const result=await client.query(`select p.id,p.name from public.periods p cross join public.institution_settings i where ($1::text is null or p.id::text=$1) and ($2::text is null or p.name=$2) and ($3::timestamptz at time zone coalesce(i.timezone,'America/Mexico_City'))::date between p.starts_on and p.ends_on`,[original.periodId||null,original.period||null,start]);
  return result.rows.length===1?result.rows[0]:null;
}
module.exports={resolveDraftPeriod};
