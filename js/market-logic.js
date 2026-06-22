function getEventPool(event) {
  return event.bets.reduce((total, bet) => total + bet.value, 0);
}

function getSeedPool(event) {
  return (event.outcomes || []).reduce((total, outcome) => total + Number(outcome.seedLiquidity || 0), 0);
}

function getOutcomeTotals(event) {
  return event.bets.reduce((totals, bet) => {
    if (isTopThreeComboMarket(event)) {
      const selections = getComboSelections(bet);
      const share = selections.length ? bet.value / selections.length : 0;
      selections.forEach((selection) => {
        totals[selection] = (totals[selection] || 0) + share;
      });
      return totals;
    }
    totals[bet.outcome] = (totals[bet.outcome] || 0) + bet.value;
    return totals;
  }, {});
}

function getSeedOutcomeTotals(event) {
  return (event.outcomes || []).reduce((totals, outcome) => {
    if (!outcome.label) return totals;
    totals[outcome.label] = (totals[outcome.label] || 0) + Number(outcome.seedLiquidity || 0);
    return totals;
  }, {});
}

function getEventOutcomes(event) {
  const betOutcomes = Object.keys(getOutcomeTotals(event));
  const officialOutcomes = (event.outcomes || []).map((outcome) => outcome.label);
  return [...new Set([...officialOutcomes, ...betOutcomes])].sort((a, b) => a.localeCompare(b));
}

function getOdds(event) {
  const realPool = getEventPool(event);
  const seedPool = getSeedPool(event);
  const pool = realPool + seedPool;
  const taxedPool = pool * (1 - TAX_RATE);
  const outcomeTotals = getOutcomeTotals(event);
  const seedTotals = getSeedOutcomeTotals(event);
  const outcomes = getEventOutcomes(event);

  return outcomes
    .map((outcome) => {
      const realTotal = outcomeTotals[outcome] || 0;
      const seedTotal = seedTotals[outcome] || 0;
      const total = realTotal + seedTotal;
      const returnPerPoint = total > 0 && pool > 0 ? taxedPool / total : 0;
      const profitPerPoint = returnPerPoint - 1;
      return { outcome, total, realTotal, seedTotal, returnPerPoint, profitPerPoint };
    })
    .sort((a, b) => a.outcome.localeCompare(b.outcome));
}

function isFixedOddsProfileType(profileMarketType) {
  return FIXED_ODDS_MARKET_TYPES.includes(profileMarketType);
}

function isFixedOddsMarket(event) {
  return event?.payoutMode === "fixed_odds"
    && isFixedOddsProfileType(event?.profileMarketType)
    && !isTopThreeComboMarket(event);
}

function getDisplayProfitPerPoint(event, oddsItem) {
  if (!oddsItem || Number(oddsItem.seedTotal || 0) <= 0 || getSeedPool(event) <= 0) {
    return oddsItem?.profitPerPoint || 0;
  }

  const realPool = getEventPool(event);
  const seedPool = getSeedPool(event);
  const seededOdds = getOdds(event).filter((item) => Number(item.seedTotal || 0) > 0);
  const probabilities = seededOdds.map((item) => Number(item.seedTotal || 0) / seedPool);
  const maxProbability = Math.max(...probabilities);
  const minProbability = Math.min(...probabilities);
  const probability = Number(oddsItem.seedTotal || 0) / seedPool;

  const seededDisplay = Number.isFinite(probability) && maxProbability !== minProbability
    ? 1 + ((maxProbability - probability) / (maxProbability - minProbability)) * 4
    : 3;
  const liveWeight = realPool > 0 ? Math.min(0.85, realPool / (realPool + seedPool)) : 0;
  return seededDisplay * (1 - liveWeight) + (oddsItem.profitPerPoint || 0) * liveWeight;
}

function getRawFixedOdds(event) {
  return getOdds(event).reduce((odds, item) => {
    const multiplier = 1 + getDisplayProfitPerPoint(event, item);
    odds[item.outcome] = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
    return odds;
  }, {});
}

