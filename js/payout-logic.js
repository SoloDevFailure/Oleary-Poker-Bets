function getEventPayouts(event) {
  if (Array.isArray(event.payouts) && event.payouts.length > 0) {
    return normalizeStoredPayouts(event, event.payouts);
  }

  if (event.status !== "resolved" || (!event.winningOutcome && !isTopThreeComboMarket(event))) {
    return [];
  }

  return calculateEventPayouts(event, Boolean(event.bonusAwarded));
}

function calculateEventPayouts(event, bonusAwarded = false) {
  if (isTopThreeComboMarket(event)) {
    return calculateComboEventPayouts(event, bonusAwarded);
  }

  const pool = getEventPool(event);
  const taxedPool = pool * (1 - TAX_RATE);
  const winnerTotal = event.bets
    .filter((bet) => bet.outcome === event.winningOutcome)
    .reduce((total, bet) => total + bet.value, 0);

  if (winnerTotal <= 0) return [];

  const payoutsByPlayer = event.bets
    .filter((bet) => bet.outcome === event.winningOutcome)
    .reduce((totals, bet) => {
      const share = bet.value / winnerTotal;
      const bonusAmount = bonusAwarded ? Number(event.bonusPoints || 0) * share : 0;
      totals[bet.playerId] = (totals[bet.playerId] || 0) + share * taxedPool + bonusAmount;
      return totals;
    }, {});

  return Object.entries(payoutsByPlayer).map(([playerId, amount]) => ({ playerId, amount }));
}

function calculateComboEventPayouts(event, bonusAwarded = false) {
  const result = getComboResult(event);
  if (result.length !== 3) return [];

  const weightedRows = event.bets
    .map((bet) => {
      const matchCount = getComboMatchCount(getComboSelections(bet), result);
      const matchWeight = getComboMatchWeight(matchCount);
      return {
        playerId: bet.playerId,
        weightedStake: Number(bet.value || 0) * matchWeight,
      };
    })
    .filter((row) => row.weightedStake > 0);

  const totalWeightedStake = weightedRows.reduce((total, row) => total + row.weightedStake, 0);
  if (totalWeightedStake <= 0) return [];

  const pool = getEventPool(event);
  const taxedPool = pool * (1 - TAX_RATE);
  const payoutsByPlayer = weightedRows.reduce((totals, row) => {
    const share = row.weightedStake / totalWeightedStake;
    const bonusAmount = bonusAwarded ? Number(event.bonusPoints || 0) * share : 0;
    totals[row.playerId] = (totals[row.playerId] || 0) + share * taxedPool + bonusAmount;
    return totals;
  }, {});

  return Object.entries(payoutsByPlayer).map(([playerId, amount]) => ({ playerId, amount }));
}

function normalizeStoredPayouts(event, payouts) {
  if (!event.bonusAwarded || Number(event.bonusPoints || 0) <= 0) return payouts;

  const basePayouts = calculateEventPayouts(event, false);
  const fullPayouts = calculateEventPayouts(event, true);
  if (!basePayouts.length || !fullPayouts.length) return payouts;

  const storedTotal = payouts.reduce((total, payout) => total + Number(payout.amount || 0), 0);
  const baseTotal = basePayouts.reduce((total, payout) => total + Number(payout.amount || 0), 0);
  const fullTotal = fullPayouts.reduce((total, payout) => total + Number(payout.amount || 0), 0);
  const missingBonus = Math.abs(storedTotal - baseTotal) < 0.01 && Math.abs(fullTotal - baseTotal) > 0.01;
  if (!missingBonus) return payouts;

  const storedByPlayer = new Map(payouts.map((payout) => [payout.playerId, payout]));
  return fullPayouts.map((payout) => ({
    ...(storedByPlayer.get(payout.playerId) || {}),
    ...payout,
    noticeAmount: storedByPlayer.get(payout.playerId)?.amount,
  }));
}
