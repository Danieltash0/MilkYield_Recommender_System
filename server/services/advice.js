// Advisory tips for a yield judgement or forecast, from what is known about
// the cow: her feed against her usual ration, lactation stage, pregnancy and
// health. Pure functions, no database.
//
// Each tip is { code, text, numbers }: `numbers` lists every number in `text`,
// so explain.numbersAreGrounded can check an LLM rewording against them.

const FEED_DROP = 0.75; // concentrate at or below 75% of usual counts as cut
const FEED_RISE = 1.25; // at or above 125% of usual counts as raised
const LOW_CONCENTRATE_KG = 1;
const LATE_LACTATION_DAYS = 250;
const NEAR_DRY_OFF_PREGNANT_DAYS = 210;

const fmt = (n) => String(Math.round(n * 100) / 100);
const tip = (code, text, numbers = []) => ({ code, text, numbers });

// Feed compared with the cow's usual ration (context.feed from features.feedSignals)
const feedTips = (feed, status) => {
  if (!feed) return [];
  const { today, usual, daysLogged } = feed;
  if (today === null || today === undefined) {
    return daysLogged > 0 && status !== 'high'
      ? [tip('feed_missing', 'No feed was logged for her today; confirm she was fed and log it.')]
      : [];
  }
  if (usual !== null && usual > 0 && today <= usual * FEED_DROP && status !== 'high') {
    return [tip('feed_drop', `Concentrate was cut to ${fmt(today)} kg from her usual ${fmt(usual)} kg; restore the usual ration.`, [today, usual])];
  }
  if (usual !== null && usual > 0 && today >= usual * FEED_RISE && status === 'high') {
    return [tip('feed_rise', `Concentrate was raised to ${fmt(today)} kg from her usual ${fmt(usual)} kg, which may explain the rise.`, [today, usual])];
  }
  if (today < LOW_CONCENTRATE_KG && status !== 'high') {
    return [tip('feed_low', `She is getting little concentrate (${fmt(today)} kg); adding dairy meal may lift her yield.`, [today])];
  }
  return [];
};

// Lactation stage and pregnancy, which lower yield naturally
const stageTips = (context) => {
  const tips = [];
  if (context.daysPregnant >= NEAR_DRY_OFF_PREGNANT_DAYS) {
    tips.push(tip('near_dry_off', 'She is close to drying off, so lower yields are expected; plan her dry period.'));
  } else if (context.daysInMilk !== null && context.daysInMilk !== undefined && context.daysInMilk >= LATE_LACTATION_DAYS) {
    tips.push(tip('late_lactation', 'She is in late lactation, so a gradual fall in yield is expected.'));
  }
  return tips;
};

const healthTips = (flags = {}) => {
  if (flags.sick || flags.inTreatment) {
    return [tip('health_recovery', "Follow the vet's treatment plan and observe milk withdrawal periods; yield usually recovers within a week or two.")];
  }
  if (flags.recentCalving) return [tip('fresh_cow', 'Yield normally rises over the first weeks after calving; keep her well fed and watered.')];
  return [];
};

// Tips for a judged reading (status low/high/normal/suppressed) or, with
// status null, for the next session's forecast
const adviceFor = ({ status = null, context = {} } = {}) => {
  const flags = context.flags || {};
  if (status === 'normal') return [];

  if (status === 'suppressed') return healthTips(flags);

  if (status === 'high') {
    return [tip('check_entry', 'Check that the reading was entered correctly.'), ...feedTips(context.feed, 'high')];
  }

  const feed = feedTips(context.feed, status);
  const stage = stageTips(context);

  if (status === 'low') {
    const explained = feed.length > 0 || stage.length > 0;
    const check = explained
      ? tip('check_udder', 'Also check her water supply and udder for signs of mastitis.')
      : tip('check_udder', 'No feed change or health event explains the drop: check her water supply and udder for signs of mastitis, and ask the vet to examine her if it happens again.');
    return [...feed, ...stage, check];
  }

  // Forecast: anything worth acting on before the next milking
  return [...healthTips(flags), ...feed, ...stage];
};

module.exports = { adviceFor, FEED_DROP, FEED_RISE, LOW_CONCENTRATE_KG, LATE_LACTATION_DAYS, NEAR_DRY_OFF_PREGNANT_DAYS };
