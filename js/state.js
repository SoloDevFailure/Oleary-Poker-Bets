function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return normalizeState({ players: [], events: [] });
  }

  try {
    return normalizeState(JSON.parse(saved));
  } catch {
    return normalizeState({ players: [], events: [] });
  }
}

function cloneDefaultProfiles() {
  return DEFAULT_PLAYER_PROFILES.map((profile) => ({ ...profile, attending: true }));
}

function normalizeState(rawState) {
  const nextState = rawState && typeof rawState === "object" ? rawState : {};
  nextState.players = Array.isArray(nextState.players) ? nextState.players : [];
  nextState.events = Array.isArray(nextState.events) ? nextState.events : [];
  const savedProfiles = Array.isArray(nextState.playerProfiles) ? nextState.playerProfiles : [];
  const profilesById = new Map(savedProfiles.map((profile) => [profile.playerId, profile]));
  const missingDefaultProfiles = cloneDefaultProfiles().filter((profile) => !profilesById.has(profile.playerId));
  nextState.playerProfiles = cloneDefaultProfiles().map((profile) => normalizeProfile({
    ...profile,
    ...(profilesById.get(profile.playerId) || {}),
  }));
  missingDefaultProfiles.forEach((profile) => {
    if (!nextState.playerProfiles.some((item) => item.playerId === profile.playerId)) {
      nextState.playerProfiles.push(normalizeProfile(profile));
    }
  });
  savedProfiles
    .filter((profile) => profile?.playerId && !nextState.playerProfiles.some((item) => item.playerId === profile.playerId))
    .forEach((profile) => nextState.playerProfiles.push(normalizeProfile(profile)));
  nextState.events.forEach((event) => {
    event.outcomes = Array.isArray(event.outcomes) ? event.outcomes.map(normalizeOutcome) : [];
    event.bets = Array.isArray(event.bets) ? event.bets.map((bet) => ({
      ...bet,
      value: Number(bet.value || 0),
      lockedOdds: Number(bet.lockedOdds) > 0 ? Number(bet.lockedOdds) : null,
      potentialPayout: bet.potentialPayout !== null && bet.potentialPayout !== undefined && Number(bet.potentialPayout) >= 0
        ? Number(bet.potentialPayout)
        : null,
    })) : [];
    event.seedPool = Number(event.seedPool || 0);
    event.currentOdds = event.currentOdds && typeof event.currentOdds === "object" ? event.currentOdds : {};
    event.profileMarketType = MARKET_TYPES.includes(event.profileMarketType) ? event.profileMarketType : "Custom";
  });
  return nextState;
}

function normalizeProfile(profile) {
  const playerName = String(profile.playerName || profile.name || "Player").trim();
  const playerId = String(profile.playerId || playerName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || uid());
  return PROFILE_STATS.reduce((result, stat) => {
    result[stat] = clampNumber(profile[stat], 0, 100);
    return result;
  }, { playerId, playerName, attending: profile.attending !== false });
}

function normalizeOutcome(outcome) {
  if (typeof outcome === "string") return { id: uid(), label: outcome };
  return {
    ...outcome,
    id: outcome.id || uid(),
    label: outcome.label || "",
    weight: Number(outcome.weight || 0),
    probability: Number(outcome.probability || 0),
    seedLiquidity: Number(outcome.seedLiquidity || 0),
    profileId: outcome.profileId || null,
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function saveCollapsedEvents() {
  localStorage.setItem("poker-night-bets-collapsed-events", JSON.stringify([...collapsedEvents]));
}

function saveExpandedPlayers() {
  localStorage.setItem("poker-night-bets-expanded-players", JSON.stringify([...expandedPlayers]));
}

function saveExpandedOddsMenus() {
  localStorage.setItem("poker-night-bets-expanded-odds", JSON.stringify([...expandedOddsMenus]));
}

function saveCollapsedPlayerOddsMenus() {
  localStorage.setItem("poker-night-bets-collapsed-player-odds-v1", JSON.stringify([...collapsedPlayerOddsMenus]));
}

function saveSeenWinPayouts() {
  localStorage.setItem(seenWinPayoutsKey, JSON.stringify([...seenWinPayouts]));
}

function markWinPopupsPrimed() {
  winPopupsPrimed = true;
  localStorage.setItem(`${seenWinPayoutsKey}-primed`, "yes");
}
