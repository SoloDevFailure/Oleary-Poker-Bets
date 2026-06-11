const STORAGE_KEY = "poker-night-bets-v1";
const TAX_RATE = 0.1;

const state = loadState();
const params = new URLSearchParams(window.location.search);
const appMode = params.get("mode") === "player" ? "player" : "host";
const deviceKey = params.get("device") || localStorage.getItem("oleary-player-device-id") || uid();
localStorage.setItem("oleary-player-device-id", deviceKey);
let currentPlayerId = localStorage.getItem(`oleary-player-id-${deviceKey}`) || null;
let activeTab = localStorage.getItem("poker-night-bets-active-tab") || "players";
let activePlayerTab = localStorage.getItem("poker-night-bets-player-tab") || "profile";
const collapsedEvents = new Set(JSON.parse(localStorage.getItem("poker-night-bets-collapsed-events") || "[]"));
const expandedPlayers = new Set(JSON.parse(localStorage.getItem("poker-night-bets-expanded-players") || "[]"));
const remote = {
  client: null,
  session: null,
  enabled: false,
};

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
  outcomeFields: document.querySelector("#outcomeFields"),
  addOutcome: document.querySelector("#addOutcome"),
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
  playerSocialTab: document.querySelector("#playerSocialTab"),
  playerProfilePanel: document.querySelector("#playerProfilePanel"),
  playerMarketsPanel: document.querySelector("#playerMarketsPanel"),
  playerSocialPanel: document.querySelector("#playerSocialPanel"),
  playerProfile: document.querySelector("#playerProfile"),
  playerMarketsList: document.querySelector("#playerMarketsList"),
  playerSocialList: document.querySelector("#playerSocialList"),
  playersTab: document.querySelector("#playersTab"),
  eventsTab: document.querySelector("#eventsTab"),
  sessionTab: document.querySelector("#sessionTab"),
  playersPanel: document.querySelector("#playersPanel"),
  eventsPanel: document.querySelector("#eventsPanel"),
  sessionPanel: document.querySelector("#sessionPanel"),
  closeAllBetting: document.querySelector("#closeAllBetting"),
  syncStatus: document.querySelector("#syncStatus"),
  syncNow: document.querySelector("#syncNow"),
  confirmDialog: document.querySelector("#confirmDialog"),
  confirmKicker: document.querySelector("[data-confirm-kicker]"),
  confirmTitle: document.querySelector("[data-confirm-title]"),
  confirmMessage: document.querySelector("[data-confirm-message]"),
  confirmAction: document.querySelector("[data-confirm-action]"),
  confirmCancel: document.querySelector("[data-confirm-cancel]"),
};

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return { players: [], events: [] };
  }

  try {
    return JSON.parse(saved);
  } catch {
    return { players: [], events: [] };
  }
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

