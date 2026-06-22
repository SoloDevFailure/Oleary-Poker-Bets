const state = loadState();
const params = new URLSearchParams(window.location.search);
const requestedMode = params.get("mode");
const appMode = requestedMode === "host" ? "host" : "player";
document.documentElement.dataset.mode = appMode;
const deviceKey = params.get("device") || localStorage.getItem("oleary-player-device-id") || uid();
localStorage.setItem("oleary-player-device-id", deviceKey);
let currentPlayerId = localStorage.getItem(`oleary-player-id-${deviceKey}`) || null;
let activeTab = localStorage.getItem("poker-night-bets-active-tab") || "players";
let activePlayerTab = localStorage.getItem("poker-night-bets-player-tab-v2") || "markets";
let playerAutoRefreshTimer = null;
let playerAutoRefreshInFlight = false;
const collapsedEvents = new Set(JSON.parse(localStorage.getItem("poker-night-bets-collapsed-events") || "[]"));
const expandedPlayers = new Set(JSON.parse(localStorage.getItem("poker-night-bets-expanded-players") || "[]"));
const expandedOddsMenus = new Set(JSON.parse(localStorage.getItem("poker-night-bets-expanded-odds") || "[]"));
const collapsedPlayerOddsMenus = new Set(JSON.parse(localStorage.getItem("poker-night-bets-collapsed-player-odds-v1") || "[]"));
const aiDisclaimerKey = "oleary-ai-ratings-disclaimer-seen";
const seenWinPayoutsKey = `oleary-seen-win-payouts-${deviceKey}`;
const seenWinPayouts = new Set(JSON.parse(localStorage.getItem(seenWinPayoutsKey) || "[]"));
let winPopupsPrimed = localStorage.getItem(`${seenWinPayoutsKey}-primed`) === "yes";
let playerTabDirection = "forward";
let highlightedBetId = null;
let highlightedEventId = null;
let highlightTimer = null;
const animatedMarketCards = new Set();
const remote = {
  client: null,
  session: null,
  enabled: false,
};

function isHostMode() {
  return appMode === "host";
}

function requireHostMode() {
  if (!isHostMode()) {
    console.warn("Blocked host-only action in player mode.");
    return false;
  }
  return true;
}

if (appMode === "player") {
  document.title = "Oleary Poker Bets Player";
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js")
    .then((registration) => registration.update())
    .catch(() => {});
}

const els = {
  playerForm: document.querySelector("#playerForm"),
  sessionForm: document.querySelector("#sessionForm"),
  sessionTitle: document.querySelector("#sessionTitle"),
  defaultPlayerPoints: document.querySelector("#defaultPlayerPoints"),
  joiningEnabled: document.querySelector("#joiningEnabled"),
  playerName: document.querySelector("#playerName"),
  startingPoints: document.querySelector("#startingPoints"),
  playersList: document.querySelector("#playersList"),
  eventForm: document.querySelector("#eventForm"),
  eventName: document.querySelector("#eventName"),
  marketType: document.querySelector("#marketType"),
  outcomeFields: document.querySelector("#outcomeFields"),
  addOutcome: document.querySelector("#addOutcome"),
  populateDefaultPlayers: document.querySelector("#populateDefaultPlayers"),
  profileOutcomeSelect: document.querySelector("#profileOutcomeSelect"),
  addProfileOutcome: document.querySelector("#addProfileOutcome"),
  bonusEnabled: document.querySelector("#bonusEnabled"),
  bonusFields: document.querySelector("#bonusFields"),
  bonusLabel: document.querySelector("#bonusLabel"),
  bonusPoints: document.querySelector("#bonusPoints"),
  addPlayerButton: document.querySelector("#playerForm button[type='submit']"),
  addEventButton: document.querySelector("#eventForm button[type='submit']"),
  eventsList: document.querySelector("#eventsList"),
  exportData: document.querySelector("#exportData"),
  importData: document.querySelector("#importData"),
  resetNight: document.querySelector("#resetNight"),
  betDialogTemplate: document.querySelector("#betDialogTemplate"),
  playerTabs: document.querySelector("#playerTabs"),
  playerJoinPanel: document.querySelector("#playerJoinPanel"),
  playerJoinForm: document.querySelector("#playerJoinForm"),
  playerJoinName: document.querySelector("#playerJoinName"),
  playerProfileTab: document.querySelector("#playerProfileTab"),
  playerMarketsTab: document.querySelector("#playerMarketsTab"),
  playerBetsTab: document.querySelector("#playerBetsTab"),
  playerAnalyticsTab: document.querySelector("#playerAnalyticsTab"),
  playerSocialTab: document.querySelector("#playerSocialTab"),
  playerProfilePanel: document.querySelector("#playerProfilePanel"),
  playerMarketsPanel: document.querySelector("#playerMarketsPanel"),
  playerBetsPanel: document.querySelector("#playerBetsPanel"),
  playerAnalyticsPanel: document.querySelector("#playerAnalyticsPanel"),
  playerSocialPanel: document.querySelector("#playerSocialPanel"),
  playerProfile: document.querySelector("#playerProfile"),
  playerMarketsList: document.querySelector("#playerMarketsList"),
  playerBetsList: document.querySelector("#playerBetsList"),
  playerAnalytics: document.querySelector("#playerAnalytics"),
  refreshPlayerMarkets: document.querySelector("#refreshPlayerMarkets"),
  playerSocialList: document.querySelector("#playerSocialList"),
  playerMarketDialog: document.querySelector("#playerMarketDialog"),
  playerMarketDetail: document.querySelector("#playerMarketDetail"),
  playersTab: document.querySelector("#playersTab"),
  profilesTab: document.querySelector("#profilesTab"),
  createMarketTab: document.querySelector("#createMarketTab"),
  eventsTab: document.querySelector("#eventsTab"),
  socialTab: document.querySelector("#socialTab"),
  sessionTab: document.querySelector("#sessionTab"),
  playersPanel: document.querySelector("#playersPanel"),
  profilesPanel: document.querySelector("#profilesPanel"),
  createMarketPanel: document.querySelector("#createMarketPanel"),
  profilesList: document.querySelector("#profilesList"),
  addProfile: document.querySelector("#addProfile"),
  resetProfiles: document.querySelector("#resetProfiles"),
  eventsPanel: document.querySelector("#eventsPanel"),
  socialPanel: document.querySelector("#socialPanel"),
  hostSocialList: document.querySelector("#hostSocialList"),
  sessionPanel: document.querySelector("#sessionPanel"),
  showPlayerQr: document.querySelector("#showPlayerQr"),
  giveAllPoints: document.querySelector("#giveAllPoints"),
  giveAllDialog: document.querySelector("#giveAllDialog"),
  giveAllPointsValue: document.querySelector("#giveAllPointsValue"),
  closeAllBetting: document.querySelector("#closeAllBetting"),
  syncStatus: document.querySelector("#syncStatus"),
  syncNow: document.querySelector("#syncNow"),
  confirmDialog: document.querySelector("#confirmDialog"),
  aiDisclaimerDialog: document.querySelector("#aiDisclaimerDialog"),
  confirmKicker: document.querySelector("[data-confirm-kicker]"),
  confirmTitle: document.querySelector("[data-confirm-title]"),
  confirmMessage: document.querySelector("[data-confirm-message]"),
  confirmAction: document.querySelector("[data-confirm-action]"),
  confirmCancel: document.querySelector("[data-confirm-cancel]"),
  qrDialog: document.querySelector("#qrDialog"),
  playerQrCode: document.querySelector("#playerQrCode"),
  playerQrFallback: document.querySelector("#playerQrFallback"),
  playerQrUrl: document.querySelector("#playerQrUrl"),
  copyPlayerUrl: document.querySelector("#copyPlayerUrl"),
  winDialog: document.querySelector("#winDialog"),
  winAmount: document.querySelector("[data-win-amount]"),
  winMarket: document.querySelector("[data-win-market]"),
  winPickRow: document.querySelector("[data-win-pick-row]"),
  winPick: document.querySelector("[data-win-pick]"),
  winStakeRow: document.querySelector("[data-win-stake-row]"),
  winStake: document.querySelector("[data-win-stake]"),
  winBonusRow: document.querySelector("[data-win-bonus-row]"),
  winBonus: document.querySelector("[data-win-bonus]"),
  winProfitRow: document.querySelector("[data-win-profit-row]"),
  winProfit: document.querySelector("[data-win-profit]"),
  winBalanceRow: document.querySelector("[data-win-balance-row]"),
  winBalance: document.querySelector("[data-win-balance]"),
};

function setSyncStatus(text, mode) {
  if (appMode === "player" && mode === "online") {
    const sessionCode = text.match(/Session\s+(.+)$/)?.[1] || "OLEARY";
    const primary = document.createElement("span");
    const secondary = document.createElement("span");
    primary.className = "sync-primary";
    primary.textContent = `Session ${sessionCode}`;
    secondary.className = "sync-secondary";
    secondary.textContent = text.includes("connected") ? "Supabase connected" : "Supabase synced";
    els.syncStatus.replaceChildren(primary, secondary);
  } else {
    els.syncStatus.textContent = text;
  }
  els.syncStatus.classList.toggle("online", mode === "online");
  els.syncStatus.classList.toggle("offline", mode === "offline");
  const waitingForSupabase = supabaseConfigured() && !remote.enabled && text !== "Local host mode";
  els.addPlayerButton.disabled = waitingForSupabase;
  els.addEventButton.disabled = waitingForSupabase;
}

function supabaseConfigured() {
  const config = window.OLEARY_SUPABASE;
  return Boolean(config?.url && config?.anonKey && window.supabase);
}

async function initSupabaseConnection() {
  const config = window.OLEARY_SUPABASE;
  if (!supabaseConfigured()) {
    setSyncStatus("Local host mode", "");
    return;
  }

  try {
    setSyncStatus("Connecting...", "");
    remote.client = window.supabase.createClient(config.url, config.anonKey);
    const joinCode = (config.sessionCode || "OLEARY").trim().toUpperCase();
    const { data: existingSession, error: readError } = await remote.client
      .from("sessions")
      .select("*")
      .eq("join_code", joinCode)
      .maybeSingle();

    if (readError) throw readError;

    if (existingSession) {
      remote.session = existingSession;
    } else {
      const { data: newSession, error: createError } = await remote.client
        .from("sessions")
        .insert({
          title: "Oleary Poker Session",
          join_code: joinCode,
          default_player_points: Number(els.startingPoints.value) || 100,
          joining_enabled: true,
        })
        .select("*")
        .single();

      if (createError) throw createError;
      remote.session = newSession;
    }

    remote.enabled = true;
    els.sessionTitle.value = remote.session.title || "";
    els.defaultPlayerPoints.value = Number(remote.session.default_player_points ?? 100);
    els.startingPoints.value = Number(remote.session.default_player_points ?? 100);
    els.joiningEnabled.checked = remote.session.joining_enabled !== false;
    setSyncStatus(`Supabase connected · Session ${remote.session.join_code}`, "online");
    await loadRemoteState();
  } catch (error) {
    remote.enabled = false;
    if (error.message?.includes("relation") || error.message?.includes("schema cache")) {
      setSyncStatus("Supabase schema needed", "offline");
      return;
    }
    setSyncStatus(`Supabase error: ${shortError(error)}`, "offline");
    console.error("Supabase connection failed", error);
  }
}

function askConfirm({ title, message, action = "Confirm", danger = false, notice = false }) {
  return new Promise((resolve) => {
    if (document.activeElement && typeof document.activeElement.blur === "function") {
      document.activeElement.blur();
    }

    els.confirmTitle.textContent = title;
    els.confirmMessage.textContent = message;
    els.confirmAction.textContent = action;
    els.confirmAction.classList.toggle("danger", danger);
    els.confirmCancel.hidden = notice;

    const onClose = () => {
      els.confirmDialog.removeEventListener("close", onClose);
      els.confirmCancel.hidden = false;
      if (document.activeElement && typeof document.activeElement.blur === "function") {
        document.activeElement.blur();
      }
      resolve(els.confirmDialog.returnValue === "confirm");
    };

    els.confirmDialog.addEventListener("close", onClose);
    els.confirmDialog.showModal();
  });
}

function getPlayerWinNotices(playerId) {
  return state.events.flatMap((event) => getEventPayouts(event)
    .filter((payout) => payout.playerId === playerId)
    .map((payout) => {
      const comboDetails = isTopThreeComboMarket(event)
        ? getComboBetDetails(event, event.bets.filter((bet) => bet.playerId === playerId))
        : null;
      const winningStake = comboDetails
        ? comboDetails.rows.reduce((total, row) => row.weightedStake > 0 ? total + Number(row.bet.value || 0) : total, 0)
        : event.bets
          .filter((bet) => bet.playerId === playerId && bet.outcome === event.winningOutcome)
          .reduce((total, bet) => total + Number(bet.value || 0), 0);
      const totalWinningStake = comboDetails?.totalWeightedStake ?? event.bets
        .filter((bet) => bet.outcome === event.winningOutcome)
        .reduce((total, bet) => total + Number(bet.value || 0), 0);
      const playerWeightedStake = comboDetails?.playerWeightedStake ?? winningStake;
      const share = totalWinningStake > 0 ? playerWeightedStake / totalWinningStake : 0;
      const bonusAmount = event.bonusAwarded ? Number(event.bonusPoints || 0) * share : 0;
      const player = state.players.find((item) => item.id === playerId);
      return {
        id: `${event.remoteId || event.id}:${payout.id || payout.playerId}:${Number(payout.noticeAmount ?? payout.amount).toFixed(4)}`,
        marketName: event.name,
        amount: payout.amount,
        winningOutcome: getComboResultLabel(event),
        stake: winningStake,
        bonusAmount,
        profit: winningStake > 0 ? Number(payout.amount || 0) - winningStake : null,
        balance: player ? player.points : null,
        createdAt: payout.createdAt || event.resolvedAt || event.createdAt || "",
      };
    }));
}

function checkPlayerWinPopups() {
  if (appMode !== "player" || !els.winDialog || els.winDialog.open || els.confirmDialog.open || els.aiDisclaimerDialog?.open) return;
  const player = getCurrentPlayer();
  if (!player) return;

  const notices = getPlayerWinNotices(player.id).sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  if (!winPopupsPrimed) {
    notices.forEach((notice) => seenWinPayouts.add(notice.id));
    saveSeenWinPayouts();
    markWinPopupsPrimed();
    return;
  }

  const freshNotice = notices.find((notice) => !seenWinPayouts.has(notice.id));
  if (!freshNotice) return;

  seenWinPayouts.add(freshNotice.id);
  saveSeenWinPayouts();
  renderWinPopup(freshNotice);
  els.winDialog.showModal();
  animateWinAmount(freshNotice.amount);
}

function renderWinPopup(notice) {
  els.winAmount.textContent = formatWinAmount(notice.amount);
  els.winAmount.classList.remove("final-pop");
  els.winMarket.textContent = notice.marketName || "this market";
  setWinSlipRow(els.winPickRow, els.winPick, notice.winningOutcome);
  setWinSlipRow(els.winStakeRow, els.winStake, notice.stake > 0 ? money(notice.stake) : "");
  setWinSlipRow(els.winBonusRow, els.winBonus, notice.bonusAmount > 0 ? `+${money(notice.bonusAmount)}` : "");
  setWinSlipRow(els.winProfitRow, els.winProfit, Number.isFinite(notice.profit) ? `${notice.profit >= 0 ? "+" : ""}${money(notice.profit)}` : "");
  setWinSlipRow(els.winBalanceRow, els.winBalance, Number.isFinite(notice.balance) ? money(notice.balance) : "");
}

function setWinSlipRow(row, valueEl, value) {
  if (!row || !valueEl) return;
  const hasValue = value !== null && value !== undefined && value !== "";
  row.hidden = !hasValue;
  if (hasValue) valueEl.textContent = value;
}

function formatWinAmount(value) {
  return `+${money(value)} points`;
}

function animateWinAmount(finalAmount) {
  if (!els.winAmount) return;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (reducedMotion) {
    els.winAmount.textContent = formatWinAmount(finalAmount);
    return;
  }

  const duration = 850;
  const start = performance.now();
  els.winAmount.classList.remove("final-pop");

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    els.winAmount.textContent = formatWinAmount(finalAmount * eased);
    if (progress < 1) {
      requestAnimationFrame(tick);
      return;
    }
    els.winAmount.textContent = formatWinAmount(finalAmount);
    els.winAmount.classList.add("final-pop");
  }

  requestAnimationFrame(tick);
}

function showAiDisclaimerOnce() {
  if (appMode !== "player" || !els.aiDisclaimerDialog || localStorage.getItem(aiDisclaimerKey) === "yes") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const dialog = els.aiDisclaimerDialog;
    dialog.addEventListener("close", () => {
      localStorage.setItem(aiDisclaimerKey, "yes");
      resolve();
    }, { once: true });
    dialog.showModal();
  });
}

function getPlayerJoinUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("mode", "player");
  url.searchParams.delete("device");
  return url.toString();
}

