function isTopThreeComboMarket(event) {
  return event?.profileMarketType === "TopThreeCombo" || event?.profileMarketType === "BottomThreeCombo";
}

function getComboMarketName(event) {
  return event?.profileMarketType === "BottomThreeCombo" ? "Bottom Three Combo" : "Top Three Combo";
}

function getComboResultDescription(event) {
  return event?.profileMarketType === "BottomThreeCombo" ? "first three eliminated" : "final Top 3";
}

function getComboSelections(bet) {
  return Array.isArray(bet?.selections)
    ? bet.selections.map(normalizeOutcomeLabel).filter(Boolean).slice(0, 3)
    : [];
}

function getComboKey(selections) {
  return [...new Set((selections || []).map(normalizeOutcomeLabel).filter(Boolean))]
    .map((item) => item.toLowerCase())
    .sort()
    .join("|");
}

function getComboMatchCount(selections, result) {
  const resultSet = new Set((result || []).map((item) => normalizeOutcomeLabel(item).toLowerCase()));
  return getComboSelections({ selections })
    .filter((item) => resultSet.has(item.toLowerCase()))
    .length;
}

function getComboMatchWeight(matchCount) {
  if (matchCount >= 3) return 5;
  if (matchCount === 2) return 2;
  if (matchCount === 1) return 0.5;
  return 0;
}

function getComboResult(event) {
  return Array.isArray(event?.winningSelections) ? event.winningSelections.map(normalizeOutcomeLabel).filter(Boolean).slice(0, 3) : [];
}

function getComboResultLabel(event) {
  const result = getComboResult(event);
  return result.length ? result.join(", ") : event?.winningOutcome || "Not set";
}

function getBetPickText(bet) {
  const selections = getComboSelections(bet);
  if (selections.length) return selections.join(", ");
  return bet?.outcome || "Unknown outcome";
}

function getComboBetDetails(event, bets) {
  const result = getComboResult(event);
  const rows = (bets || []).map((bet) => {
    const selections = getComboSelections(bet);
    const matchCount = getComboMatchCount(selections, result);
    const matchWeight = getComboMatchWeight(matchCount);
    return {
      bet,
      selections,
      matchCount,
      matchWeight,
      weightedStake: Number(bet.value || 0) * matchWeight,
    };
  });
  const totalWeightedStake = event.bets.reduce((total, bet) => {
    const matchCount = getComboMatchCount(getComboSelections(bet), result);
    return total + Number(bet.value || 0) * getComboMatchWeight(matchCount);
  }, 0);
  const playerWeightedStake = rows.reduce((total, row) => total + row.weightedStake, 0);
  return { result, rows, totalWeightedStake, playerWeightedStake };
}