function setSyncStatus(text, mode) {
  els.syncStatus.textContent = text;
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

function shortError(error) {
  return String(error?.message || error || "unknown error").slice(0, 90);
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

function money(value) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function sortPlayers(players = state.players) {
  return [...players].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}

function getReservedByPlayer(playerId, excludedBet) {
  return state.events.reduce((total, event) => {
    if (event.status !== "open") return total;
    return total + event.bets.reduce((betTotal, bet) => {
      if (bet.playerId !== playerId) return betTotal;
      if (excludedBet && excludedBet.eventId === event.id && excludedBet.playerId === playerId) return betTotal;
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

function getOutcomeTotals(event) {
  return event.bets.reduce((totals, bet) => {
    totals[bet.outcome] = (totals[bet.outcome] || 0) + bet.value;
    return totals;
  }, {});
}

function getEventOutcomes(event) {
  const betOutcomes = Object.keys(getOutcomeTotals(event));
  const officialOutcomes = (event.outcomes || []).map((outcome) => outcome.label);
  return [...new Set([...officialOutcomes, ...betOutcomes])].sort((a, b) => a.localeCompare(b));
}

function getOdds(event) {
  const pool = getEventPool(event);
  const taxedPool = pool * (1 - TAX_RATE);
  const outcomeTotals = getOutcomeTotals(event);

  return Object.entries(outcomeTotals)
    .map(([outcome, total]) => {
      const returnPerPoint = total > 0 ? taxedPool / total : 0;
      const profitPerPoint = returnPerPoint - 1;
      return { outcome, total, returnPerPoint, profitPerPoint };
    })
    .sort((a, b) => a.outcome.localeCompare(b.outcome));
}

function getEventPayouts(event) {
  if (Array.isArray(event.payouts) && event.payouts.length > 0) {
    return event.payouts;
  }

  if (event.status !== "resolved" || !event.winningOutcome) {
    return [];
  }

  const pool = getEventPool(event);
  const taxedPool = pool * (1 - TAX_RATE);
  const winnerTotal = event.bets
    .filter((bet) => bet.outcome === event.winningOutcome)
    .reduce((total, bet) => total + bet.value, 0);

  if (winnerTotal <= 0) return [];

  return event.bets
    .filter((bet) => bet.outcome === event.winningOutcome)
    .map((bet) => ({
      playerId: bet.playerId,
      amount: (bet.value / winnerTotal) * taxedPool,
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
      bonusAwarded: Boolean(market.winning_selection?.bonus_awarded),
      winningOutcome,
      createdAt: market.created_at,
      resolvedAt: market.resolved_at,
      bets: (betsByMarket.get(market.id) || []).map((bet) => {
        const outcome = outcomesById.get(bet.outcome_id);
        return {
          id: bet.client_id || bet.id,
          remoteId: bet.id,
          playerId: playerIdByRemoteId.get(bet.player_id),
          value: Number(bet.stake),
          outcome: outcome?.label || "Unknown outcome",
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
      outcomes: eventOutcomes.map((outcome) => ({
        id: outcome.client_id || outcome.id,
        remoteId: outcome.id,
        label: outcome.label,
      })),
    };
  });

  if (appMode === "player") {
    const devicePlayer = state.players.find((player) => player.deviceId === deviceKey);
    if (devicePlayer) {
      currentPlayerId = devicePlayer.id;
      localStorage.setItem(`oleary-player-id-${deviceKey}`, currentPlayerId);
    }
  }

  render();
}

function groupBy(items, key) {
  return items.reduce((map, item) => {
    const groupKey = item[key];
    if (!map.has(groupKey)) map.set(groupKey, []);
    map.get(groupKey).push(item);
    return map;
  }, new Map());
}

async function saveRemoteMarket(event) {
  if (!remoteReady()) return;

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
    winning_selection: event.bonusAwarded ? { bonus_awarded: true } : event.status === "resolved" ? { bonus_awarded: false } : null,
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
      if (event.winningOutcome && event.status === "resolved") {
        const outcome = await ensureRemoteOutcome(event, event.winningOutcome);
        const { error: winningError } = await remote.client
          .from("markets")
          .update({ winning_outcome_id: outcome.id, winning_selection: payload.winning_selection })
          .eq("id", event.remoteId);
        if (winningError) throw winningError;
      }
      return;
    }
    event.remoteId = null;
    payload.winning_outcome_id = null;
    payload.winning_selection = null;
    event.outcomes = (event.outcomes || []).map((outcome) => ({ ...outcome, remoteId: null }));
  }

  const { data, error } = await remote.client
    .from("markets")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  event.remoteId = data.id;
  if (event.winningOutcome && event.status === "resolved") {
    const outcome = await ensureRemoteOutcome(event, event.winningOutcome);
    const { error: winningError } = await remote.client
      .from("markets")
      .update({ winning_outcome_id: outcome.id, winning_selection: payload.winning_selection })
      .eq("id", event.remoteId);
    if (winningError) throw winningError;
  }
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

  await saveRemotePlayer(player);
  await saveRemoteMarket(event);
  const outcome = await ensureRemoteOutcome(event, bet.outcome);

  const payload = {
    market_id: event.remoteId,
    player_id: player.remoteId,
    outcome_id: outcome.id,
    client_id: `${event.id}:${player.id}`,
    stake: Number(bet.value),
    selections: [outcome.id],
    is_active: true,
  };

  const { data: existing, error: findError } = await remote.client
    .from("bets")
    .select("*")
    .eq("market_id", event.remoteId)
    .eq("player_id", player.remoteId)
    .eq("is_active", true)
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

async function deleteRemoteBet(event, playerId) {
  if (!remoteReady() || !event.remoteId) return;
  const player = state.players.find((item) => item.id === playerId);
  if (!player?.remoteId) return;

  const { error } = await remote.client
    .from("bets")
    .delete()
    .eq("market_id", event.remoteId)
    .eq("player_id", player.remoteId);

  if (error) throw error;
}

async function saveRemotePayouts(event) {
  if (!remoteReady() || !event.remoteId) return;

  await remote.client.from("payouts").delete().eq("market_id", event.remoteId);
  const rows = (event.payouts || []).map((payout) => {
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

function parseOutcomeLabels(value) {
  return [...new Set(String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean))];
}

function renderOutcomeFields(labels = ["", ""]) {
  els.outcomeFields.innerHTML = labels.map((label, index) => `
    <div class="outcome-field">
      <input data-outcome-field type="text" placeholder="Outcome ${index + 1}" autocomplete="off" />
      <button class="danger x-button" type="button" data-remove-outcome="${index}" aria-label="Remove outcome" ${labels.length <= 2 ? "disabled" : ""}>x</button>
    </div>
  `).join("");
  document.querySelectorAll("[data-outcome-field]").forEach((input, index) => {
    input.value = labels[index] || "";
  });
}

function getOutcomeFieldLabels() {
  return [...new Set(Array.from(document.querySelectorAll("[data-outcome-field]"))
    .map((input) => normalizeOutcomeLabel(input.value))
    .filter(Boolean))];
}

function normalizeOutcomeLabel(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
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

function render() {
  saveState();
  renderMode();
  renderTabs();
  renderPlayers();
  renderEvents();
  renderPlayerMode();
}

function renderMode() {
  const isPlayer = appMode === "player";
  document.body.classList.toggle("player-mode", isPlayer);
  document.querySelector("nav.tabs:not(#playerTabs)").hidden = isPlayer;
  els.playerTabs.hidden = !isPlayer || !getCurrentPlayer();
  els.sessionPanel.hidden = isPlayer;
  els.playersPanel.hidden = isPlayer;
  els.eventsPanel.hidden = isPlayer;
  els.playerJoinPanel.hidden = !isPlayer || Boolean(getCurrentPlayer());
  els.playerProfilePanel.hidden = !isPlayer || !getCurrentPlayer();
  els.playerMarketsPanel.hidden = !isPlayer || !getCurrentPlayer();
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
  const showEvents = activeTab === "events";
  els.sessionTab.classList.toggle("active", showSession);
  els.playersTab.classList.toggle("active", showPlayers);
  els.eventsTab.classList.toggle("active", showEvents);
  els.sessionPanel.classList.toggle("active", showSession);
  els.playersPanel.classList.toggle("active", showPlayers);
  els.eventsPanel.classList.toggle("active", showEvents);
}

function renderPlayerTabs() {
  const showProfile = activePlayerTab === "profile";
  const showMarkets = activePlayerTab === "markets";
  const showSocial = activePlayerTab === "social";
  els.playerProfileTab.classList.toggle("active", showProfile);
  els.playerMarketsTab.classList.toggle("active", showMarkets);
  els.playerSocialTab.classList.toggle("active", showSocial);
  els.playerProfilePanel.classList.toggle("active", showProfile);
  els.playerMarketsPanel.classList.toggle("active", showMarkets);
  els.playerSocialPanel.classList.toggle("active", showSocial);
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

  els.playerMarketsList.innerHTML = markets.map((event) => renderPlayerMarket(event, player)).join("");
}

function renderPlayerMarket(event, player) {
  const pool = getEventPool(event);
  const bet = event.bets.find((item) => item.playerId === player.id);
  const canBet = event.status === "open";

  return `
    <article class="event-card">
      <div class="event-top">
        <div>
          <div class="event-meta">
            <h3>${escapeHtml(event.name)}</h3>
            <span class="pill ${event.status}">${event.status}</span>
            ${event.bonusPoints > 0 ? '<span class="pill bonus-pill">✓ Bonus available</span>' : ""}
          </div>
          <p class="muted">Pool: ${money(pool)} · Payout pool: ${money(pool * (1 - TAX_RATE))}</p>
          ${bet ? `<p class="muted">Your bet: <strong>${money(bet.value)}</strong> on <strong>${escapeHtml(bet.outcome)}</strong></p>` : '<p class="muted">You have not bet on this market.</p>'}
        </div>
        <div class="event-actions">
          <button class="ghost" data-refresh-market="${event.id}">Refresh Odds</button>
          <button ${canBet ? "" : "disabled"} data-player-bet="${event.id}">${bet ? "Edit Bet" : "Place Bet"}</button>
        </div>
      </div>
      <div class="event-body">
        ${event.bonusPoints > 0 ? `<p class="muted">Bonus: <strong>${money(event.bonusPoints)}</strong> · ${escapeHtml(event.bonusLabel || "Host-triggered bonus")}</p>` : ""}
        ${renderMarketOddsMenu(event)}
      </div>
    </article>
  `;
}

function renderPlayerSocial(player) {
  const rows = state.players
    .map((item) => ({ player: item, activity: getLatestPlayerActivity(item) }))
    .sort((a, b) => new Date(b.activity.at || 0) - new Date(a.activity.at || 0) || b.player.points - a.player.points || a.player.name.localeCompare(b.player.name));

  els.playerSocialList.innerHTML = `
    <div class="social-feed">
      ${rows.map(({ player: item, activity }) => {
        const reserved = getReservedByPlayer(item.id);
        return `
          <div class="social-row">
            <div>
              <div class="social-name-line">
                <strong>${escapeHtml(item.name)}${item.id === player.id ? " (you)" : ""}</strong>
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
  `;
}

function getLatestPlayerActivity(player) {
  const activities = [];

  state.events.forEach((event) => {
    const bet = event.bets.find((item) => item.playerId === player.id);
    if (bet) {
      activities.push({
        type: "bet",
        at: bet.updatedAt || bet.createdAt || event.createdAt,
        text: `Bet ${money(bet.value)} on ${bet.outcome} in ${event.name}`,
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
    const bet = event.bets.find((item) => item.playerId === playerId);
    if (!bet) return;

    const payout = getEventPayouts(event)
      .filter((item) => item.playerId === playerId)
      .reduce((total, item) => total + item.amount, 0);
    const stakeCounts = event.status === "locked" || event.status === "resolved";
    const net = event.status === "resolved" ? payout - bet.value : 0;

    if (stakeCounts) staked += bet.value;
    if (event.status === "resolved") paid += payout;

    rows.push(`
      <div class="activity-row">
        <div>
          <strong>${escapeHtml(event.name)}</strong>
          <span class="muted">${money(bet.value)} on ${escapeHtml(bet.outcome)}</span>
        </div>
        <span class="pill ${event.status}">${event.status === "resolved" ? `${net >= 0 ? "+" : ""}${money(net)}` : event.status}</span>
      </div>
    `);
  });

  return { rows, staked, paid, net: paid - staked };
}

function renderEvents() {
  if (state.events.length === 0) {
    els.eventsList.innerHTML = '<div class="empty">Create your first betting market.</div>';
    return;
  }

  els.eventsList.innerHTML = state.events.map((event) => renderEvent(event)).join("");
}

function renderEvent(event) {
  const pool = getEventPool(event);
  const statusText = event.status.charAt(0).toUpperCase() + event.status.slice(1);
  const canCollapse = event.status === "resolved" || event.status === "voided";
  const isCollapsed = canCollapse && collapsedEvents.has(event.id);
  const marketSummary = renderMarketSummary(event);
  const oddsMenu = renderMarketOddsMenu(event);
  const outcomePicker = renderOutcomePicker(event);

  if (isCollapsed) {
    return `
      <article class="event-card event-card-slim">
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
    <article class="event-card market-card">
      <button class="danger x-button market-remove" data-remove-event="${event.id}" aria-label="Remove market">x</button>
      <div class="event-top">
        <div>
          <div class="event-meta">
            <h3>${escapeHtml(event.name)}</h3>
            <span class="pill ${event.status}">${statusText}</span>
            ${event.bonusPoints > 0 ? '<span class="pill bonus-pill">✓ Bonus points available</span>' : ""}
          </div>
          <p class="muted">Pool: ${money(pool)} · Tax: ${money(pool * TAX_RATE)} · Payout pool: ${money(pool * (1 - TAX_RATE))}</p>
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
        ${event.status === "resolved" ? `<p class="muted">Winning outcome: <strong>${escapeHtml(event.winningOutcome)}</strong></p>` : ""}
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

function renderMarketOddsMenu(event) {
  return `
    <details class="odds-menu" open>
      <summary>Available outcomes and odds</summary>
      <div class="odds-grid">${renderOdds(event)}</div>
    </details>
  `;
}

function renderCollapsedResult(event) {
  if (event.status === "voided") {
    return '<p class="muted">Voided and refunded</p>';
  }

  const payouts = getEventPayouts(event);
  if (payouts.length === 0) {
    return `<p class="muted">No winner · Outcome: <strong>${escapeHtml(event.winningOutcome || "Not set")}</strong></p>`;
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
            <span>· Outcome: <strong>${escapeHtml(event.winningOutcome || "Not set")}</strong></span>
          </p>
        `;
      }).join("")}
    </div>
  `;
}

function renderBetRow(event, player) {
  const bet = event.bets.find((item) => item.playerId === player.id);
  const detail = bet ? `${money(bet.value)} on ${escapeHtml(bet.outcome)}` : "No bet yet";
  const canEdit = event.status === "open";

  return `
    <div class="bet-row">
      <div>
        <span class="bet-name">${escapeHtml(player.name)}</span>
        <span class="muted">${detail}</span>
      </div>
      <button ${canEdit ? "" : "disabled"} data-open-bet="${event.id}" data-player-id="${player.id}">
        ${bet ? "Edit" : "Place Bet"}
      </button>
    </div>
  `;
}

function renderOdds(event) {
  const oddsByOutcome = new Map(getOdds(event).map((item) => [item.outcome, item]));
  const outcomes = getEventOutcomes(event);
  if (outcomes.length === 0) return '<div class="empty">No outcomes available.</div>';

  return outcomes.map((outcome) => {
    const item = oddsByOutcome.get(outcome);
    const displayOdds = item ? formatOdds(item.profitPerPoint) : "No bets yet";
    const backed = item ? item.total : 0;
    return `
      <div class="odds-row">
        <div class="odds-main">
          <strong>${escapeHtml(outcome)}</strong>
          <span class="muted">Option</span>
        </div>
        <div class="odds-stat">
          <strong>${displayOdds}</strong>
          <span class="muted">Odds</span>
        </div>
        <div class="odds-stat">
          <strong>${money(backed)}</strong>
          <span class="muted">Backed</span>
        </div>
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

async function addPlayer(name, points) {
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

async function addEvent(name, outcomeLabels = [], bonus = {}) {
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
    marketType: "single",
    payoutMode: "pool",
    payoutMultiplier: 1,
    taxRate: TAX_RATE,
    bonusPoints: Number(bonus.points || 0),
    bonusLabel: bonus.label || null,
    bets: [],
    outcomes: outcomeLabels.map((label) => ({ id: uid(), label })),
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
    });
  }
}

async function closeEvent(eventId) {
  const event = state.events.find((item) => item.id === eventId);
  if (!event || event.status !== "open") return;

  event.bets.forEach((bet) => {
    const player = state.players.find((item) => item.id === bet.playerId);
    if (player) player.points -= bet.value;
  });
  event.status = "locked";
  event.lockedAt = new Date().toISOString();
  render();
  await runRemote(async () => {
    await Promise.all(event.bets.map((bet) => saveRemoteBet(event, bet)));
    await Promise.all(state.players.map((player) => saveRemotePlayer(player)));
    await saveRemoteMarket(event);
  });
}

async function closeAllBetting() {
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
    market.bets.forEach((bet) => {
      const player = state.players.find((item) => item.id === bet.playerId);
      if (player) player.points -= bet.value;
    });
    market.status = "locked";
    market.lockedAt = new Date().toISOString();
  });

  render();
  await runRemote(async () => {
    await Promise.all(openMarkets.flatMap((market) => market.bets.map((bet) => saveRemoteBet(market, bet))));
    await Promise.all(state.players.map((player) => saveRemotePlayer(player)));
    await Promise.all(openMarkets.map((market) => saveRemoteMarket(market)));
  });
}

async function resolveEvent(eventId) {
  const event = state.events.find((item) => item.id === eventId);
  const select = document.querySelector(`[data-outcome-select="${eventId}"]`);
  const customOutcome = document.querySelector(`[data-custom-outcome="${eventId}"]`)?.value.trim();
  const bonusAwarded = Boolean(document.querySelector(`[data-bonus-awarded="${eventId}"]`)?.checked);
  const winningOutcome = customOutcome || select?.value;
  if (!event || event.status !== "locked" || !winningOutcome) return;

  const confirmed = await askConfirm({
    title: "Confirm payout",
    message: `Apply payouts for "${event.name}" with "${winningOutcome}" as the outcome?${bonusAwarded ? ` Bonus included: ${money(event.bonusPoints)} points.` : ""}`,
    action: "Apply payouts",
  });
  if (!confirmed) return;

  const pool = getEventPool(event);
  const taxedPool = pool * (1 - TAX_RATE);
  const winnerTotal = event.bets
    .filter((bet) => bet.outcome === winningOutcome)
    .reduce((total, bet) => total + bet.value, 0);
  const payouts = [];

  event.bets.forEach((bet) => {
    if (bet.outcome !== winningOutcome || winnerTotal <= 0) return;
    const player = state.players.find((item) => item.id === bet.playerId);
    const bonusAmount = bonusAwarded ? Number(event.bonusPoints || 0) * (bet.value / winnerTotal) : 0;
    const amount = (bet.value / winnerTotal) * taxedPool + bonusAmount;
    if (player) {
      player.points += amount;
      payouts.push({ playerId: player.id, amount });
    }
  });

  event.status = "resolved";
  event.winningOutcome = winningOutcome;
  event.payouts = payouts;
  event.bonusAwarded = bonusAwarded;
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

function openBetDialog(eventId, playerId) {
  const event = state.events.find((item) => item.id === eventId);
  const player = state.players.find((item) => item.id === playerId);
  if (!event || !player || event.status !== "open") return;

  const existingBet = event.bets.find((item) => item.playerId === playerId);
  const excludedBet = { eventId, playerId };
  const available = getAvailablePoints(playerId, excludedBet) + (existingBet?.value || 0);
  const fragment = els.betDialogTemplate.content.cloneNode(true);
  const dialog = fragment.querySelector("dialog");
  const valueInput = fragment.querySelector("[data-bet-value]");
  const outcomeChoice = fragment.querySelector("[data-outcome-choice]");
  const removeButton = fragment.querySelector("[data-remove-bet]");
  const outcomes = getEventOutcomes(event);
  const existingOutcomeInList = existingBet && outcomes.includes(existingBet.outcome);

  if (outcomes.length === 0) {
    askConfirm({
      title: "No outcomes yet",
      message: "Add outcome options when creating the market before taking bets.",
      action: "OK",
      notice: true,
    });
    return;
  }

  fragment.querySelector("[data-player-name]").textContent = player.name;
  fragment.querySelector("[data-available]").textContent = `${money(available)} points available for this bet.`;
  valueInput.max = available;
  valueInput.value = existingBet?.value || "";
  removeButton.disabled = !existingBet;
  outcomeChoice.innerHTML = `
    <option value="">Choose outcome...</option>
    ${outcomes.map((outcome) => `<option value="${escapeAttr(outcome)}">${escapeHtml(outcome)}</option>`).join("")}
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
        const nextBet = { playerId, value, outcome };
        event.bets = event.bets.filter((item) => item.playerId !== playerId);
        event.bets.push(nextBet);
        render();
        runRemote(() => saveRemoteBet(event, nextBet));
      }
    }

    if (dialog.returnValue === "remove") {
      event.bets = event.bets.filter((item) => item.playerId !== playerId);
      render();
      runRemote(() => deleteRemoteBet(event, playerId));
    }

    dialog.remove();
  });

  document.body.appendChild(dialog);
  dialog.showModal();
  outcomeChoice.focus();
}

async function removePlayer(playerId) {
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
  const outcomeLabels = getOutcomeFieldLabels();
  if (outcomeLabels.length < 2) {
    await askConfirm({
      title: "Add outcomes",
      message: "Create at least two outcomes before publishing a market.",
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
  await addEvent(name, outcomeLabels, bonus);
  if (state.events.length === beforeCount) return;
  els.eventName.value = "";
  els.bonusEnabled.checked = false;
  els.bonusFields.hidden = true;
  els.bonusLabel.value = "";
  els.bonusPoints.value = "";
  renderOutcomeFields();
  els.eventName.focus();
});

els.outcomeFields.addEventListener("keydown", (event) => {
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
  const refreshMarketButton = event.target.closest("[data-refresh-market]");
  const playerBetButton = event.target.closest("[data-player-bet]");

  if (openBet) openBetDialog(openBet.dataset.openBet, openBet.dataset.playerId);
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
    if (player) openBetDialog(playerBetButton.dataset.playerBet, player.id);
  }
  if (removeOutcomeButton) {
    const labels = Array.from(document.querySelectorAll("[data-outcome-field]")).map((input) => input.value);
    labels.splice(Number(removeOutcomeButton.dataset.removeOutcome), 1);
    renderOutcomeFields(labels);
  }
});

els.playerJoinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = els.playerJoinName.value.trim();
  if (!name) return;
  await joinCurrentSession(name);
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

els.addOutcome.addEventListener("click", () => {
  const labels = Array.from(document.querySelectorAll("[data-outcome-field]")).map((input) => input.value);
  labels.push("");
  renderOutcomeFields(labels);
});

els.bonusEnabled.addEventListener("change", () => {
  els.bonusFields.hidden = !els.bonusEnabled.checked;
  if (els.bonusEnabled.checked) {
    els.bonusLabel.focus();
  }
});

els.closeAllBetting.addEventListener("click", closeAllBetting);

els.exportData.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "poker-night-bets.json";
  link.click();
  URL.revokeObjectURL(url);
});

els.importData.addEventListener("change", async () => {
  const file = els.importData.files[0];
  if (!file) return;
  const imported = JSON.parse(await file.text());
  state.players = Array.isArray(imported.players) ? imported.players : [];
  state.events = Array.isArray(imported.events) ? imported.events : [];
  render();
  await runRemote(async () => {
    await clearRemoteSession();
    await pushStateToRemote();
  });
  els.importData.value = "";
});

els.resetNight.addEventListener("click", async () => {
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
  render();
});

els.syncNow.addEventListener("click", async () => {
  if (!remoteReady()) {
    await initSupabaseConnection();
    return;
  }

  try {
    setSyncStatus("Refreshing...", "");
    await loadRemoteState();
    setSyncStatus(`Supabase synced · Session ${remote.session.join_code}`, "online");
  } catch (error) {
    console.error("Supabase refresh failed", error);
    setSyncStatus("Supabase refresh error", "offline");
  }
});

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
  button.addEventListener("click", () => {
    activePlayerTab = button.dataset.playerTab;
    localStorage.setItem("poker-night-bets-player-tab", activePlayerTab);
    renderPlayerTabs();
  });
});

renderOutcomeFields();
render();
initSupabaseConnection();