async function showPlayerQrCode() {
  if (!requireHostMode()) return;
  const playerUrl = getPlayerJoinUrl();
  els.playerQrUrl.textContent = playerUrl;
  els.playerQrFallback.hidden = true;
  els.playerQrCode.hidden = false;

  if (window.QRCode?.toCanvas) {
    window.QRCode.toCanvas(els.playerQrCode, playerUrl, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 260,
      color: {
        dark: "#0b0b0b",
        light: "#ffffff",
      },
    });
  } else {
    els.playerQrCode.hidden = true;
    els.playerQrFallback.hidden = false;
    els.playerQrFallback.src = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(playerUrl)}`;
  }

  els.qrDialog.showModal();
}

function sortPlayers(players = state.players) {
  return [...players].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}

function getReservedByPlayer(playerId, excludedBet) {
  return state.events.reduce((total, event) => {
    if (event.status !== "open") return total;
    return total + event.bets.reduce((betTotal, bet) => {
      if (bet.playerId !== playerId) return betTotal;
      if (excludedBet?.betId && bet.id === excludedBet.betId) return betTotal;
      return betTotal + bet.value;
    }, 0);
  }, 0);
}

function getAvailablePoints(playerId, excludedBet) {
  const player = state.players.find((item) => item.id === playerId);
  if (!player) return 0;
  return Math.max(0, player.points - getReservedByPlayer(playerId, excludedBet));
}

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

function getProfileWeight(profile, marketType) {
  const topThreeWeight = profile.survivability * 0.40 + profile.consistency * 0.30 + profile.skill * 0.20 + profile.recentForm * 0.10;
  switch (marketType) {
    case "Winner":
      return profile.skill * 0.45 + profile.survivability * 0.25 + profile.recentForm * 0.20 + profile.aggression * 0.10;
    case "TopThree":
    case "TopThreeCombo":
    case "LastLonger":
      return topThreeWeight;
    case "BottomThreeCombo":
      return Math.max(1, 100 - topThreeWeight);
    case "FirstOut":
      return (100 - profile.survivability) * 0.45 + profile.volatility * 0.30 + (100 - profile.consistency) * 0.20 + profile.aggression * 0.05;
    case "Knockout":
      return profile.aggression * 0.40 + profile.skill * 0.30 + profile.volatility * 0.20 + profile.recentForm * 0.10;
    case "Chaos":
      return profile.volatility * 0.50 + profile.aggression * 0.30 + (100 - profile.consistency) * 0.20;
    case "Custom":
    default:
      return 1;
  }
}

function buildSeededOutcomes(marketType, profiles = state.playerProfiles.filter((profile) => profile.attending !== false)) {
  const includedProfiles = profiles.length ? profiles : state.playerProfiles;
  const weights = includedProfiles.map((profile) => Math.max(0.01, getProfileWeight(profile, marketType)));
  const totalWeight = weights.reduce((total, weight) => total + weight, 0) || 1;
  return includedProfiles.map((profile, index) => {
    const weight = weights[index];
    const probability = weight / totalWeight;
    return {
      id: uid(),
      label: profile.playerName,
      profileId: profile.playerId,
      weight,
      probability,
      seedLiquidity: DEFAULT_SEED_POOL * probability,
    };
  });
}

function refreshProfileSeededOutcomes(outcomes) {
  const profilesById = new Map(state.playerProfiles.map((profile) => [profile.playerId, profile]));
  const profileIds = [...new Set(outcomes.map((outcome) => outcome.profileId).filter(Boolean))];
  const profiles = profileIds.map((profileId) => profilesById.get(profileId)).filter(Boolean);
  const manualOutcomes = outcomes
    .filter((outcome) => normalizeOutcomeLabel(outcome.label) && !outcome.profileId)
    .map((outcome) => ({
      ...outcome,
      label: normalizeOutcomeLabel(outcome.label),
      weight: 0,
      probability: 0,
      seedLiquidity: 0,
    }));

  if (!profiles.length) return manualOutcomes;
  return [...buildSeededOutcomes(els.marketType.value, profiles), ...manualOutcomes];
}

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

function remoteReady() {
  return Boolean(remote.enabled && remote.client && remote.session);
}

async function loadRemoteState() {
  if (!remoteReady()) return;

  const sessionId = remote.session.id;
  const [{ data: players, error: playersError }, { data: markets, error: marketsError }, { data: adjustments, error: adjustmentsError }] = await Promise.all([
    remote.client.from("players").select("*").eq("session_id", sessionId).order("created_at", { ascending: true }),
    remote.client.from("markets").select("*").eq("session_id", sessionId).order("created_at", { ascending: false }),
    remote.client.from("adjustments").select("*").eq("session_id", sessionId).order("created_at", { ascending: true }),
  ]);

  if (playersError) throw playersError;
  if (marketsError) throw marketsError;
  if (adjustmentsError) throw adjustmentsError;

  const marketIds = (markets || []).map((market) => market.id);
  const remoteOutcomes = marketIds.length
    ? await remote.client.from("outcomes").select("*").in("market_id", marketIds)
    : { data: [], error: null };
  const remoteBets = marketIds.length
    ? await remote.client.from("bets").select("*").in("market_id", marketIds).eq("is_active", true)
    : { data: [], error: null };
  const remotePayouts = marketIds.length
    ? await remote.client.from("payouts").select("*").in("market_id", marketIds)
    : { data: [], error: null };

  if (remoteOutcomes.error) throw remoteOutcomes.error;
  if (remoteBets.error) throw remoteBets.error;
  if (remotePayouts.error) throw remotePayouts.error;

  const playerIdByRemoteId = new Map();
  state.players = (players || []).map((player) => {
    const localId = player.client_id || player.id;
    playerIdByRemoteId.set(player.id, localId);
    return {
      id: localId,
      remoteId: player.id,
      name: player.display_name,
      points: Number(player.points),
      startingPoints: Number(player.starting_points),
      status: player.status,
      deviceId: player.device_id,
      createdAt: player.created_at,
      adjustments: (adjustments || [])
        .filter((adjustment) => adjustment.player_id === player.id)
        .map((adjustment) => ({
          id: adjustment.id,
          type: Number(adjustment.amount) >= 0 ? "bonus" : "penalty",
          value: Math.abs(Number(adjustment.amount)),
          createdAt: adjustment.created_at,
        })),
    };
  });

  const outcomesById = new Map((remoteOutcomes.data || []).map((outcome) => [outcome.id, outcome]));
  const outcomesByMarket = groupBy(remoteOutcomes.data || [], "market_id");
  const betsByMarket = groupBy(remoteBets.data || [], "market_id");
  const payoutsByMarket = groupBy(remotePayouts.data || [], "market_id");

  state.events = (markets || []).map((market) => {
    const eventOutcomes = outcomesByMarket.get(market.id) || [];
    const selection = market.winning_selection || {};
    const seededByLabel = new Map((selection.seeded_outcomes || []).map((outcome) => [String(outcome.label || "").toLowerCase(), outcome]));
    const winningOutcome = market.winning_outcome_id
      ? outcomesById.get(market.winning_outcome_id)?.label
      : market.status === "voided" ? "Voided / refunded" : null;
    return {
      id: market.client_id || market.id,
      remoteId: market.id,
      name: market.title,
      status: market.status,
      marketType: market.market_type,
      payoutMode: market.payout_mode,
      payoutMultiplier: Number(market.payout_multiplier),
      taxRate: Number(market.tax_rate),
      bonusPoints: Number(market.bonus_points),
      bonusLabel: market.bonus_label,
      bonusAwarded: Boolean(selection.bonus_awarded),
      profileMarketType: selection.market_type || "Custom",
      seedPool: Number(selection.seed_pool || 0),
      winningSelections: Array.isArray(selection.combo_result) ? selection.combo_result.map(normalizeOutcomeLabel).filter(Boolean).slice(0, 3) : [],
      winningOutcome,
      createdAt: market.created_at,
      lockedAt: market.locked_at,
      resolvedAt: market.resolved_at,
      stakesLocked: Boolean(market.locked_at || market.resolved_at || market.voided_at),
      bets: (betsByMarket.get(market.id) || []).map((bet) => {
        const outcome = outcomesById.get(bet.outcome_id);
        const selections = Array.isArray(bet.selections)
          ? bet.selections.map((selectionId) => outcomesById.get(selectionId)?.label || selectionId).map(normalizeOutcomeLabel).filter(Boolean)
          : [];
        return {
          id: bet.client_id || bet.id,
          remoteId: bet.id,
          playerId: playerIdByRemoteId.get(bet.player_id),
          value: Number(bet.stake),
          outcome: outcome?.label || "Unknown outcome",
          selections,
          outcomeRemoteId: bet.outcome_id,
          createdAt: bet.created_at,
          updatedAt: bet.updated_at,
        };
      }).filter((bet) => bet.playerId),
      payouts: (payoutsByMarket.get(market.id) || []).map((payout) => ({
        id: payout.id,
        playerId: playerIdByRemoteId.get(payout.player_id),
        amount: Number(payout.amount),
        createdAt: payout.created_at,
      })).filter((payout) => payout.playerId),
      outcomes: eventOutcomes.map((outcome) => {
        const seeded = seededByLabel.get(String(outcome.label || "").toLowerCase()) || {};
        return {
          id: outcome.client_id || outcome.id,
          remoteId: outcome.id,
          label: outcome.label,
          profileId: seeded.profile_id || null,
          weight: Number(seeded.weight || 0),
          probability: Number(seeded.probability || 0),
          seedLiquidity: Number(seeded.seed_liquidity || 0),
        };
      }),
    };
  });
  recalculateRemotePlayerPoints();

  if (appMode === "player") {
    const devicePlayer = state.players.find((player) => player.deviceId === deviceKey);
    if (devicePlayer) {
      currentPlayerId = devicePlayer.id;
      localStorage.setItem(`oleary-player-id-${deviceKey}`, currentPlayerId);
    }
  }

  render();
  checkPlayerWinPopups();
  updatePlayerAutoRefresh();
}

function recalculateRemotePlayerPoints() {
  const pointsByPlayer = new Map(state.players.map((player) => {
    const adjustmentTotal = (player.adjustments || []).reduce((total, adjustment) => {
      return total + (adjustment.type === "bonus" ? adjustment.value : -adjustment.value);
    }, 0);
    return [player.id, Number(player.startingPoints || 0) + adjustmentTotal];
  }));

  state.events.forEach((event) => {
    if (event.status === "locked" || event.status === "resolved") {
      event.bets.forEach((bet) => {
        pointsByPlayer.set(bet.playerId, (pointsByPlayer.get(bet.playerId) || 0) - Number(bet.value || 0));
      });
    }

    if (event.status === "resolved") {
      getEventPayouts(event).forEach((payout) => {
        pointsByPlayer.set(payout.playerId, (pointsByPlayer.get(payout.playerId) || 0) + Number(payout.amount || 0));
      });
    }
  });

  state.players.forEach((player) => {
    player.points = pointsByPlayer.get(player.id) ?? player.points;
  });
}

async function saveRemoteMarket(event) {
  if (!remoteReady()) return;

  const winningSelection = buildWinningSelectionPayload(event);
  const payload = {
    session_id: remote.session.id,
    client_id: event.id,
    title: event.name,
    status: event.status,
    market_type: event.marketType || "single",
    payout_mode: event.payoutMode || "pool",
    payout_multiplier: Number(event.payoutMultiplier || 1),
    tax_rate: Number(event.taxRate ?? TAX_RATE),
    bonus_points: Number(event.bonusPoints || 0),
    bonus_label: event.bonusLabel || null,
    locked_at: event.status === "locked" && !event.lockedAt ? new Date().toISOString() : event.lockedAt || null,
    resolved_at: event.status === "resolved" ? event.resolvedAt || new Date().toISOString() : null,
    voided_at: event.status === "voided" ? event.voidedAt || new Date().toISOString() : null,
    winning_selection: winningSelection,
  };

  payload.winning_outcome_id = null;

  if (event.remoteId) {
    const { data: updated, error } = await remote.client
      .from("markets")
      .update(payload)
      .eq("id", event.remoteId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (updated) {
      if (event.winningOutcome && event.status === "resolved" && !isTopThreeComboMarket(event)) {
        const outcome = await ensureRemoteOutcome(event, event.winningOutcome);
        const { error: winningError } = await remote.client
          .from("markets")
          .update({ winning_outcome_id: outcome.id, winning_selection: buildWinningSelectionPayload(event) })
          .eq("id", event.remoteId);
        if (winningError) throw winningError;
      }
      return;
    }
    event.remoteId = null;
    payload.winning_outcome_id = null;
    payload.winning_selection = buildWinningSelectionPayload(event);
    event.outcomes = (event.outcomes || []).map((outcome) => ({ ...outcome, remoteId: null }));
  }

  const { data, error } = await remote.client
    .from("markets")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  event.remoteId = data.id;
  if (event.winningOutcome && event.status === "resolved" && !isTopThreeComboMarket(event)) {
    const outcome = await ensureRemoteOutcome(event, event.winningOutcome);
    const { error: winningError } = await remote.client
      .from("markets")
      .update({ winning_outcome_id: outcome.id, winning_selection: buildWinningSelectionPayload(event) })
      .eq("id", event.remoteId);
    if (winningError) throw winningError;
  }
}

function buildWinningSelectionPayload(event) {
  const seededOutcomes = (event.outcomes || [])
    .filter((outcome) => Number(outcome.weight || 0) > 0 || Number(outcome.seedLiquidity || 0) > 0)
    .map((outcome) => ({
      label: outcome.label,
      profile_id: outcome.profileId || null,
      weight: Number(outcome.weight || 0),
      probability: Number(outcome.probability || 0),
      seed_liquidity: Number(outcome.seedLiquidity || 0),
    }));
  const payload = {
    market_type: event.profileMarketType || "Custom",
    seed_pool: Number(event.seedPool || 0),
    seeded_outcomes: seededOutcomes,
  };
  if (event.status === "resolved" || event.bonusAwarded !== undefined) {
    payload.bonus_awarded = Boolean(event.bonusAwarded);
  }
  if (isTopThreeComboMarket(event)) {
    payload.combo_result = getComboResult(event);
  }
  return payload;
}

async function saveRemotePlayer(player) {
  if (!remoteReady()) return;

  const payload = {
    session_id: remote.session.id,
    client_id: player.id,
    display_name: player.name,
    status: player.status || "approved",
    starting_points: Number(player.startingPoints ?? player.points ?? 100),
    points: Number(player.points),
  };

  if (player.remoteId) {
    const { data: updated, error } = await remote.client
      .from("players")
      .update(payload)
      .eq("id", player.remoteId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (updated) return;
    player.remoteId = null;
  }

  const { data, error } = await remote.client
    .from("players")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  player.remoteId = data.id;
}

async function joinCurrentSession(name) {
  if (!remoteReady()) {
    await askConfirm({
      title: "Session not ready",
      message: "The shared session is still loading. Tap Refresh and try again.",
      action: "OK",
      notice: true,
    });
    return;
  }

  if (remote.session.joining_enabled === false) {
    await askConfirm({
      title: "Joining is closed",
      message: "The host has closed player joining for this session.",
      action: "OK",
      notice: true,
    });
    return;
  }

  const points = Number(remote.session.default_player_points ?? 100);
  const player = {
    id: uid(),
    name,
    points,
    startingPoints: points,
    status: "approved",
    deviceId: deviceKey,
    adjustments: [],
  };

  const { data, error } = await remote.client
    .from("players")
    .insert({
      session_id: remote.session.id,
      client_id: player.id,
      display_name: player.name,
      device_id: deviceKey,
      status: "approved",
      starting_points: points,
      points,
    })
    .select("*")
    .single();

  if (error) {
    setSyncStatus(`Join error: ${shortError(error)}`, "offline");
    await askConfirm({
      title: "Could not join",
      message: shortError(error),
      action: "OK",
      notice: true,
    });
    return;
  }

  player.remoteId = data.id;
  currentPlayerId = player.id;
  localStorage.setItem(`oleary-player-id-${deviceKey}`, currentPlayerId);
  state.players.push(player);
  render();
  await loadRemoteState();
  await showAiDisclaimerOnce();
}

async function saveRemoteSessionSettings(settings) {
  if (!remoteReady()) return;
  const { data, error } = await remote.client
    .from("sessions")
    .update({
      title: settings.title,
      default_player_points: settings.defaultPlayerPoints,
      joining_enabled: settings.joiningEnabled,
    })
    .eq("id", remote.session.id)
    .select("*")
    .single();
  if (error) throw error;
  remote.session = data;
  els.startingPoints.value = Number(remote.session.default_player_points ?? 100);
}

async function ensureRemoteOutcome(event, label) {
  if (!remoteReady()) return null;
  if (!event.remoteId) await saveRemoteMarket(event);

  const existing = (event.outcomes || []).find((outcome) => outcome.label.toLowerCase() === label.toLowerCase());
  if (existing?.remoteId) return { id: existing.remoteId, label: existing.label };

  const { data: found, error: findError } = await remote.client
    .from("outcomes")
    .select("*")
    .eq("market_id", event.remoteId)
    .ilike("label", label)
    .maybeSingle();

  if (findError) throw findError;
  if (found) {
    event.outcomes = event.outcomes || [];
    const localOutcome = event.outcomes.find((outcome) => outcome.label.toLowerCase() === found.label.toLowerCase());
    if (localOutcome) {
      localOutcome.remoteId = found.id;
      localOutcome.id = localOutcome.id || found.client_id || found.id;
    } else {
      event.outcomes.push({ id: found.client_id || found.id, remoteId: found.id, label: found.label });
    }
    return found;
  }

  const outcomeClientId = `${event.id}:${label.toLowerCase()}`;
  const { data, error } = await remote.client
    .from("outcomes")
    .insert({
      market_id: event.remoteId,
      client_id: outcomeClientId,
      label,
    })
    .select("*")
    .single();

  if (error) throw error;
  event.outcomes = event.outcomes || [];
  const localOutcome = event.outcomes.find((outcome) => outcome.label.toLowerCase() === data.label.toLowerCase());
  if (localOutcome) {
    localOutcome.remoteId = data.id;
    localOutcome.id = localOutcome.id || outcomeClientId;
  } else {
    event.outcomes.push({ id: outcomeClientId, remoteId: data.id, label: data.label });
  }
  return data;
}

async function saveRemoteBet(event, bet) {
  if (!remoteReady()) return;

  const player = state.players.find((item) => item.id === bet.playerId);
  if (!player) return;
  bet.id = bet.id || uid();

  if (!player.remoteId) await saveRemotePlayer(player);
  if (!event.remoteId) await saveRemoteMarket(event);
  if (event.status === "open") {
    const { data: latestMarket, error: marketError } = await remote.client
      .from("markets")
      .select("status")
      .eq("id", event.remoteId)
      .single();
    if (marketError) throw marketError;
    if (latestMarket.status !== "open") {
      event.status = latestMarket.status;
      throw new Error("Cannot place bet. Market has closed.");
    }
  }
  const selectionLabels = isTopThreeComboMarket(event) ? getComboSelections(bet) : [];
  const remoteSelections = [];
  for (const label of selectionLabels) {
    const remoteOutcome = await ensureRemoteOutcome(event, label);
    remoteSelections.push(remoteOutcome.id);
  }
  const outcome = isTopThreeComboMarket(event)
    ? await ensureRemoteOutcome(event, selectionLabels[0] || bet.outcome)
    : await ensureRemoteOutcome(event, bet.outcome);

  const payload = {
    market_id: event.remoteId,
    player_id: player.remoteId,
    outcome_id: outcome.id,
    client_id: bet.id,
    stake: Number(bet.value),
    selections: isTopThreeComboMarket(event) ? remoteSelections : [outcome.id],
    is_active: true,
  };

  if (bet.remoteId) {
    const { data, error } = await remote.client
      .from("bets")
      .update(payload)
      .eq("id", bet.remoteId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (data) {
      bet.remoteId = data.id;
      bet.outcomeRemoteId = data.outcome_id;
      return;
    }
    bet.remoteId = null;
  }

  const { data: existing, error: findError } = await remote.client
    .from("bets")
    .select("*")
    .eq("market_id", event.remoteId)
    .eq("client_id", bet.id)
    .maybeSingle();

  if (findError) throw findError;

  if (existing) {
    const { data, error } = await remote.client
      .from("bets")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    bet.remoteId = data.id;
    bet.outcomeRemoteId = data.outcome_id;
    return;
  }

  const { data, error } = await remote.client
    .from("bets")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  bet.remoteId = data.id;
  bet.outcomeRemoteId = data.outcome_id;
}

async function deleteRemoteBet(event, playerId, betId = null) {
  if (!remoteReady() || !event.remoteId) return;
  const player = state.players.find((item) => item.id === playerId);
  if (!player?.remoteId) return;

  let query = remote.client
    .from("bets")
    .delete()
    .eq("market_id", event.remoteId)
    .eq("player_id", player.remoteId);

  if (betId) {
    const bet = event.bets.find((item) => item.id === betId);
    query = bet?.remoteId ? query.eq("id", bet.remoteId) : query.eq("client_id", betId);
  }

  const { error } = await query;

  if (error) throw error;
}

async function saveRemotePayouts(event) {
  if (!remoteReady() || !event.remoteId) return;

  await remote.client.from("payouts").delete().eq("market_id", event.remoteId);
  const rows = getEventPayouts(event).map((payout) => {
    const player = state.players.find((item) => item.id === payout.playerId);
    if (!player?.remoteId) return null;
    return {
      market_id: event.remoteId,
      player_id: player.remoteId,
      amount: Number(payout.amount),
    };
  }).filter(Boolean);

  if (!rows.length) return;
  const { error } = await remote.client.from("payouts").insert(rows);
  if (error) throw error;
}

async function deleteRemoteEvent(event) {
  if (!remoteReady() || !event.remoteId) return;
  const { error } = await remote.client.from("markets").delete().eq("id", event.remoteId);
  if (error) throw error;
}

async function deleteRemotePlayer(player) {
  if (!remoteReady() || !player?.remoteId) return;
  const { error } = await remote.client.from("players").delete().eq("id", player.remoteId);
  if (error) throw error;
}

async function saveRemoteAdjustment(player, adjustment) {
  if (!remoteReady()) return;
  await saveRemotePlayer(player);
  const amount = adjustment.type === "bonus" ? Number(adjustment.value) : -Number(adjustment.value);
  const { error } = await remote.client.from("adjustments").insert({
    session_id: remote.session.id,
    player_id: player.remoteId,
    amount,
    label: adjustment.type,
    created_by: "host",
  });
  if (error) throw error;
}

async function clearRemoteSession() {
  if (!remoteReady()) return;
  const { error: marketsError } = await remote.client.from("markets").delete().eq("session_id", remote.session.id);
  if (marketsError) throw marketsError;
  const { error: playersError } = await remote.client.from("players").delete().eq("session_id", remote.session.id);
  if (playersError) throw playersError;
}

async function pushStateToRemote() {
  if (!remoteReady()) return;
  for (const player of state.players) {
    await saveRemotePlayer(player);
  }
  for (const event of state.events) {
    await saveRemoteMarket(event);
    for (const bet of event.bets) {
      await saveRemoteBet(event, bet);
    }
    if (event.status === "resolved") {
      await saveRemoteMarket(event);
      await saveRemotePayouts(event);
    }
  }
}

function renderOutcomeFields(items = ["", ""]) {
  const outcomes = items.map(normalizeOutcome);
  els.outcomeFields.innerHTML = outcomes.map((outcome, index) => `
    <div class="outcome-field">
      <input
        data-outcome-field
        data-profile-id="${escapeAttr(outcome.profileId || "")}"
        data-outcome-weight="${Number(outcome.weight || 0)}"
        data-outcome-probability="${Number(outcome.probability || 0)}"
        data-seed-liquidity="${Number(outcome.seedLiquidity || 0)}"
        type="text"
        placeholder="Outcome ${index + 1}"
        autocomplete="off"
      />
      <button class="danger x-button" type="button" data-remove-outcome="${index}" aria-label="Remove outcome" ${outcomes.length <= 2 ? "disabled" : ""}>x</button>
      ${outcome.seedLiquidity > 0 ? `<span class="seed-note">${money(outcome.probability * 100)}% seed · ${money(outcome.seedLiquidity)} virtual</span>` : ""}
    </div>
  `).join("");
  document.querySelectorAll("[data-outcome-field]").forEach((input, index) => {
    input.value = outcomes[index]?.label || "";
  });
}

function getOutcomeFieldLabels() {
  return [...new Set(getOutcomeFieldItems()
    .map((outcome) => normalizeOutcomeLabel(outcome.label))
    .filter(Boolean))];
}

function getOutcomeFieldItems() {
  const seen = new Set();
  return Array.from(document.querySelectorAll("[data-outcome-field]"))
    .map((input) => {
      const label = normalizeOutcomeLabel(input.value);
      if (!label) return null;
      const key = label.toLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        id: uid(),
        label,
        profileId: input.dataset.profileId || null,
        weight: Number(input.dataset.outcomeWeight || 0),
        probability: Number(input.dataset.outcomeProbability || 0),
        seedLiquidity: Number(input.dataset.seedLiquidity || 0),
      };
    })
    .filter(Boolean);
}

function getOutcomeFieldDraftItems() {
  const inputs = Array.from(document.querySelectorAll("[data-outcome-field]"));
  if (!inputs.length) return ["", ""];
  return inputs.map((input) => ({
    id: uid(),
    label: normalizeOutcomeLabel(input.value),
    profileId: input.dataset.profileId || null,
    weight: Number(input.dataset.outcomeWeight || 0),
    probability: Number(input.dataset.outcomeProbability || 0),
    seedLiquidity: Number(input.dataset.seedLiquidity || 0),
  }));
}

async function runRemote(task) {
  if (!remoteReady()) {
    if (supabaseConfigured()) setSyncStatus("Supabase not ready", "offline");
    return false;
  }
  try {
    await task();
    setSyncStatus(`Supabase synced · Session ${remote.session.join_code}`, "online");
    return true;
  } catch (error) {
    console.error("Supabase sync failed", error);
    setSyncStatus(`Sync error: ${shortError(error)}`, "offline");
    return false;
  }
}

async function placeBet(event, nextBet) {
  const previousBets = [...event.bets];
  if (isTopThreeComboMarket(event) && !nextBet.id && event.bets.some((bet) => bet.playerId === nextBet.playerId)) {
    await askConfirm({
      title: "One combo bet only",
      message: `${getComboMarketName(event)} markets allow one bet per player. Edit your existing combo bet instead.`,
      action: "OK",
      notice: true,
    });
    return;
  }
  if (!isTopThreeComboMarket(event) && !nextBet.id && event.bets.some((bet) => bet.playerId === nextBet.playerId)) {
    await askConfirm({
      title: "One bet per market",
      message: "You already have a bet on this market. Edit your existing bet instead.",
      action: "OK",
      notice: true,
    });
    return;
  }
  const bet = { ...nextBet, id: nextBet.id || uid(), createdAt: nextBet.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
  const existingIndex = event.bets.findIndex((item) => item.id === bet.id);
  if (existingIndex >= 0) {
    event.bets[existingIndex] = { ...event.bets[existingIndex], ...bet };
  } else {
    event.bets.push(bet);
  }
  render();

  if (!remoteReady()) {
    markBetSuccess(event.id, bet.id);
    return;
  }

  const saved = await runRemote(() => saveRemoteBet(event, bet));
  if (!saved) {
    event.bets = previousBets;
    await loadRemoteState();
    await askConfirm({
      title: "Cannot place bet",
      message: "Market has closed.",
      action: "OK",
      notice: true,
    });
  } else {
    markBetSuccess(event.id, bet.id);
  }
}

function markBetSuccess(eventId, betId) {
  highlightedEventId = eventId;
  highlightedBetId = betId;
  if (highlightTimer) clearTimeout(highlightTimer);
  render();
  highlightTimer = setTimeout(() => {
    highlightedEventId = null;
    highlightedBetId = null;
    highlightTimer = null;
    render();
  }, 900);
}

function render() {
  saveState();
  renderMode();
  renderTabs();
  renderPlayers();
  renderProfiles();
  renderEvents();
  renderHostSocial();
  renderPlayerMode();
  refreshOpenPlayerMarketDetail();
}

function renderMode() {
  const isPlayer = appMode === "player";
  document.body.classList.toggle("player-mode", isPlayer);
  document.querySelector("nav.tabs:not(#playerTabs)").hidden = isPlayer;
  els.playerTabs.hidden = !isPlayer || !getCurrentPlayer();
  els.sessionPanel.hidden = isPlayer;
  els.playersPanel.hidden = isPlayer;
  els.profilesPanel.hidden = isPlayer;
  els.createMarketPanel.hidden = isPlayer;
  els.eventsPanel.hidden = isPlayer;
  els.socialPanel.hidden = isPlayer;
  els.playerJoinPanel.hidden = !isPlayer || Boolean(getCurrentPlayer());
  els.playerProfilePanel.hidden = !isPlayer || !getCurrentPlayer();
  els.playerMarketsPanel.hidden = !isPlayer || !getCurrentPlayer();
  els.playerBetsPanel.hidden = !isPlayer || !getCurrentPlayer();
  els.playerAnalyticsPanel.hidden = !isPlayer || !getCurrentPlayer();
  els.playerSocialPanel.hidden = !isPlayer || !getCurrentPlayer();
  els.exportData.hidden = isPlayer;
  els.importData.closest(".file-button").hidden = isPlayer;
  els.resetNight.hidden = isPlayer;
}

function renderTabs() {
  if (appMode === "player") {
    renderPlayerTabs();
    return;
  }
  const showSession = activeTab === "session";
  const showPlayers = activeTab === "players";
  const showProfiles = activeTab === "profiles";
  const showCreateMarket = activeTab === "createMarket";
  const showEvents = activeTab === "events";
  const showSocial = activeTab === "social";
  els.sessionTab.classList.toggle("active", showSession);
  els.playersTab.classList.toggle("active", showPlayers);
  els.profilesTab.classList.toggle("active", showProfiles);
  els.createMarketTab.classList.toggle("active", showCreateMarket);
  els.eventsTab.classList.toggle("active", showEvents);
  els.socialTab.classList.toggle("active", showSocial);
  els.sessionPanel.classList.toggle("active", showSession);
  els.playersPanel.classList.toggle("active", showPlayers);
  els.profilesPanel.classList.toggle("active", showProfiles);
  els.createMarketPanel.classList.toggle("active", showCreateMarket);
  els.eventsPanel.classList.toggle("active", showEvents);
  els.socialPanel.classList.toggle("active", showSocial);
}

function renderPlayerTabs() {
  const showProfile = activePlayerTab === "profile";
  const showMarkets = activePlayerTab === "markets";
  const showBets = activePlayerTab === "bets";
  const showAnalytics = activePlayerTab === "analytics";
  const showSocial = activePlayerTab === "social";
  document.body.dataset.playerTabDirection = playerTabDirection;
  els.playerProfileTab.classList.toggle("active", showProfile);
  els.playerMarketsTab.classList.toggle("active", showMarkets);
  els.playerBetsTab.classList.toggle("active", showBets);
  els.playerAnalyticsTab.classList.toggle("active", showAnalytics);
  els.playerSocialTab.classList.toggle("active", showSocial);
  els.playerProfilePanel.classList.toggle("active", showProfile);
  els.playerMarketsPanel.classList.toggle("active", showMarkets);
  els.playerBetsPanel.classList.toggle("active", showBets);
  els.playerAnalyticsPanel.classList.toggle("active", showAnalytics);
  els.playerSocialPanel.classList.toggle("active", showSocial);
  updatePlayerAutoRefresh();
}

function renderPlayers() {
  const players = sortPlayers();
  const leaderPoints = players[0]?.points;

  if (players.length === 0) {
    els.playersList.innerHTML = '<div class="empty">Add players to start the session.</div>';
    return;
  }

  els.playersList.innerHTML = players.map((player) => {
    const reserved = getReservedByPlayer(player.id);
    const available = getAvailablePoints(player.id);
    const isLeader = player.points === leaderPoints;
    const isExpanded = expandedPlayers.has(player.id);

    return `
      <article class="player-row ${isExpanded ? "expanded" : ""}">
        <div class="player-main">
          <div>
            <button class="player-name-button" data-toggle-player="${player.id}">
              <span>${escapeHtml(player.name)}</span>
            </button>
            <div class="player-meta">
              ${isLeader ? '<span class="star" title="Current leader">★</span>' : ""}
              <span class="muted">${money(available)} available · ${money(reserved)} reserved</span>
            </div>
          </div>
          <div class="player-points">
            <span class="score">${money(player.points)}</span>
            <button class="ghost" data-remove-player="${player.id}" title="Remove player">Remove</button>
            <button class="ghost arrow-button" data-toggle-player="${player.id}" aria-label="${isExpanded ? "Collapse" : "Expand"} player">${isExpanded ? "^" : "v"}</button>
          </div>
        </div>
        ${isExpanded ? renderPlayerDetails(player) : ""}
      </article>
    `;
  }).join("");
}

function renderPlayerDetails(player) {
  const activity = getPlayerActivity(player.id);
  const adjustmentRows = (player.adjustments || []).slice(-5).reverse().map((adjustment) => `
    <div class="activity-row ${adjustment.type}">
      <span>${adjustment.type === "bonus" ? "Bonus" : "Penalty"}</span>
      <strong>${adjustment.type === "bonus" ? "+" : "-"}${money(adjustment.value)}</strong>
    </div>
  `).join("");

  return `
    <div class="player-details">
      <div class="activity-summary">
        <span><strong>${money(activity.staked)}</strong> staked</span>
        <span><strong>${money(activity.paid)}</strong> paid out</span>
        <span><strong>${money(activity.net)}</strong> net</span>
      </div>
      <div class="activity-list">
        ${activity.rows.length ? activity.rows.join("") : '<div class="empty compact">No bets yet.</div>'}
        ${adjustmentRows ? `<h3>Recent adjustments</h3>${adjustmentRows}` : ""}
      </div>
      <div class="adjust-form">
        <input data-adjust-value="${player.id}" type="number" min="1" step="1" placeholder="Points" aria-label="Adjustment points" />
        <button class="bonus" data-add-bonus="${player.id}">Add bonus</button>
        <button class="penalty" data-add-penalty="${player.id}">Add penalty</button>
      </div>
    </div>
  `;
}

function renderProfiles() {
  if (!els.profilesList) return;
  renderProfileOutcomePicker();
  els.profilesList.innerHTML = state.playerProfiles.map((profile) => `
    <article class="profile-row ${profile.attending === false ? "inactive" : ""}">
      <div class="profile-top">
        <input data-profile-name="${profile.playerId}" type="text" value="${escapeAttr(profile.playerName)}" aria-label="Profile name" />
        <label class="checkbox-row profile-attending">
          <input data-profile-attending="${profile.playerId}" type="checkbox" ${profile.attending === false ? "" : "checked"} />
          Attending
        </label>
        <button class="danger x-button" type="button" data-remove-profile="${profile.playerId}" aria-label="Remove profile">x</button>
      </div>
      <div class="profile-stats">
        ${PROFILE_STATS.map((stat) => `
          <label>
            <span>${profileStatLabel(stat)}</span>
            <input data-profile-stat="${profile.playerId}:${stat}" type="number" min="0" max="100" step="1" value="${profile[stat]}" />
          </label>
        `).join("")}
      </div>
    </article>
  `).join("");
}

function profileStatLabel(stat) {
  return stat.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function renderProfileOutcomePicker() {
  if (!els.profileOutcomeSelect) return;
  const selected = els.profileOutcomeSelect.value;
  els.profileOutcomeSelect.innerHTML = `
    <option value="">Add player...</option>
    ${state.playerProfiles.map((profile) => `<option value="${escapeAttr(profile.playerId)}">${escapeHtml(profile.playerName)}${profile.attending === false ? " (not attending)" : ""}</option>`).join("")}
  `;
  els.profileOutcomeSelect.value = selected;
}

function getCurrentPlayer() {
  if (!currentPlayerId) return null;
  return state.players.find((player) => player.id === currentPlayerId || player.remoteId === currentPlayerId) || null;
}

function renderPlayerMode() {
  if (appMode !== "player") return;
  const player = getCurrentPlayer();
  if (!player) return;
  renderPlayerProfile(player);
  renderPlayerMarkets(player);
  renderPlayerBets(player);
  renderPlayerAnalytics(player);
  renderPlayerSocial(player);
}

function renderPlayerProfile(player) {
  const reserved = getReservedByPlayer(player.id);
  const available = getAvailablePoints(player.id);
  const activity = getPlayerActivity(player.id);

  els.playerProfile.innerHTML = `
    <div class="section-header">
      <div>
        <h2>${escapeHtml(player.name)}</h2>
        <p>Your profile for ${escapeHtml(remote.session?.title || "this session")}.</p>
      </div>
    </div>
    <div class="activity-summary">
      <span><strong>${money(player.points)}</strong> current</span>
      <span><strong>${money(available)}</strong> available</span>
      <span><strong>${money(reserved)}</strong> reserved</span>
    </div>
    <div class="activity-summary">
      <span><strong>${money(activity.paid)}</strong> won</span>
      <span><strong>${money(activity.staked)}</strong> staked</span>
      <span><strong>${money(activity.net)}</strong> net</span>
    </div>
    <details class="odds-menu" open>
      <summary>Betting history</summary>
      <div class="activity-list">${activity.rows.length ? activity.rows.join("") : '<div class="empty compact">No bets yet.</div>'}</div>
    </details>
  `;
}

function renderPlayerMarkets(player) {
  const markets = state.events.filter((event) => event.status !== "voided");
  if (markets.length === 0) {
    els.playerMarketsList.innerHTML = '<div class="empty">No markets published yet.</div>';
    return;
  }

  els.playerMarketsList.innerHTML = sortMarketsForDisplay(markets).map((event, index) => renderPlayerMarketCard(event, player, index)).join("");
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

function getMarketFavoriteDisplay(event) {
  const odds = getOdds(event)
    .filter((item) => item.total > 0)
    .sort((a, b) => getDisplayProfitPerPoint(event, a) - getDisplayProfitPerPoint(event, b));
  const count = event.profileMarketType === "TopThree" || isTopThreeComboMarket(event) ? 3 : 1;
  return odds.slice(0, count).map((item) => item.outcome).join(", ") || "No favourite yet";
}

function getMarketBadges(event) {
  const badges = [];
  if (event.status === "resolved") badges.push('<span class="player-badge resolved">Resolved</span>');
  if (event.status === "locked") badges.push('<span class="player-badge locked">Betting closed</span>');
  if (isTopThreeComboMarket(event)) badges.push(`<span class="player-badge combo">${getComboMarketName(event)}</span>`);
  if (event.bonusPoints > 0) badges.push('<span class="player-badge bonus">Bonus available</span>');
  return badges.join("");
}

function renderPlayerMarketCard(event, player, index = 0) {
  const pool = getEventPool(event);
  const summary = getMarketSummary(event);
  const animationAttrs = getMarketAnimationAttrs(event, index, "player-card");
  return `
    <button class="player-market-card market-type-${escapeAttr(String(event.profileMarketType || "custom").toLowerCase())}" data-open-player-market="${event.id}" ${animationAttrs}>
      <span class="player-market-icon" aria-hidden="true">${getMarketIcon(event)}</span>
      <span class="player-market-card-content">
        <span class="player-market-title-row">
          <strong>${escapeHtml(getMarketDisplayTitle(event))}</strong>
          <span class="player-market-badges">${getMarketBadges(event)}</span>
        </span>
        <span class="player-market-subtitle">${escapeHtml(getMarketSubtitle(event))}</span>
        <span class="player-market-stats">Pool: ${money(pool)} <i>&middot;</i> Payout pool: ${money(pool * (1 - TAX_RATE))}</span>
        <span class="player-market-stats">${summary.totalBets} bet${summary.totalBets === 1 ? "" : "s"} placed <i>&middot;</i> Favourite: ${escapeHtml(getMarketFavoriteDisplay(event))}</span>
      </span>
      <span class="player-market-chevron" aria-hidden="true">&rsaquo;</span>
    </button>
  `;
}

function renderPlayerMarketDetail(event, player) {
  const pool = getEventPool(event);
  const playerBets = event.bets.filter((item) => item.playerId === player.id);
  const canBet = event.status === "open";
  const summary = getMarketSummary(event);
  const highlightClass = event.id === highlightedEventId ? "success-pulse" : "";
  const isCombo = isTopThreeComboMarket(event);

  return `
    <article class="event-card player-market-detail-card ${highlightClass}">
      <div class="event-top">
        <div>
          <div class="event-meta">
            <span class="player-market-icon detail-icon" aria-hidden="true">${getMarketIcon(event)}</span>
            <div>
              <h2>${escapeHtml(getMarketDisplayTitle(event))}</h2>
              <p class="player-market-subtitle">${escapeHtml(getMarketSubtitle(event))}</p>
            </div>
            <span class="pill ${event.status}">${event.status}</span>
            ${isCombo ? `<span class="pill">${getComboMarketName(event)}</span>` : ""}
            ${event.bonusPoints > 0 ? '<span class="pill bonus-pill">✓ Bonus available</span>' : ""}
          </div>
          <p class="muted">Pool: ${money(pool)} · Payout pool: ${money(pool * (1 - TAX_RATE))}</p>
          ${isCombo ? '<p class="muted">Pick exactly 3 different names. Order does not matter. One combo bet per player.</p>' : ""}
          <div class="market-quick-info">
            <span><strong>${summary.totalBets}</strong> bet${summary.totalBets === 1 ? "" : "s"} placed</span>
            <span>Favorite: <strong>${escapeHtml(summary.favorite)}</strong></span>
          </div>
          ${renderMarketMovement(summary.movements)}
          ${renderPlayerMarketBets(event, playerBets)}
        </div>
        <div class="event-actions">
          <button class="ghost" data-refresh-market="${event.id}">Refresh Odds</button>
          <button ${canBet && playerBets.length === 0 ? "" : "disabled"} data-player-bet="${event.id}">${playerBets.length ? "Bet Placed" : canBet ? "Add Bet" : "Market Closed"}</button>
        </div>
      </div>
      <div class="event-body">
        ${event.bonusPoints > 0 ? `<p class="muted">Bonus: <strong>${money(event.bonusPoints)}</strong> · ${escapeHtml(event.bonusLabel || "Host-triggered bonus")}</p>` : ""}
        ${renderMarketOddsMenu(event, { showTotals: false, playerDefaultOpen: true })}
      </div>
    </article>
  `;
}

function renderPlayerMarketBets(event, playerBets) {
  if (!playerBets.length) return '<p class="muted">You have not bet on this market.</p>';
  return `
    <div class="player-bet-list">
      <p class="muted">Your bets:</p>
      ${playerBets.map((bet) => `
        <div class="player-bet-chip ${bet.id === highlightedBetId ? "success-pulse" : ""}">
          <span><strong>${money(bet.value)}</strong> on <strong>${escapeHtml(getBetPickText(bet))}</strong></span>
        </div>
      `).join("")}
    </div>
  `;
}

function openPlayerMarketDetail(eventId) {
  const player = getCurrentPlayer();
  const event = state.events.find((item) => item.id === eventId);
  if (!player || !event || !els.playerMarketDialog || !els.playerMarketDetail) return;
  els.playerMarketDialog.dataset.marketId = event.id;
  els.playerMarketDetail.innerHTML = renderPlayerMarketDetail(event, player);
  if (!els.playerMarketDialog.open) els.playerMarketDialog.showModal();
}

function refreshOpenPlayerMarketDetail() {
  if (!els.playerMarketDialog?.open) return;
  const eventId = els.playerMarketDialog.dataset.marketId;
  const player = getCurrentPlayer();
  const event = state.events.find((item) => item.id === eventId);
  if (!player || !event) {
    els.playerMarketDialog.close();
    return;
  }
  els.playerMarketDetail.innerHTML = renderPlayerMarketDetail(event, player);
}

function getOpenBetPotential(event, bet) {
  if (isTopThreeComboMarket(event) || event.status === "resolved") return null;
  const oddsItem = getOdds(event).find((item) => item.outcome === bet.outcome);
  if (!oddsItem || oddsItem.total <= 0) return null;
  const profitPerPoint = getDisplayProfitPerPoint(event, oddsItem);
  return Number(bet.value || 0) * (1 + profitPerPoint);
}

function renderPlayerBets(player) {
  if (!els.playerBetsList) return;
  const entries = state.events
    .map((event) => ({ event, bets: event.bets.filter((bet) => bet.playerId === player.id) }))
    .filter((entry) => entry.bets.length)
    .sort((a, b) => {
      const aResolved = a.event.status === "resolved";
      const bResolved = b.event.status === "resolved";
      if (aResolved !== bResolved) return aResolved ? 1 : -1;
      return new Date(b.event.createdAt || 0) - new Date(a.event.createdAt || 0);
    });

  if (!entries.length) {
    els.playerBetsList.innerHTML = '<div class="player-empty-state"><strong>No bets yet</strong><span>Open Markets and make your first pick.</span></div>';
    return;
  }

  const renderGroup = (title, rows) => rows.length ? `
    <section class="player-bet-group">
      <h3>${title} <span>${rows.length}</span></h3>
      ${rows.map(({ event, bets }) => {
        const stake = bets.reduce((total, bet) => total + Number(bet.value || 0), 0);
        const payout = getEventPayouts(event)
          .filter((item) => item.playerId === player.id)
          .reduce((total, item) => total + Number(item.amount || 0), 0);
        const potentials = bets.map((bet) => getOpenBetPotential(event, bet)).filter((value) => value !== null);
        const potential = potentials.length === bets.length ? potentials.reduce((total, value) => total + value, 0) : null;
        const resolved = event.status === "resolved";
        const resultClass = resolved ? (payout > 0 ? "win" : "loss") : "open";
        return `
          <article class="player-bet-screen-card ${resultClass} ${isTopThreeComboMarket(event) ? "combo-bet" : ""}">
            <span class="player-bet-screen-heading">
              <strong>${escapeHtml(getMarketDisplayTitle(event))}</strong>
              <span class="player-badge ${resultClass}">${resolved ? (payout > 0 ? "Won" : "Lost") : event.status}</span>
            </span>
            <span class="player-bet-picks">${bets.map((bet) => `${money(bet.value)} on ${escapeHtml(getBetPickText(bet))}`).join(" &middot; ")}</span>
            <span class="player-bet-return">
              <span>Staked <strong>${money(stake)}</strong></span>
              ${resolved ? `<span>Payout <strong>${money(payout)}</strong></span>` : potential !== null ? `<span>Potential <strong>${money(potential)}</strong></span>` : '<span>Pool payout</span>'}
            </span>
            <span class="player-bet-card-actions">
              <button class="ghost mini-button" data-open-player-market="${event.id}">View Market</button>
              ${event.status === "open" && bets[0] ? `<button data-player-bet="${event.id}" data-bet-id="${bets[0].id}">Edit Bet</button>` : ""}
            </span>
          </article>
        `;
      }).join("")}
    </section>
  ` : "";

  els.playerBetsList.innerHTML = `
    ${renderGroup("Open bets", entries.filter((entry) => entry.event.status !== "resolved"))}
    ${renderGroup("Resolved bets", entries.filter((entry) => entry.event.status === "resolved"))}
  `;
}

function renderPlayerAnalytics(player) {
  if (!els.playerAnalytics) return;
  const leaderboard = sortPlayers().slice(0, 5);
  const activeMarkets = state.events.filter((event) => event.status !== "voided");
  const mostBetMarket = [...activeMarkets].sort((a, b) => b.bets.length - a.bets.length)[0];
  const performance = state.players.map((item) => ({ player: item, net: getPlayerActivity(item.id).net }));
  const biggestWinner = [...performance].sort((a, b) => b.net - a.net)[0];
  const biggestLoser = [...performance].sort((a, b) => a.net - b.net)[0];
  const totalBets = state.events.reduce((total, event) => total + event.bets.length, 0);

  els.playerAnalytics.innerHTML = `
    <div class="analytics-hero">
      <span><strong>${state.players.length}</strong> players</span>
      <span><strong>${totalBets}</strong> bets</span>
      <span><strong>${activeMarkets.length}</strong> markets</span>
    </div>
    <section class="analytics-card leaderboard-card">
      <div class="analytics-title"><h3>Player leaderboard</h3><span>Your rank: ${sortPlayers().findIndex((item) => item.id === player.id) + 1}</span></div>
      ${leaderboard.map((item, index) => `
        <div class="leaderboard-row ${item.id === player.id ? "current" : ""}">
          <span class="leaderboard-rank">${index + 1}</span>
          <span class="leaderboard-avatar">${escapeHtml(item.name.charAt(0).toUpperCase())}</span>
          <strong>${escapeHtml(item.name)}</strong>
          <span>${money(item.points)}</span>
        </div>
      `).join("") || '<div class="empty compact">No players yet.</div>'}
    </section>
    <div class="analytics-grid">
      <section class="analytics-card">
        <p class="eyebrow">Most bet market</p>
        <h3>${mostBetMarket ? escapeHtml(getMarketDisplayTitle(mostBetMarket)) : "No data yet"}</h3>
        <p>${mostBetMarket ? `${mostBetMarket.bets.length} bets placed` : "Markets will appear here."}</p>
      </section>
      <section class="analytics-card">
        <p class="eyebrow">Biggest winner</p>
        <h3>${biggestWinner ? escapeHtml(biggestWinner.player.name) : "No data yet"}</h3>
        <p class="positive">${biggestWinner ? `${biggestWinner.net >= 0 ? "+" : ""}${money(biggestWinner.net)} net` : "Waiting for results"}</p>
      </section>
      <section class="analytics-card">
        <p class="eyebrow">Biggest loss</p>
        <h3>${biggestLoser ? escapeHtml(biggestLoser.player.name) : "No data yet"}</h3>
        <p class="negative">${biggestLoser ? `${money(biggestLoser.net)} net` : "Waiting for results"}</p>
      </section>
    </div>
  `;
}

function renderMarketMovement(movements) {
  if (!movements.length) return '<p class="muted compact-line">Market Movement: Waiting for bets</p>';
  return `
    <div class="market-movement">
      <span class="muted">Market Movement:</span>
      ${movements.map((item) => `
        <span class="movement ${item.direction}">
          ${escapeHtml(item.outcome)} ${item.direction === "up" ? "&uarr;" : "&darr;"}
        </span>
      `).join("")}
    </div>
  `;
}

function renderPlayerSocial(player) {
  renderSocialFeed(els.playerSocialList, player);
}

function renderHostSocial() {
  if (!els.hostSocialList) return;
  renderSocialFeed(els.hostSocialList, null);
}

function renderSocialFeed(target, currentPlayer = null) {
  if (!target) return;
  const rows = state.players
    .map((item) => ({ player: item, activity: getLatestPlayerActivity(item) }))
    .sort((a, b) => new Date(b.activity.at || 0) - new Date(a.activity.at || 0) || b.player.points - a.player.points || a.player.name.localeCompare(b.player.name));

  target.innerHTML = rows.length ? `
    <div class="social-feed">
      ${rows.map(({ player: item, activity }) => {
        const reserved = getReservedByPlayer(item.id);
        return `
          <div class="social-row">
            <div>
              <div class="social-name-line">
                <strong>${escapeHtml(item.name)}${currentPlayer && item.id === currentPlayer.id ? " (you)" : ""}</strong>
                ${activity.type === "win" ? '<span class="star" title="Recent win">🏆</span>' : ""}
              </div>
              <p class="muted">${escapeHtml(activity.text)}</p>
            </div>
            <div class="social-points">
              <strong>${money(item.points)}</strong>
              <span class="muted">${money(reserved)} reserved</span>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  ` : '<div class="empty">No players have joined yet.</div>';
}

function getLatestPlayerActivity(player) {
  const activities = [];

  state.events.forEach((event) => {
    const bets = event.bets.filter((item) => item.playerId === player.id);
    if (bets.length) {
      const latestBet = bets.reduce((latest, bet) => new Date(bet.updatedAt || bet.createdAt || 0) > new Date(latest.updatedAt || latest.createdAt || 0) ? bet : latest, bets[0]);
      const total = bets.reduce((sum, bet) => sum + bet.value, 0);
      activities.push({
        type: "bet",
        at: latestBet.updatedAt || latestBet.createdAt || event.createdAt,
        text: bets.length === 1
          ? `Bet ${money(latestBet.value)} on ${getBetPickText(latestBet)} in ${event.name}`
          : `Bet ${money(total)} across ${bets.length} picks in ${event.name}`,
      });
    }

    getEventPayouts(event)
      .filter((payout) => payout.playerId === player.id)
      .forEach((payout) => {
        activities.push({
          type: "win",
          at: payout.createdAt || event.resolvedAt || event.createdAt,
          text: `Won ${money(payout.amount)} points in ${event.name}`,
        });
      });
  });

  (player.adjustments || []).forEach((adjustment) => {
    activities.push({
      type: adjustment.type,
      at: adjustment.createdAt,
      text: `${adjustment.type === "bonus" ? "Received" : "Lost"} ${money(adjustment.value)} points ${adjustment.type === "bonus" ? "bonus" : "penalty"}`,
    });
  });

  activities.push({
    type: "join",
    at: player.createdAt || 0,
    text: "Joined the session",
  });

  return activities.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))[0];
}