function getCurrentFixedOdds(event, outcome) {
  const stored = Number(event?.currentOdds?.[outcome]);
  if (Number.isFinite(stored) && stored > 0) return stored;
  return Number(getRawFixedOdds(event)[outcome] || 1);
}

function clampFixedOddsMovement(previousOdds, nextOdds, limit = 0.2) {
  const previous = Number(previousOdds);
  const next = Number(nextOdds);
  if (!Number.isFinite(next) || next <= 0) return Number.isFinite(previous) && previous > 0 ? previous : 1;
  if (!Number.isFinite(previous) || previous <= 0) return next;
  return Math.min(previous * (1 + limit), Math.max(previous * (1 - limit), next));
}

function calculateNextFixedOdds(event, previousOdds = event?.currentOdds || {}) {
  const rawOdds = getRawFixedOdds(event);
  return Object.fromEntries(getEventOutcomes(event).map((outcome) => {
    const previous = Number(previousOdds?.[outcome]);
    const raw = Number(rawOdds[outcome] || 1);
    return [outcome, clampFixedOddsMovement(previous, raw)];
  }));
}

function getMarketDisplayTitle(event) {
  const type = event.profileMarketType || "Custom";
  const titles = {
    TopThreeCombo: "PODIUM",
    BottomThreeCombo: "WOODEN SPOON",
    TopThree: "PODIUM",
    FirstOut: "FIRST OUT",
    Winner: "WINNER",
    Knockout: "KNOCKOUT",
    LastLonger: "LAST LONGER",
    Chaos: "CHAOS MARKET",
  };
  return titles[type] || String(event.name || "CUSTOM MARKET").toUpperCase();
}

function getMarketSubtitle(event) {
  const type = event.profileMarketType || "Custom";
  const subtitles = {
    TopThreeCombo: "Last three standing",
    BottomThreeCombo: "First three players eliminated",
    TopThree: "Last three standing",
    FirstOut: "First player eliminated",
    Winner: "Winner of the game / tournament",
    Chaos: event.name || "Anything can happen",
  };
  if (type === "Knockout" || type === "LastLonger") return event.name || "Player matchup";
  if (type === "Custom") return event.name || "Custom market";
  return subtitles[type] || event.name || "Poker market";
}

function getMarketIcon(event) {
  const icons = {
    TopThreeCombo: "&#9733;",
    BottomThreeCombo: "&#9835;",
    TopThree: "&#9733;",
    FirstOut: "&darr;",
    Winner: "&#9819;",
    Knockout: "KO",
    LastLonger: "&harr;",
    Chaos: "&nearr;",
  };
  return icons[event.profileMarketType] || "+";
}

function getMarketBadges(event) {
  const badges = [];
  if (event.status === "resolved") badges.push('<span class="player-badge resolved">Resolved</span>');
  if (event.status === "locked") badges.push('<span class="player-badge locked">Betting closed</span>');
  if (isTopThreeComboMarket(event)) badges.push(`<span class="player-badge combo">${getComboMarketName(event)}</span>`);
  if (isFixedOddsMarket(event)) badges.push('<span class="player-badge fixed">Fixed odds</span>');
  if (event.bonusPoints > 0) badges.push('<span class="player-badge bonus">Bonus available</span>');
  return badges.join("");
}

function sortMarketsForDisplay(markets) {
  return [...markets].sort((a, b) => {
    const aResolved = a.status === "resolved" || a.status === "voided";
    const bResolved = b.status === "resolved" || b.status === "voided";
    if (aResolved !== bResolved) return aResolved ? 1 : -1;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
}

function formatOdds(profitPerPoint) {
  if (profitPerPoint > 1) return `${formatRatio(profitPerPoint)}:1`;
  if (profitPerPoint > 0) return `1:${formatRatio(1 / profitPerPoint)}`;
  if (Math.abs(profitPerPoint) < 0.01) return "Even";
  return `${formatRatio(Math.abs(profitPerPoint * 100))}% tax loss`;
}

function formatFixedOdds(multiplier) {
  return `${formatRatio(Number(multiplier || 1))}x`;
}