function getPlayerActivity(playerId) {
  const rows = [];
  let staked = 0;
  let paid = 0;

  state.events.forEach((event) => {
    const bets = event.bets.filter((item) => item.playerId === playerId);
    if (!bets.length) return;

    const payout = getEventPayouts(event)
      .filter((item) => item.playerId === playerId)
      .reduce((total, item) => total + item.amount, 0);
    const stakeCounts = event.status === "locked" || event.status === "resolved";
    const totalStake = bets.reduce((total, bet) => total + bet.value, 0);
    const net = event.status === "resolved" ? payout - totalStake : 0;

    if (stakeCounts) staked += totalStake;
    if (event.status === "resolved") paid += payout;

    rows.push(`
      <div class="activity-entry">
      <div class="activity-row">
        <div>
          <strong>${escapeHtml(event.name)}</strong>
          <span class="muted">${bets.map((bet) => `${money(bet.value)} on ${escapeHtml(getBetPickText(bet))}`).join(" · ")}</span>
        </div>
        <span class="pill ${event.status}">${event.status === "resolved" ? `${net >= 0 ? "+" : ""}${money(net)}` : event.status}</span>
      </div>
      ${renderPayoutBreakdown(event, playerId, bets, payout)}
      </div>
    `);
  });

  return { rows, staked, paid, net: paid - staked };
}

function renderPayoutBreakdown(event, playerId, bets, payout) {
  if (isTopThreeComboMarket(event)) {
    return renderComboPayoutBreakdown(event, bets, payout);
  }

  if (event.status !== "resolved" || payout <= 0 || !event.winningOutcome) return "";

  const winningStake = bets
    .filter((bet) => bet.outcome === event.winningOutcome)
    .reduce((total, bet) => total + bet.value, 0);
  if (winningStake <= 0) return "";

  const totalWinningStake = event.bets
    .filter((bet) => bet.outcome === event.winningOutcome)
    .reduce((total, bet) => total + bet.value, 0);
  if (totalWinningStake <= 0) return "";

  const prizePool = getEventPool(event) * (1 - TAX_RATE);
  const share = winningStake / totalWinningStake;

  return `
    <details class="payout-breakdown">
      <summary>Payout breakdown</summary>
      <div class="payout-breakdown-grid">
        <span>Your stake</span><strong>${money(winningStake)}</strong>
        <span>Winning outcome</span><strong>${escapeHtml(event.winningOutcome)}</strong>
        <span>Total winning stake</span><strong>${money(totalWinningStake)}</strong>
        <span>Prize pool after tax</span><strong>${money(prizePool)}</strong>
        <span>Your share</span><strong>${formatRatio(share * 100)}%</strong>
        ${event.bonusAwarded ? `<span>Bonus included</span><strong>${money(Number(event.bonusPoints || 0) * share)}</strong>` : ""}
        <span>Final payout</span><strong>${money(payout)}</strong>
      </div>
    </details>
  `;
}

function renderComboPayoutBreakdown(event, bets, payout) {
  if (event.status !== "resolved" || payout <= 0) return "";
  const details = getComboBetDetails(event, bets);
  if (details.playerWeightedStake <= 0 || details.totalWeightedStake <= 0) return "";

  const totalStake = bets.reduce((total, bet) => total + Number(bet.value || 0), 0);
  const prizePool = getEventPool(event) * (1 - TAX_RATE);
  const share = details.playerWeightedStake / details.totalWeightedStake;
  const bestMatch = details.rows.reduce((best, row) => row.matchCount > best.matchCount ? row : best, details.rows[0]);

  return `
    <details class="payout-breakdown">
      <summary>Payout breakdown</summary>
      <div class="payout-breakdown-grid">
        <span>Your picks</span><strong>${escapeHtml(details.rows.map((row) => row.selections.join(", ")).join(" · "))}</strong>
        <span>Result</span><strong>${escapeHtml(details.result.join(", "))}</strong>
        <span>Correct picks</span><strong>${bestMatch?.matchCount || 0} of 3</strong>
        <span>Match weight</span><strong>${formatRatio(bestMatch?.matchWeight || 0)}x best bet</strong>
        <span>Your stake</span><strong>${money(totalStake)}</strong>
        <span>Weighted stake</span><strong>${money(details.playerWeightedStake)}</strong>
        <span>Total weighted stake</span><strong>${money(details.totalWeightedStake)}</strong>
        <span>Prize pool after tax</span><strong>${money(prizePool)}</strong>
        <span>Your share</span><strong>${formatRatio(share * 100)}%</strong>
        ${event.bonusAwarded ? `<span>Bonus included</span><strong>${money(Number(event.bonusPoints || 0) * share)}</strong>` : ""}
        <span>Final payout</span><strong>${money(payout)}</strong>
      </div>
    </details>
  `;
}

function renderEvents() {
  if (state.events.length === 0) {
    els.eventsList.innerHTML = '<div class="empty">Create your first betting market.</div>';
    return;
  }

  els.eventsList.innerHTML = sortMarketsForDisplay(state.events).map((event, index) => renderEvent(event, index)).join("");
}

function sortMarketsForDisplay(markets) {
  return [...markets].sort((a, b) => {
    const aResolved = a.status === "resolved" || a.status === "voided";
    const bResolved = b.status === "resolved" || b.status === "voided";
    if (aResolved !== bResolved) return aResolved ? 1 : -1;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
}

function getMarketAnimationAttrs(event, index = 0, context = "host") {
  const key = `${context}:${event.remoteId || event.id}`;
  if (animatedMarketCards.has(key)) return "";
  animatedMarketCards.add(key);
  return `data-animate-card style="--card-stagger: ${Math.min(index, 6) * 28}ms"`;
}

function renderEvent(event, index = 0) {
  const pool = getEventPool(event);
  const statusText = event.status.charAt(0).toUpperCase() + event.status.slice(1);
  const canCollapse = event.status === "resolved" || event.status === "voided";
  const isCollapsed = canCollapse && collapsedEvents.has(event.id);
  const marketSummary = renderMarketSummary(event);
  const quickSummary = getMarketSummary(event);
  const oddsMenu = renderMarketOddsMenu(event);
  const outcomePicker = renderOutcomePicker(event);
  const animationAttrs = getMarketAnimationAttrs(event, index, "host");
  const highlightClass = event.id === highlightedEventId ? "success-pulse" : "";

  if (isCollapsed) {
    return `
      <article class="event-card event-card-slim ${highlightClass}" ${animationAttrs}>
        <div class="event-top slim">
          <div>
            <div class="event-meta">
              <h3>${escapeHtml(event.name)}</h3>
              <span class="pill ${event.status}">${statusText}</span>
            </div>
            ${renderCollapsedResult(event)}
          </div>
          <button class="ghost arrow-button" data-toggle-event="${event.id}" aria-label="Expand event">v</button>
        </div>
      </article>
    `;
  }

  return `
    <article class="event-card market-card ${highlightClass}" ${animationAttrs}>
      <button class="danger x-button market-remove" data-remove-event="${event.id}" aria-label="Remove market">x</button>
      <div class="event-top">
        <div>
          <div class="event-meta">
            <h3>${escapeHtml(event.name)}</h3>
            <span class="pill ${event.status}">${statusText}</span>
            ${event.bonusPoints > 0 ? '<span class="pill bonus-pill">✓ Bonus points available</span>' : ""}
          </div>
          <p class="muted">Pool: ${money(pool)} · Tax: ${money(pool * TAX_RATE)} · Payout pool: ${money(pool * (1 - TAX_RATE))}</p>
          <div class="market-quick-info">
            <span><strong>${quickSummary.totalBets}</strong> bet${quickSummary.totalBets === 1 ? "" : "s"} placed</span>
            <span>Favorite: <strong>${escapeHtml(quickSummary.favorite)}</strong></span>
          </div>
          ${renderMarketMovement(quickSummary.movements)}
          ${event.seedPool > 0 ? `<p class="muted">Seeded odds: <strong>${escapeHtml(event.profileMarketType || "Custom")}</strong> · ${money(event.seedPool)} virtual liquidity</p>` : ""}
          ${event.bonusPoints > 0 ? `<p class="muted">Bonus: <strong>${money(event.bonusPoints)}</strong> points · ${escapeHtml(event.bonusLabel || "Host-triggered bonus")}</p>` : ""}
        </div>
        <div class="event-actions">
          ${canCollapse ? `<button class="ghost arrow-button" data-toggle-event="${event.id}" aria-label="Minimize event">^</button>` : ""}
          <button class="ghost" data-refresh-market="${event.id}">Refresh Odds</button>
          ${event.status === "open" ? `<button data-close-event="${event.id}">Close Betting</button>` : ""}
          ${event.status === "locked" ? outcomePicker : ""}
        </div>
      </div>
      <div class="event-body">
        ${marketSummary}
        ${oddsMenu}
        ${event.status === "resolved" ? `<p class="muted">Winning outcome: <strong>${escapeHtml(getComboResultLabel(event))}</strong></p>` : ""}
        ${event.status === "resolved" ? `<button class="danger undo-button" data-undo-payout="${event.id}">Undo Last Payout</button>` : ""}
      </div>
    </article>
  `;
}

function renderMarketSummary(event) {
  const totals = getOutcomeTotals(event);
  const outcomes = getEventOutcomes(event);
  if (outcomes.length === 0) {
    return '<div class="empty">No outcomes available.</div>';
  }

  return `
    <div>
      <h3>Backed Outcomes</h3>
      <div class="market-summary-grid">
        ${outcomes.map((outcome) => `
          <div class="market-summary-row">
            <strong>${escapeHtml(outcome)}</strong>
            <span>${money(totals[outcome] || 0)} backed</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderMarketOddsMenu(event, options = {}) {
  const isExpanded = options.playerDefaultOpen
    ? !collapsedPlayerOddsMenus.has(event.id)
    : expandedOddsMenus.has(event.id);
  return `
    <details class="odds-menu" data-odds-menu="${event.id}" ${options.playerDefaultOpen ? "data-player-default-open" : ""} ${isExpanded ? "open" : ""}>
      <summary>Available outcomes and odds</summary>
      <div class="odds-grid">${renderOdds(event, options)}</div>
    </details>
  `;
}

function renderCollapsedResult(event) {
  if (event.status === "voided") {
    return '<p class="muted">Voided and refunded</p>';
  }

  const payouts = getEventPayouts(event);
  if (payouts.length === 0) {
    return `<p class="muted">No winner · Outcome: <strong>${escapeHtml(getComboResultLabel(event))}</strong></p>`;
  }

  return `
    <div class="collapsed-winners">
      ${payouts.map((payout) => {
        const player = state.players.find((item) => item.id === payout.playerId);
        return `
          <p class="muted">
            <span class="trophy" aria-label="Winner">🏆</span>
            <strong>${escapeHtml(player?.name || "Unknown player")}</strong>
            won <strong>${money(payout.amount)}</strong>
            <span>· Outcome: <strong>${escapeHtml(getComboResultLabel(event))}</strong></span>
          </p>
        `;
      }).join("")}
    </div>
  `;
}

function renderBetRow(event, player) {
  const bets = event.bets.filter((item) => item.playerId === player.id);
  const highlightClass = bets.some((bet) => bet.id === highlightedBetId) ? "success-pulse" : "";
  const detail = bets.length
    ? bets.map((bet) => `${money(bet.value)} on ${escapeHtml(getBetPickText(bet))}`).join(" · ")
    : "No bet yet";
  const canEdit = event.status === "open";

  return `
    <div class="bet-row ${highlightClass}">
      <div>
        <span class="bet-name">${escapeHtml(player.name)}</span>
        <span class="muted">${detail}</span>
      </div>
      <div class="bet-row-actions">
        ${bets.map((bet, index) => `
          <button class="ghost mini-button" ${canEdit ? "" : "disabled"} data-open-bet="${event.id}" data-player-id="${player.id}" data-bet-id="${bet.id}">Edit ${index + 1}</button>
        `).join("")}
        <button ${canEdit && bets.length === 0 ? "" : "disabled"} data-open-bet="${event.id}" data-player-id="${player.id}">Add Bet</button>
      </div>
    </div>
  `;
}

function renderOdds(event, { showTotals = true } = {}) {
  const oddsByOutcome = new Map(getOdds(event).map((item) => [item.outcome, item]));
  const outcomes = getEventOutcomes(event);
  if (outcomes.length === 0) return '<div class="empty">No outcomes available.</div>';

  return outcomes.map((outcome) => {
    const item = oddsByOutcome.get(outcome);
    const profitPerPoint = item && item.total > 0 ? getDisplayProfitPerPoint(event, item) : null;
    const displayOdds = profitPerPoint === null ? "Syncing odds" : formatOdds(profitPerPoint);
    const oddsTone = profitPerPoint !== null && profitPerPoint < 1 ? "bad-odds" : profitPerPoint > 15 ? "good-odds" : "";
    const backed = item ? item.realTotal : 0;
    return `
      <div class="odds-row ${showTotals ? "" : "odds-row-compact"}">
        <div class="odds-main">
          <strong>${escapeHtml(outcome)}</strong>
          <span class="muted">Option</span>
        </div>
        <div class="odds-stat">
          <strong class="odds-value ${oddsTone}">${displayOdds}</strong>
          <span class="muted">Odds</span>
        </div>
        ${showTotals ? `
          <div class="odds-stat">
            <strong>${money(backed)}</strong>
            <span class="muted">Backed</span>
          </div>
        ` : ""}
      </div>
    `;
  }).join("");
}

function renderOutcomePicker(event) {
  const outcomes = getEventOutcomes(event);
  const bonusControl = event.bonusPoints > 0
    ? `
      <label class="checkbox-row bonus-resolve">
        <input data-bonus-awarded="${event.id}" type="checkbox" />
        Include bonus: ${money(event.bonusPoints)} pts · ${escapeHtml(event.bonusLabel || "Host-triggered bonus")}
      </label>
    `
    : "";

  if (isTopThreeComboMarket(event)) {
    const options = outcomes.map((outcome) => `<option value="${escapeAttr(outcome)}">${escapeHtml(outcome)}</option>`).join("");
    return `
      <div class="combo-resolve">
        <p class="muted">Call the ${getComboResultDescription(event)}. Order does not matter.</p>
        ${[1, 2, 3].map((pick) => `
          <select data-combo-outcome-select="${event.id}" aria-label="Combo result ${pick}">
            <option value="">Result ${pick}...</option>
            ${options}
          </select>
        `).join("")}
      </div>
      ${bonusControl}
      <button data-resolve-event="${event.id}">Confirm Payout</button>
      <button class="ghost" data-void-event="${event.id}">Void / Refund</button>
    `;
  }

  return `
    <select data-outcome-select="${event.id}" aria-label="Winning outcome">
      <option value="">Call outcome...</option>
      ${outcomes.map((outcome) => `<option value="${escapeAttr(outcome)}">${escapeHtml(outcome)}</option>`).join("")}
    </select>
    <input data-custom-outcome="${event.id}" type="text" placeholder="Or type unbacked outcome" aria-label="Unbacked outcome" />
    ${bonusControl}
    <button data-resolve-event="${event.id}">Confirm Payout</button>
    <button class="ghost" data-void-event="${event.id}">Void / Refund</button>
  `;
}

function formatRatio(value) {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value - Math.round(value)) < 0.01) return String(Math.round(value));
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function formatOdds(profitPerPoint) {
  if (profitPerPoint > 1) return `${formatRatio(profitPerPoint)}:1`;
  if (profitPerPoint > 0) return `1:${formatRatio(1 / profitPerPoint)}`;
  if (Math.abs(profitPerPoint) < 0.01) return "Even";
  return `${formatRatio(Math.abs(profitPerPoint * 100))}% tax loss`;
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

function getMarketSummary(event) {
  const odds = getOdds(event);
  const totalBets = event.bets.length;
  const favorite = odds
    .filter((item) => item.total > 0)
    .sort((a, b) => getDisplayProfitPerPoint(event, a) - getDisplayProfitPerPoint(event, b))[0];
  const movements = getMarketMovements(event, odds);

  return {
    totalBets,
    favorite: favorite?.outcome || "No favorite yet",
    movements,
  };
}

function getMarketMovements(event, odds = getOdds(event)) {
  const realPool = getEventPool(event);
  if (realPool <= 0) return [];

  const seedPool = getSeedPool(event);
  return odds
    .filter((item) => item.realTotal > 0 || item.seedTotal > 0)
    .map((item) => {
      const seedShare = seedPool > 0 ? item.seedTotal / seedPool : 1 / Math.max(1, odds.length);
      const realShare = item.realTotal / realPool;
      const movement = realShare - seedShare;
      return {
        outcome: item.outcome,
        direction: movement >= 0 ? "up" : "down",
        strength: Math.abs(movement),
      };
    })
    .filter((item) => item.strength > 0.02)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 3);
}

async function addPlayer(name, points) {
  if (!requireHostMode()) return;
  if (supabaseConfigured() && !remoteReady()) {
    await askConfirm({
      title: "Supabase not ready",
      message: "The shared session is still connecting. Tap Refresh and try again.",
      action: "OK",
      notice: true,
    });
    return;
  }

  const player = { id: uid(), name, points, startingPoints: points, status: "approved", adjustments: [] };
  state.players.push(player);
  render();
  const saved = await runRemote(() => saveRemotePlayer(player));
  if (supabaseConfigured() && !saved) {
    state.players = state.players.filter((item) => item.id !== player.id);
    render();
    await askConfirm({
      title: "Player not saved",
      message: "Supabase rejected the player save. Check the red sync message at the top.",
      action: "OK",
      notice: true,
    });
  }
}

async function addEvent(name, outcomeItems = [], bonus = {}, profileMarketType = "Custom") {
  if (!requireHostMode()) return;
  if (supabaseConfigured() && !remoteReady()) {
    await askConfirm({
      title: "Supabase not ready",
      message: "The shared session is still connecting. Tap Refresh and try again.",
      action: "OK",
      notice: true,
    });
    return;
  }

  const newEvent = {
    id: uid(),
    name,
    status: "open",
    marketType: isTopThreeComboMarket({ profileMarketType }) ? "combo" : "single",
    profileMarketType,
    payoutMode: "pool",
    payoutMultiplier: 1,
    taxRate: TAX_RATE,
    bonusPoints: Number(bonus.points || 0),
    bonusLabel: bonus.label || null,
    bets: [],
    seedPool: outcomeItems.reduce((total, outcome) => total + Number(outcome.seedLiquidity || 0), 0),
    outcomes: outcomeItems.map(normalizeOutcome),
    winningOutcome: null,
    createdAt: new Date().toISOString(),
    lockedAt: null,
  };
  state.events.unshift(newEvent);
  activeTab = "events";
  localStorage.setItem("poker-night-bets-active-tab", activeTab);
  render();
  const saved = await runRemote(() => saveRemoteMarket(newEvent));
  if (supabaseConfigured() && !saved) {
    state.events = state.events.filter((item) => item.id !== newEvent.id);
    render();
    await askConfirm({
      title: "Market not saved",
      message: "Supabase rejected the market save. Check the red sync message at the top.",
      action: "OK",
      notice: true,
    });
    return;
  }

  if (newEvent.outcomes.length) {
    await runRemote(async () => {
      for (const outcome of newEvent.outcomes) {
        await ensureRemoteOutcome(newEvent, outcome.label);
      }
      await saveRemoteMarket(newEvent);
    });
  }
}

async function closeEvent(eventId) {
  if (!requireHostMode()) return;
  const event = state.events.find((item) => item.id === eventId);
  if (!event || event.status !== "open") return;

  if (!event.stakesLocked) {
    event.bets.forEach((bet) => {
      const player = state.players.find((item) => item.id === bet.playerId);
      if (player) player.points -= bet.value;
    });
    event.stakesLocked = true;
  }
  event.status = "locked";
  event.lockedAt = event.lockedAt || new Date().toISOString();
  render();
  await runRemote(async () => {
    await Promise.all(event.bets.map((bet) => saveRemoteBet(event, bet)));
    await Promise.all(state.players.map((player) => saveRemotePlayer(player)));
    await saveRemoteMarket(event);
  });
}

async function closeAllBetting() {
  if (!requireHostMode()) return;
  const openMarkets = state.events.filter((event) => event.status === "open");
  if (openMarkets.length === 0) {
    await askConfirm({
      title: "No open markets",
      message: "There are no open markets to close.",
      action: "OK",
      notice: true,
    });
    return;
  }

  const confirmed = await askConfirm({
    title: "Close all betting?",
    message: `Close betting on ${openMarkets.length} open market${openMarkets.length === 1 ? "" : "s"}? Stakes will be locked.`,
    action: "Close all",
    danger: true,
  });
  if (!confirmed) return;

  openMarkets.forEach((market) => {
    if (!market.stakesLocked) {
      market.bets.forEach((bet) => {
        const player = state.players.find((item) => item.id === bet.playerId);
        if (player) player.points -= bet.value;
      });
      market.stakesLocked = true;
    }
    market.status = "locked";
    market.lockedAt = market.lockedAt || new Date().toISOString();
  });

  render();
  await runRemote(async () => {
    await Promise.all(openMarkets.flatMap((market) => market.bets.map((bet) => saveRemoteBet(market, bet))));
    await Promise.all(state.players.map((player) => saveRemotePlayer(player)));
    await Promise.all(openMarkets.map((market) => saveRemoteMarket(market)));
  });
  if (remoteReady()) await loadRemoteState();
}

async function resolveEvent(eventId) {
  if (!requireHostMode()) return;
  const event = state.events.find((item) => item.id === eventId);
  if (isTopThreeComboMarket(event)) {
    await resolveComboEvent(event);
    return;
  }
  const select = document.querySelector(`[data-outcome-select="${eventId}"]`);
  const customOutcome = document.querySelector(`[data-custom-outcome="${eventId}"]`)?.value.trim();
  const bonusAwarded = Boolean(document.querySelector(`[data-bonus-awarded="${eventId}"]`)?.checked);
  const winningOutcome = customOutcome || select?.value;
  if (!event || event.status !== "locked" || !winningOutcome) return;

  const confirmed = await askConfirm({
    title: "Confirm payout",
    message: `Resolve "${event.name}" with "${winningOutcome}" as the outcome? If nobody backed it, there will be no winners and stakes stay lost.${bonusAwarded ? ` Bonus included: ${money(event.bonusPoints)} points.` : ""}`,
    action: "Apply payouts",
  });
  if (!confirmed) return;

  if (!event.stakesLocked) {
    event.bets.forEach((bet) => {
      const player = state.players.find((item) => item.id === bet.playerId);
      if (player) player.points -= bet.value;
    });
    event.stakesLocked = true;
    event.lockedAt = event.lockedAt || new Date().toISOString();
  }

  const winnerTotal = event.bets
    .filter((bet) => bet.outcome === winningOutcome)
    .reduce((total, bet) => total + bet.value, 0);
  event.winningOutcome = winningOutcome;
  event.bonusAwarded = bonusAwarded;
  const payouts = calculateEventPayouts(event, bonusAwarded);

  if (winnerTotal > 0) {
    payouts.forEach((payout) => {
      const player = state.players.find((item) => item.id === payout.playerId);
      if (player) {
        player.points += payout.amount;
      }
    });
  }

  event.status = "resolved";
  event.payouts = payouts;
  event.resolvedAt = new Date().toISOString();
  collapsedEvents.add(event.id);
  saveCollapsedEvents();
  render();
  await runRemote(async () => {
    await Promise.all(state.players.map((player) => saveRemotePlayer(player)));
    await saveRemoteMarket(event);
    await saveRemotePayouts(event);
  });
}

async function resolveComboEvent(event) {
  if (!event || event.status !== "locked") return;
  const bonusAwarded = Boolean(document.querySelector(`[data-bonus-awarded="${event.id}"]`)?.checked);
  const selections = Array.from(document.querySelectorAll(`[data-combo-outcome-select="${event.id}"]`))
    .map((select) => normalizeOutcomeLabel(select.value))
    .filter(Boolean);
  const uniqueSelections = [...new Set(selections.map((item) => item.toLowerCase()))];
  if (selections.length !== 3 || uniqueSelections.length !== 3) {
    await askConfirm({
      title: "Choose three results",
      message: `Pick exactly three different players for the ${getComboResultDescription(event)} before confirming this combo market.`,
      action: "OK",
      notice: true,
    });
    return;
  }

  const resultLabel = selections.join(", ");
  const confirmed = await askConfirm({
    title: "Confirm combo payout",
    message: `Resolve "${event.name}" with ${getComboResultDescription(event)}: ${resultLabel}? Bets are paid by correct picks: 3 = 5x weight, 2 = 2x, 1 = 0.5x, 0 = no payout.${bonusAwarded ? ` Bonus included: ${money(event.bonusPoints)} points.` : ""}`,
    action: "Apply payouts",
  });
  if (!confirmed) return;

  if (!event.stakesLocked) {
    event.bets.forEach((bet) => {
      const player = state.players.find((item) => item.id === bet.playerId);
      if (player) player.points -= bet.value;
    });
    event.stakesLocked = true;
    event.lockedAt = event.lockedAt || new Date().toISOString();
  }

  event.winningSelections = selections;
  event.winningOutcome = resultLabel;
  event.bonusAwarded = bonusAwarded;
  const payouts = calculateComboEventPayouts(event, bonusAwarded);

  payouts.forEach((payout) => {
    const player = state.players.find((item) => item.id === payout.playerId);
    if (player) player.points += payout.amount;
  });

  event.status = "resolved";
  event.payouts = payouts;
  event.resolvedAt = new Date().toISOString();
  collapsedEvents.add(event.id);
  saveCollapsedEvents();
  render();
  await runRemote(async () => {
    await Promise.all(state.players.map((player) => saveRemotePlayer(player)));
    await saveRemoteMarket(event);
    await saveRemotePayouts(event);
  });
}

async function undoPayout(eventId) {
  const event = state.events.find((item) => item.id === eventId);
  if (!event || event.status !== "resolved") return;
  const confirmed = await askConfirm({
    title: "Undo payout?",
    message: `Undo the payout for "${event.name}" and return it to locked betting?`,
    action: "Undo payout",
    danger: true,
  });
  if (!confirmed) return;

  getEventPayouts(event).forEach((payout) => {
    const player = state.players.find((item) => item.id === payout.playerId);
    if (player) player.points -= payout.amount;
  });

  event.status = "locked";
  event.winningOutcome = null;
  event.winningSelections = [];
  event.payouts = [];
  event.resolvedAt = null;
  collapsedEvents.delete(event.id);
  saveCollapsedEvents();
  render();
  await runRemote(async () => {
    await Promise.all(state.players.map((player) => saveRemotePlayer(player)));
    await saveRemoteMarket(event);
    await saveRemotePayouts(event);
  });
}

async function voidEvent(eventId) {
  if (!requireHostMode()) return;
  const event = state.events.find((item) => item.id === eventId);
  if (!event || event.status !== "locked") return;
  const confirmed = await askConfirm({
    title: "Void and refund?",
    message: `Void "${event.name}" and refund every stake?`,
    action: "Void and refund",
    danger: true,
  });
  if (!confirmed) return;

  event.bets.forEach((bet) => {
    const player = state.players.find((item) => item.id === bet.playerId);
    if (player) player.points += bet.value;
  });

  event.status = "voided";
  event.winningOutcome = "Voided / refunded";
  event.voidedAt = new Date().toISOString();
  collapsedEvents.add(event.id);
  saveCollapsedEvents();
  render();
  await runRemote(async () => {
    await Promise.all(state.players.map((player) => saveRemotePlayer(player)));
    await saveRemoteMarket(event);
  });
}

function toggleEvent(eventId) {
  if (collapsedEvents.has(eventId)) {
    collapsedEvents.delete(eventId);
  } else {
    collapsedEvents.add(eventId);
  }
  saveCollapsedEvents();
  renderEvents();
}

function togglePlayer(playerId) {
  if (expandedPlayers.has(playerId)) {
    expandedPlayers.delete(playerId);
  } else {
    expandedPlayers.add(playerId);
  }
  saveExpandedPlayers();
  renderPlayers();
}

async function adjustPlayer(playerId, type) {
  if (!requireHostMode()) return;
  const player = state.players.find((item) => item.id === playerId);
  const input = document.querySelector(`[data-adjust-value="${playerId}"]`);
  const value = Math.floor(Number(input?.value));
  if (!player || value <= 0) return;

  if (type === "bonus") {
    player.points += value;
  } else {
    player.points -= value;
  }

  player.adjustments = Array.isArray(player.adjustments) ? player.adjustments : [];
  const adjustment = { id: uid(), type, value, createdAt: new Date().toISOString() };
  player.adjustments.push(adjustment);
  render();
  await runRemote(async () => {
    await saveRemotePlayer(player);
    await saveRemoteAdjustment(player, adjustment);
  });
}

function openGiveAllPointsDialog() {
  if (!requireHostMode()) return;
  if (state.players.length === 0) {
    askConfirm({
      title: "No players yet",
      message: "Add players before giving points to everyone.",
      action: "OK",
      notice: true,
    });
    return;
  }

  els.giveAllPointsValue.value = "";
  els.giveAllDialog.showModal();
  els.giveAllPointsValue.focus();
}

async function givePointsToAllPlayers(value) {
  if (!requireHostMode()) return;
  const points = Math.floor(Number(value));
  if (!Number.isFinite(points) || points <= 0 || state.players.length === 0) return;

  const createdAt = new Date().toISOString();
  const adjustments = state.players.map((player) => {
    player.points += points;
    player.adjustments = Array.isArray(player.adjustments) ? player.adjustments : [];
    const adjustment = { id: uid(), type: "bonus", value: points, createdAt };
    player.adjustments.push(adjustment);
    return { player, adjustment };
  });

  render();
  await runRemote(async () => {
    await Promise.all(adjustments.map(({ player, adjustment }) => saveRemoteAdjustment(player, adjustment)));
  });
}

function openLegacyBetDialog(eventId, playerId, betId = null) {
  const event = state.events.find((item) => item.id === eventId);
  const player = state.players.find((item) => item.id === playerId);
  if (!event || !player || event.status !== "open") return;
  if (isTopThreeComboMarket(event)) {
    openLegacyComboBetDialog(event, player, betId);
    return;
  }

  const existingBet = betId ? event.bets.find((item) => item.id === betId && item.playerId === playerId) : null;
  if (!existingBet && event.bets.some((item) => item.playerId === playerId)) {
    askConfirm({
      title: "One bet per market",
      message: "This player already has a bet on this market. Edit the existing bet instead.",
      action: "OK",
      notice: true,
    });
    return;
  }
  const excludedBet = existingBet ? { betId: existingBet.id } : null;
  const available = getAvailablePoints(playerId, excludedBet);
  const fragment = els.betDialogTemplate.content.cloneNode(true);
  const dialog = fragment.querySelector("dialog");
  const valueInput = fragment.querySelector("[data-bet-value]");
  const outcomeChoice = fragment.querySelector("[data-outcome-choice]");
  const removeButton = fragment.querySelector("[data-remove-bet]");
  const outcomes = getEventOutcomes(event);
  const blockedOutcomes = new Set(
    event.bets
      .filter((item) => item.playerId === playerId && item.id !== existingBet?.id)
      .map((item) => item.outcome)
  );
  const selectableOutcomes = outcomes.filter((outcome) => !blockedOutcomes.has(outcome));
  const existingOutcomeInList = existingBet && selectableOutcomes.includes(existingBet.outcome);

  if (outcomes.length === 0) {
    askConfirm({
      title: "No outcomes yet",
      message: "Add outcome options when creating the market before taking bets.",
      action: "OK",
      notice: true,
    });
    return;
  }

  if (selectableOutcomes.length === 0) {
    askConfirm({
      title: "No outcomes left",
      message: "This player already has a bet on every available outcome. Edit an existing bet instead.",
      action: "OK",
      notice: true,
    });
    return;
  }

  fragment.querySelector("[data-player-name]").textContent = player.name;
  fragment.querySelector("[data-market-name]").textContent = event.name;
  fragment.querySelector("[data-available]").textContent = `${money(available)} points available for this bet.`;
  valueInput.max = available;
  valueInput.value = existingBet?.value || "";
  removeButton.disabled = !existingBet;
  outcomeChoice.innerHTML = `
    <option value="">Choose outcome...</option>
    ${selectableOutcomes.map((outcome) => `<option value="${escapeAttr(outcome)}">${escapeHtml(outcome)}</option>`).join("")}
  `;

  if (existingOutcomeInList) {
    outcomeChoice.value = existingBet.outcome;
  } else {
    outcomeChoice.value = "";
  }

  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const target = event.target;
    if (!target.matches("input, select")) return;
    event.preventDefault();
    dialog.close("confirm");
  });

  dialog.addEventListener("close", () => {
    if (dialog.returnValue === "confirm") {
      const value = Math.floor(Number(valueInput.value));
      const outcome = outcomeChoice.value;
      if (value > 0 && value <= available && outcome) {
        const nextBet = { ...(existingBet || {}), playerId, value, outcome };
        placeBet(event, nextBet);
      }
    }

    if (dialog.returnValue === "remove") {
      if (existingBet) {
        event.bets = event.bets.filter((item) => item.id !== existingBet.id);
      }
      render();
      runRemote(() => deleteRemoteBet(event, playerId, existingBet?.id || null));
    }

    dialog.remove();
  });

  document.body.appendChild(dialog);
  dialog.showModal();
  outcomeChoice.focus();
}

function openLegacyComboBetDialog(event, player, betId = null) {
  const existingBet = betId ? event.bets.find((item) => item.id === betId && item.playerId === player.id) : null;
  if (!existingBet && event.bets.some((item) => item.playerId === player.id)) {
    askConfirm({
      title: "One combo bet only",
      message: "Top Three Combo markets allow one bet per player. Edit your existing combo bet instead.",
      action: "OK",
      notice: true,
    });
    return;
  }
  const excludedBet = existingBet ? { betId: existingBet.id } : null;
  const available = getAvailablePoints(player.id, excludedBet);
  const fragment = els.betDialogTemplate.content.cloneNode(true);
  const dialog = fragment.querySelector("dialog");
  const valueInput = fragment.querySelector("[data-bet-value]");
  const outcomeChoice = fragment.querySelector("[data-outcome-choice]");
  const outcomeLabel = outcomeChoice.closest("label");
  const removeButton = fragment.querySelector("[data-remove-bet]");
  const outcomes = getEventOutcomes(event);
  const existingSelections = getComboSelections(existingBet);
  const blockedCombos = new Set(
    event.bets
      .filter((item) => item.playerId === player.id && item.id !== existingBet?.id)
      .map((item) => getComboKey(getComboSelections(item)))
      .filter(Boolean)
  );

  if (outcomes.length < 3) {
    askConfirm({
      title: "Not enough outcomes",
      message: "Top Three Combo markets need at least three outcomes before taking bets.",
      action: "OK",
      notice: true,
    });
    return;
  }

  fragment.querySelector("[data-player-name]").textContent = player.name;
  fragment.querySelector("[data-market-name]").textContent = `${event.name} · Pick exactly 3 different names`;
  fragment.querySelector("[data-available]").textContent = `${money(available)} points available for this bet.`;
  valueInput.max = available;
  valueInput.value = existingBet?.value || "";
  removeButton.disabled = !existingBet;
  outcomeLabel.innerHTML = `
    Top Three picks
    <div class="combo-pick-grid">
      ${[0, 1, 2].map((index) => `
        <select data-combo-bet-choice aria-label="Top Three pick ${index + 1}">
          <option value="">Pick ${index + 1}...</option>
          ${outcomes.map((outcome) => `<option value="${escapeAttr(outcome)}">${escapeHtml(outcome)}</option>`).join("")}
        </select>
      `).join("")}
    </div>
    <p class="muted" data-combo-summary>Your three will appear here.</p>
  `;

  const comboChoices = Array.from(fragment.querySelectorAll("[data-combo-bet-choice]"));
  const summary = fragment.querySelector("[data-combo-summary]");
  comboChoices.forEach((select, index) => {
    select.value = existingSelections[index] || "";
  });

  const updateSummary = () => {
    const selections = comboChoices.map((select) => normalizeOutcomeLabel(select.value)).filter(Boolean);
    summary.textContent = selections.length
      ? `Your three: ${selections.join(", ")}`
      : "Your three will appear here.";
  };
  comboChoices.forEach((select) => select.addEventListener("change", updateSummary));
  updateSummary();

  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const target = event.target;
    if (!target.matches("input, select")) return;
    event.preventDefault();
    dialog.close("confirm");
  });

  dialog.addEventListener("close", () => {
    if (dialog.returnValue === "confirm") {
      const value = Math.floor(Number(valueInput.value));
      const selections = comboChoices.map((select) => normalizeOutcomeLabel(select.value)).filter(Boolean);
      const uniqueSelections = [...new Set(selections.map((item) => item.toLowerCase()))];
      const comboKey = getComboKey(selections);
      if (value > 0 && value <= available && selections.length === 3 && uniqueSelections.length === 3 && !blockedCombos.has(comboKey)) {
        const nextBet = { ...(existingBet || {}), playerId: player.id, value, outcome: selections.join(", "), selections };
        placeBet(event, nextBet);
      } else if (blockedCombos.has(comboKey)) {
        askConfirm({
          title: "Already picked",
          message: "This player already has a bet on that exact Top Three combo. Edit the existing bet instead.",
          action: "OK",
          notice: true,
        });
      } else if (selections.length !== 3 || uniqueSelections.length !== 3) {
        askConfirm({
          title: "Choose three players",
          message: "Pick exactly three different names for a Top Three Combo bet.",
          action: "OK",
          notice: true,
        });
      }
    }

    if (dialog.returnValue === "remove") {
      if (existingBet) {
        event.bets = event.bets.filter((item) => item.id !== existingBet.id);
      }
      render();
      runRemote(() => deleteRemoteBet(event, player.id, existingBet?.id || null));
    }

    dialog.remove();
  });

  document.body.appendChild(dialog);
  dialog.showModal();
  comboChoices[0]?.focus();
}

function openBetDialog(eventId, playerId, betId = null) {
  const event = state.events.find((item) => item.id === eventId);
  const player = state.players.find((item) => item.id === playerId);
  if (!event || !player || event.status !== "open") return;

  const existingBet = betId ? event.bets.find((item) => item.id === betId && item.playerId === playerId) : null;
  if (!existingBet && event.bets.some((item) => item.playerId === playerId)) {
    askConfirm({
      title: "One bet per market",
      message: "You already have a bet on this market. Edit it from My Bets instead.",
      action: "OK",
      notice: true,
    });
    return;
  }

  const outcomes = getEventOutcomes(event);
  const isCombo = isTopThreeComboMarket(event);
  const requiredSelections = isCombo ? 3 : 1;
  if (outcomes.length < requiredSelections) {
    askConfirm({
      title: "Not enough outcomes",
      message: isCombo ? "Combo markets need at least three outcomes before taking bets." : "This market has no available outcomes.",
      action: "OK",
      notice: true,
    });
    return;
  }

  const excludedBet = existingBet ? { betId: existingBet.id } : null;
  const available = getAvailablePoints(playerId, excludedBet);
  const initialSelections = isCombo ? getComboSelections(existingBet) : [existingBet?.outcome].filter(Boolean);
  const selected = new Set(initialSelections.map(normalizeOutcomeLabel).filter(Boolean));
  const oddsByOutcome = new Map(getOdds(event).map((item) => [item.outcome, item]));
  const fragment = els.betDialogTemplate.content.cloneNode(true);
  const dialog = fragment.querySelector("dialog");
  const buildView = fragment.querySelector("[data-bet-build-view]");
  const reviewView = fragment.querySelector("[data-bet-review-view]");
  const valueInput = fragment.querySelector("[data-bet-value]");
  const outcomeGrid = fragment.querySelector("[data-bet-outcome-grid]");
  const selectionMessage = fragment.querySelector("[data-selection-message]");
  const selectionCount = fragment.querySelector("[data-selection-count]");
  const removeButton = fragment.querySelector("[data-remove-bet]");
  const reviewButton = fragment.querySelector("[data-review-bet]");
  const backButton = fragment.querySelector("[data-back-to-bet]");
  const confirmButton = fragment.querySelector("[data-confirm-bet]");
  const reviewMarket = fragment.querySelector("[data-review-market]");
  const reviewPicks = fragment.querySelector("[data-review-picks]");
  const reviewValue = fragment.querySelector("[data-review-value]");

  fragment.querySelector("[data-bet-kicker]").textContent = existingBet ? "Edit bet" : "Add bet";
  fragment.querySelector("[data-market-title]").textContent = getMarketDisplayTitle(event);
  fragment.querySelector("[data-market-name]").textContent = event.name === getMarketDisplayTitle(event) ? "" : event.name;
  fragment.querySelector("[data-selection-title]").textContent = isCombo ? "Pick exactly 3 different names" : "Select one outcome";
  fragment.querySelector("[data-selection-help]").textContent = isCombo
    ? "Order does not matter. Tap a selected name again to remove it."
    : "Tap an outcome to select it.";
  fragment.querySelector("[data-available]").textContent = `${money(available)} points available for this bet.`;
  valueInput.max = available;
  valueInput.value = existingBet?.value || "";
  removeButton.hidden = !existingBet;

  outcomeGrid.innerHTML = outcomes.map((outcome) => {
    const oddsItem = oddsByOutcome.get(outcome);
    const profitPerPoint = oddsItem && oddsItem.total > 0 ? getDisplayProfitPerPoint(event, oddsItem) : null;
    const oddsText = profitPerPoint === null ? "Odds syncing" : formatOdds(profitPerPoint);
    return `
      <button type="button" class="bet-outcome-option" data-bet-outcome="${escapeAttr(outcome)}" aria-pressed="false">
        <span class="bet-outcome-check" aria-hidden="true"></span>
        <span class="bet-outcome-copy"><strong>${escapeHtml(outcome)}</strong><small>${escapeHtml(oddsText)}</small></span>
      </button>
    `;
  }).join("");

  const outcomeButtons = Array.from(outcomeGrid.querySelectorAll("[data-bet-outcome]"));
  const updateSelection = () => {
    outcomeButtons.forEach((button) => {
      const active = selected.has(normalizeOutcomeLabel(button.dataset.betOutcome));
      button.classList.toggle("selected", active);
      button.setAttribute("aria-pressed", String(active));
      button.querySelector(".bet-outcome-check").textContent = active ? "✓" : "";
    });
    selectionCount.textContent = isCombo ? `${selected.size}/3 selected` : `${selected.size}/1 selected`;
    selectionMessage.textContent = selected.size
      ? `Selected: ${[...selected].join(", ")}`
      : isCombo ? "Select three names to continue." : "Select one outcome to continue.";
  };

  outcomeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const outcome = normalizeOutcomeLabel(button.dataset.betOutcome);
      if (selected.has(outcome)) {
        selected.delete(outcome);
      } else if (requiredSelections === 1) {
        selected.clear();
        selected.add(outcome);
      } else if (selected.size < requiredSelections) {
        selected.add(outcome);
      } else {
        selectionMessage.textContent = "Three names are already selected. Untick one before choosing another.";
        return;
      }
      updateSelection();
    });
  });

  const validateDraft = () => {
    const value = Math.floor(Number(valueInput.value));
    if (selected.size !== requiredSelections) {
      selectionMessage.textContent = isCombo ? "Choose exactly three different names." : "Choose one outcome.";
      return null;
    }
    if (!Number.isFinite(value) || value <= 0) {
      selectionMessage.textContent = "Enter a bet value greater than zero.";
      valueInput.focus();
      return null;
    }
    if (value > available) {
      selectionMessage.textContent = `You have ${money(available)} points available for this bet.`;
      valueInput.focus();
      return null;
    }
    return { value, selections: [...selected] };
  };

  reviewButton.addEventListener("click", () => {
    const draft = validateDraft();
    if (!draft) return;
    reviewMarket.textContent = `${getMarketDisplayTitle(event)} · ${event.name}`;
    reviewPicks.textContent = draft.selections.join(", ");
    reviewValue.textContent = `${money(draft.value)} points`;
    buildView.hidden = true;
    reviewView.hidden = false;
    document.activeElement?.blur?.();
  });

  backButton.addEventListener("click", () => {
    reviewView.hidden = true;
    buildView.hidden = false;
  });

  confirmButton.addEventListener("click", async () => {
    const draft = validateDraft();
    if (!draft) {
      reviewView.hidden = true;
      buildView.hidden = false;
      return;
    }
    confirmButton.disabled = true;
    confirmButton.textContent = "Confirming...";

    if (appMode === "player" && remoteReady()) {
      try {
        await loadRemoteState();
      } catch (error) {
        console.error("Bet confirmation refresh failed", error);
      }
    }

    const latestEvent = state.events.find((item) => item.id === eventId);
    const latestExistingBet = existingBet
      ? latestEvent?.bets.find((item) => item.id === existingBet.id && item.playerId === playerId)
      : null;
    if (!latestEvent || latestEvent.status !== "open") {
      dialog.close("cancel");
      await askConfirm({
        title: "Market is closed",
        message: "This bet cannot be saved because betting has closed.",
        action: "OK",
        notice: true,
      });
      return;
    }

    const latestAvailable = getAvailablePoints(playerId, latestExistingBet ? { betId: latestExistingBet.id } : null);
    if (draft.value > latestAvailable) {
      confirmButton.disabled = false;
      confirmButton.textContent = "Confirm Bet";
      reviewView.hidden = true;
      buildView.hidden = false;
      selectionMessage.textContent = `Your available points changed. You can now bet up to ${money(latestAvailable)}.`;
      valueInput.max = latestAvailable;
      return;
    }

    const nextBet = {
      ...(latestExistingBet || existingBet || {}),
      playerId,
      value: draft.value,
      outcome: isCombo ? draft.selections.join(", ") : draft.selections[0],
      selections: isCombo ? draft.selections : [],
    };
    dialog.close("confirm");
    await placeBet(latestEvent, nextBet);
  });

  removeButton.addEventListener("click", () => {
    dialog.close("remove");
    if (!existingBet) return;
    event.bets = event.bets.filter((item) => item.id !== existingBet.id);
    render();
    runRemote(() => deleteRemoteBet(event, playerId, existingBet.id));
  });

  valueInput.addEventListener("keydown", (keyEvent) => {
    if (keyEvent.key !== "Enter") return;
    keyEvent.preventDefault();
    reviewButton.click();
  });

  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  document.body.appendChild(dialog);
  updateSelection();
  dialog.showModal();
  outcomeButtons[0]?.focus();
}

async function removePlayer(playerId) {
  if (!requireHostMode()) return;
  const player = state.players.find((item) => item.id === playerId);
  if (!player) return;

  const hasLockedBet = state.events.some((event) =>
    event.status !== "open" && event.bets.some((bet) => bet.playerId === playerId)
  );
  if (hasLockedBet) {
    await askConfirm({
      title: "Cannot remove player",
      message: `${player.name} has locked or resolved bets and cannot be removed.`,
      action: "OK",
      notice: true,
    });
    return;
  }

  const confirmed = await askConfirm({
    title: "Remove player?",
    message: `Remove ${player.name} from the session? Their open bets will also be removed.`,
    action: "Remove player",
    danger: true,
  });
  if (!confirmed) return;

  state.players = state.players.filter((player) => player.id !== playerId);
  state.events.forEach((event) => {
    event.bets = event.bets.filter((bet) => bet.playerId !== playerId);
  });
  render();
  await runRemote(() => deleteRemotePlayer(player));
}

async function removeEvent(eventId) {
  if (!requireHostMode()) return;
  const event = state.events.find((item) => item.id === eventId);
  if (!event) return;
  const confirmed = await askConfirm({
    title: "Remove market?",
    message: `Are you sure you want to remove "${event.name}"? Scores will not be reversed.`,
    action: "Remove market",
    danger: true,
  });
  if (!confirmed) return;

  if (remoteReady()) {
    const removed = await runRemote(() => deleteRemoteEvent(event));
    if (!removed) return;
  }

  state.events = state.events.filter((item) => item.id !== eventId);
  render();
}

els.playerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = els.playerName.value.trim();
  const points = Math.floor(Number(els.startingPoints.value));
  if (!name || points <= 0) return;
  const beforeCount = state.players.length;
  await addPlayer(name, points);
  if (state.players.length === beforeCount) return;
  els.playerName.value = "";
  els.playerName.focus();
});

els.sessionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireHostMode()) return;
  const title = els.sessionTitle.value.trim();
  if (!title) return;
  const defaultPlayerPoints = Math.floor(Number(els.defaultPlayerPoints.value));
  if (defaultPlayerPoints < 0 || !Number.isFinite(defaultPlayerPoints)) return;
  const joiningEnabled = els.joiningEnabled.checked;

  if (remoteReady()) {
    const saved = await runRemote(() => saveRemoteSessionSettings({ title, defaultPlayerPoints, joiningEnabled }));
    if (!saved) return;
  }

  await askConfirm({
    title: "Session saved",
    message: `Players will see "${title}" as the session name. New players start with ${money(defaultPlayerPoints)} points. Joining is ${joiningEnabled ? "open" : "closed"}.`,
    action: "OK",
    notice: true,
  });
});

els.eventForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = els.eventName.value.trim();
  if (!name) return;
  const outcomeItems = getOutcomeFieldItems();
  const requiredOutcomes = isTopThreeComboMarket({ profileMarketType: els.marketType.value }) ? 3 : 2;
  if (outcomeItems.length < requiredOutcomes) {
    await askConfirm({
      title: "Add outcomes",
      message: `Create at least ${requiredOutcomes} outcomes before publishing this market.`,
      action: "OK",
      notice: true,
    });
    return;
  }

  const bonus = els.bonusEnabled.checked
    ? {
      label: els.bonusLabel.value.trim(),
      points: Math.floor(Number(els.bonusPoints.value)) || 0,
    }
    : {};
  const beforeCount = state.events.length;
  await addEvent(name, outcomeItems, bonus, els.marketType.value);
  if (state.events.length === beforeCount) return;
  els.eventName.value = "";
  els.bonusEnabled.checked = false;
  els.bonusFields.hidden = true;
  els.bonusLabel.value = "";
  els.bonusPoints.value = "";
  renderOutcomeFields();
  els.eventName.focus();
});

els.populateDefaultPlayers?.addEventListener("click", () => {
  if (!requireHostMode()) return;
  renderOutcomeFields(buildSeededOutcomes(els.marketType.value));
});

els.marketType?.addEventListener("change", () => {
  if (!requireHostMode()) return;
  const outcomes = getOutcomeFieldItems();
  if (!outcomes.some((outcome) => outcome.profileId)) return;
  renderOutcomeFields(refreshProfileSeededOutcomes(outcomes));
});

els.outcomeFields.addEventListener("keydown", (event) => {
  if (!isHostMode()) return;
  if (event.key !== "Enter") return;
  if (!event.target.matches("[data-outcome-field]")) return;
  event.preventDefault();
  event.target.blur();
});

document.addEventListener("click", (event) => {
  const openBet = event.target.closest("[data-open-bet]");
  const closeButton = event.target.closest("[data-close-event]");
  const resolveButton = event.target.closest("[data-resolve-event]");
  const voidButton = event.target.closest("[data-void-event]");
  const toggleButton = event.target.closest("[data-toggle-event]");
  const undoPayoutButton = event.target.closest("[data-undo-payout]");
  const togglePlayerButton = event.target.closest("[data-toggle-player]");
  const bonusButton = event.target.closest("[data-add-bonus]");
  const penaltyButton = event.target.closest("[data-add-penalty]");
  const removePlayerButton = event.target.closest("[data-remove-player]");
  const removeEventButton = event.target.closest("[data-remove-event]");
  const removeOutcomeButton = event.target.closest("[data-remove-outcome]");
  const removeProfileButton = event.target.closest("[data-remove-profile]");
  const refreshMarketButton = event.target.closest("[data-refresh-market]");
  const playerBetButton = event.target.closest("[data-player-bet]");
  const openPlayerMarketButton = event.target.closest("[data-open-player-market]");
  const closePlayerMarketButton = event.target.closest("[data-close-player-market]");

  if (openBet) openBetDialog(openBet.dataset.openBet, openBet.dataset.playerId, openBet.dataset.betId || null);
  if (closeButton) closeEvent(closeButton.dataset.closeEvent);
  if (resolveButton) resolveEvent(resolveButton.dataset.resolveEvent);
  if (voidButton) voidEvent(voidButton.dataset.voidEvent);
  if (toggleButton) toggleEvent(toggleButton.dataset.toggleEvent);
  if (undoPayoutButton) undoPayout(undoPayoutButton.dataset.undoPayout);
  if (togglePlayerButton) togglePlayer(togglePlayerButton.dataset.togglePlayer);
  if (bonusButton) adjustPlayer(bonusButton.dataset.addBonus, "bonus");
  if (penaltyButton) adjustPlayer(penaltyButton.dataset.addPenalty, "penalty");
  if (removePlayerButton) removePlayer(removePlayerButton.dataset.removePlayer);
  if (removeEventButton) removeEvent(removeEventButton.dataset.removeEvent);
  if (refreshMarketButton) refreshMarketButtonState(refreshMarketButton);
  if (playerBetButton) {
    const player = getCurrentPlayer();
    if (player) openPlayerBetDialog(playerBetButton.dataset.playerBet, player.id, playerBetButton.dataset.betId || null);
  }
  if (openPlayerMarketButton) openPlayerMarketDetail(openPlayerMarketButton.dataset.openPlayerMarket);
  if (closePlayerMarketButton && els.playerMarketDialog?.open) els.playerMarketDialog.close();
  if (removeOutcomeButton) {
    if (!requireHostMode()) return;
    const outcomes = getOutcomeFieldDraftItems();
    outcomes.splice(Number(removeOutcomeButton.dataset.removeOutcome), 1);
    renderOutcomeFields(outcomes.length >= 2 ? outcomes : ["", ""]);
  }
  if (removeProfileButton) removeProfile(removeProfileButton.dataset.removeProfile);
});

els.playerMarketDialog?.addEventListener("click", (event) => {
  if (event.target === els.playerMarketDialog) els.playerMarketDialog.close();
});

document.addEventListener("toggle", (event) => {
  const oddsMenu = event.target.closest?.("[data-odds-menu]");
  if (!oddsMenu) return;
  if (oddsMenu.hasAttribute("data-player-default-open")) {
    if (oddsMenu.open) {
      collapsedPlayerOddsMenus.delete(oddsMenu.dataset.oddsMenu);
    } else {
      collapsedPlayerOddsMenus.add(oddsMenu.dataset.oddsMenu);
    }
    saveCollapsedPlayerOddsMenus();
    return;
  }
  if (oddsMenu.open) {
    expandedOddsMenus.add(oddsMenu.dataset.oddsMenu);
  } else {
    expandedOddsMenus.delete(oddsMenu.dataset.oddsMenu);
  }
  saveExpandedOddsMenus();
}, true);

els.profilesList?.addEventListener("input", (event) => {
  if (!requireHostMode()) return;
  const nameInput = event.target.closest("[data-profile-name]");
  const statInput = event.target.closest("[data-profile-stat]");
  if (nameInput) {
    const profile = state.playerProfiles.find((item) => item.playerId === nameInput.dataset.profileName);
    if (profile) profile.playerName = nameInput.value.trim() || profile.playerName;
    saveState();
  }
  if (statInput) {
    const [playerId, stat] = statInput.dataset.profileStat.split(":");
    const profile = state.playerProfiles.find((item) => item.playerId === playerId);
    if (profile && PROFILE_STATS.includes(stat)) {
      profile[stat] = clampNumber(statInput.value, 0, 100);
      saveState();
    }
  }
});

els.profilesList?.addEventListener("change", (event) => {
  if (!requireHostMode()) return;
  const attendingInput = event.target.closest("[data-profile-attending]");
  if (!attendingInput) return;
  const profile = state.playerProfiles.find((item) => item.playerId === attendingInput.dataset.profileAttending);
  if (!profile) return;
  profile.attending = attendingInput.checked;
  saveState();
  renderProfiles();
});

els.addProfile?.addEventListener("click", () => {
  if (!requireHostMode()) return;
  const baseName = "New Player";
  const profile = normalizeProfile({
    playerId: `${baseName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${uid()}`,
    playerName: baseName,
    attending: true,
    skill: 70,
    survivability: 70,
    volatility: 60,
    consistency: 60,
    recentForm: 60,
    aggression: 60,
  });
  state.playerProfiles.push(profile);
  saveState();
  renderProfiles();
});

async function removeProfile(playerId) {
  if (!requireHostMode()) return;
  const profile = state.playerProfiles.find((item) => item.playerId === playerId);
  if (!profile) return;
  const confirmed = await askConfirm({
    title: "Remove profile?",
    message: `Remove ${profile.playerName} from default profiles?`,
    action: "Remove profile",
    danger: true,
  });
  if (!confirmed) return;
  state.playerProfiles = state.playerProfiles.filter((item) => item.playerId !== playerId);
  saveState();
  renderProfiles();
}

els.resetProfiles?.addEventListener("click", async () => {
  if (!requireHostMode()) return;
  const confirmed = await askConfirm({
    title: "Reset profiles?",
    message: "Reset default player profiles back to the built-in ratings?",
    action: "Reset profiles",
    danger: true,
  });
  if (!confirmed) return;
  state.playerProfiles = cloneDefaultProfiles();
  renderProfiles();
  saveState();
});

async function openPlayerBetDialog(eventId, playerId, betId = null) {
  if (remoteReady()) {
    try {
      await loadRemoteState();
    } catch (error) {
      console.error("Player bet refresh failed", error);
    }
  }

  const event = state.events.find((item) => item.id === eventId);
  if (!event || event.status !== "open") {
    await askConfirm({
      title: "Market is closed",
      message: "You cannot place or edit a bet after betting has closed.",
      action: "OK",
      notice: true,
    });
    return;
  }

  openBetDialog(eventId, playerId, betId);
}

els.playerJoinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = els.playerJoinName.value.trim();
  if (!name) return;
  const submitButton = els.playerJoinForm.querySelector('button[type="submit"]');
  const originalText = submitButton?.textContent || "Join";
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Joining...";
    submitButton.classList.add("is-loading");
  }
  try {
    await joinCurrentSession(name);
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalText;
      submitButton.classList.remove("is-loading");
    }
  }
});

async function refreshMarketButtonState(button) {
  if (!remoteReady()) {
    await askConfirm({
      title: "Supabase not ready",
      message: "Connect to the shared session before refreshing market odds.",
      action: "OK",
      notice: true,
    });
    return;
  }

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "Refreshing...";
  try {
    await loadRemoteState();
    setSyncStatus(`Supabase synced · Session ${remote.session.join_code}`, "online");
  } catch (error) {
    console.error("Market refresh failed", error);
    setSyncStatus(`Refresh error: ${shortError(error)}`, "offline");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function refreshSharedState(options = {}) {
  const quiet = options?.quiet === true;
  if (!remoteReady()) {
    await initSupabaseConnection();
    return;
  }

  try {
    if (!quiet) setSyncStatus("Refreshing...", "");
    await loadRemoteState();
    setSyncStatus(`Supabase synced · Session ${remote.session.join_code}`, "online");
  } catch (error) {
    console.error("Supabase refresh failed", error);
    if (!quiet) setSyncStatus(`Refresh error: ${shortError(error)}`, "offline");
  }
}

function shouldAutoRefreshPlayerMarkets() {
  return appMode === "player"
    && activePlayerTab === "markets"
    && Boolean(getCurrentPlayer())
    && remoteReady()
    && document.visibilityState === "visible";
}

function updatePlayerAutoRefresh() {
  if (!shouldAutoRefreshPlayerMarkets()) {
    if (playerAutoRefreshTimer) {
      clearInterval(playerAutoRefreshTimer);
      playerAutoRefreshTimer = null;
    }
    return;
  }

  if (playerAutoRefreshTimer) return;
  playerAutoRefreshTimer = setInterval(async () => {
    if (!shouldAutoRefreshPlayerMarkets() || playerAutoRefreshInFlight) return;
    playerAutoRefreshInFlight = true;
    try {
      await refreshSharedState({ quiet: true });
    } finally {
      playerAutoRefreshInFlight = false;
    }
  }, PLAYER_MARKETS_REFRESH_MS);
}

els.addOutcome.addEventListener("click", () => {
  if (!requireHostMode()) return;
  const outcomes = getOutcomeFieldDraftItems();
  outcomes.push({ id: uid(), label: "" });
  renderOutcomeFields(outcomes);
});

els.addProfileOutcome?.addEventListener("click", () => {
  if (!requireHostMode()) return;
  const profileId = els.profileOutcomeSelect.value;
  const profile = state.playerProfiles.find((item) => item.playerId === profileId);
  if (!profile) return;

  const outcomes = getOutcomeFieldDraftItems();
  const hasProfile = outcomes.some((outcome) => outcome.profileId === profile.playerId);
  if (!hasProfile) {
    outcomes.push({
      id: uid(),
      label: profile.playerName,
      profileId: profile.playerId,
    });
  }

  renderOutcomeFields(refreshProfileSeededOutcomes(outcomes));
  els.profileOutcomeSelect.value = "";
});

els.bonusEnabled.addEventListener("change", () => {
  if (!isHostMode()) return;
  els.bonusFields.hidden = !els.bonusEnabled.checked;
  if (els.bonusEnabled.checked) {
    els.bonusLabel.focus();
  }
});

els.closeAllBetting.addEventListener("click", closeAllBetting);
els.showPlayerQr?.addEventListener("click", showPlayerQrCode);
els.giveAllPoints?.addEventListener("click", openGiveAllPointsDialog);
els.giveAllDialog?.addEventListener("close", () => {
  if (els.giveAllDialog.returnValue !== "confirm") return;
  givePointsToAllPlayers(els.giveAllPointsValue.value);
});
els.giveAllDialog?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  if (!event.target.matches("input")) return;
  event.preventDefault();
  els.giveAllDialog.close("confirm");
});
els.refreshPlayerMarkets?.addEventListener("click", refreshSharedState);
els.copyPlayerUrl?.addEventListener("click", async () => {
  const playerUrl = getPlayerJoinUrl();
  try {
    await navigator.clipboard.writeText(playerUrl);
    els.copyPlayerUrl.textContent = "Copied";
    setTimeout(() => {
      els.copyPlayerUrl.textContent = "Copy link";
    }, 1200);
  } catch {
    els.playerQrUrl.textContent = playerUrl;
  }
});

els.exportData.addEventListener("click", () => {
  if (!requireHostMode()) return;
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "poker-night-bets.json";
  link.click();
  URL.revokeObjectURL(url);
});

els.importData.addEventListener("change", async () => {
  if (!requireHostMode()) return;
  const file = els.importData.files[0];
  if (!file) return;
  const imported = normalizeState(JSON.parse(await file.text()));
  state.players = imported.players;
  state.events = imported.events;
  state.playerProfiles = imported.playerProfiles;
  render();
  await runRemote(async () => {
    await clearRemoteSession();
    await pushStateToRemote();
  });
  els.importData.value = "";
});

els.resetNight.addEventListener("click", async () => {
  if (!requireHostMode()) return;
  const confirmed = await askConfirm({
    title: "Reset night?",
    message: "Reset all players, events, bets, and scores for this session?",
    action: "Reset everything",
    danger: true,
  });
  if (!confirmed) return;
  await runRemote(() => clearRemoteSession());
  state.players = [];
  state.events = [];
  state.playerProfiles = Array.isArray(state.playerProfiles) ? state.playerProfiles : cloneDefaultProfiles();
  render();
});

els.syncNow.addEventListener("click", refreshSharedState);

document.querySelectorAll("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    activeTab = button.dataset.tab;
    localStorage.setItem("poker-night-bets-active-tab", activeTab);
    if (activeTab === "players") {
      els.startingPoints.value = Number(remote.session?.default_player_points ?? els.defaultPlayerPoints.value ?? 100);
    }
    renderTabs();
  });
});

document.querySelectorAll("[data-player-tab]").forEach((button) => {
  button.addEventListener("click", async () => {
    const nextTab = button.dataset.playerTab;
    const currentIndex = PLAYER_TAB_ORDER.indexOf(activePlayerTab);
    const nextIndex = PLAYER_TAB_ORDER.indexOf(nextTab);
    playerTabDirection = nextIndex >= currentIndex ? "forward" : "back";
    activePlayerTab = nextTab;
    localStorage.setItem("poker-night-bets-player-tab-v2", activePlayerTab);
    renderPlayerTabs();
    if (remoteReady()) await refreshSharedState();
  });
});

document.addEventListener("visibilitychange", () => {
  updatePlayerAutoRefresh();
});

renderOutcomeFields();
render();
initSupabaseConnection();
