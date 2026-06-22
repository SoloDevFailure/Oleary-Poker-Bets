function runPayoutTests() {
  const results = [];

  function test(name, assertion) {
    try {
      assertion();
      results.push({ name, passed: true });
    } catch (error) {
      results.push({ name, passed: false, message: error.message });
    }
  }

  function assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message || "Values differ"}: expected ${expected}, received ${actual}`);
    }
  }

  function assertClose(actual, expected, message) {
    if (Math.abs(Number(actual) - Number(expected)) > 0.000001) {
      throw new Error(`${message || "Values differ"}: expected ${expected}, received ${actual}`);
    }
  }

  function payoutFor(payouts, playerId) {
    return payouts.find((payout) => payout.playerId === playerId);
  }

  function normalEvent(overrides = {}) {
    return {
      status: "resolved",
      profileMarketType: "Winner",
      winningOutcome: "Dan",
      bonusPoints: 0,
      bonusAwarded: false,
      bets: [],
      outcomes: [],
      ...overrides,
    };
  }

  function comboEvent() {
    return {
      status: "resolved",
      profileMarketType: "TopThreeCombo",
      winningSelections: ["Dan", "Dave", "Chris"],
      winningOutcome: "Dan, Dave, Chris",
      bonusPoints: 0,
      bonusAwarded: false,
      outcomes: [],
      bets: [
        { playerId: "three", value: 100, selections: ["Dan", "Dave", "Chris"] },
        { playerId: "two", value: 100, selections: ["Dan", "Dave", "Jamie"] },
        { playerId: "one", value: 100, selections: ["Dan", "Jamie", "Nic"] },
        { playerId: "zero", value: 100, selections: ["Jamie", "Nic", "Aaron"] },
      ],
    };
  }

  function fixedEvent(overrides = {}) {
    return {
      status: "resolved",
      profileMarketType: "Winner",
      payoutMode: "fixed_odds",
      winningOutcome: "Dan",
      bonusPoints: 0,
      bonusAwarded: false,
      bets: [],
      outcomes: [],
      currentOdds: {},
      ...overrides,
    };
  }

  test("Normal winner payout applies 10% tax", () => {
    const event = normalEvent({
      bets: [
        { playerId: "winner", value: 100, outcome: "Dan" },
        { playerId: "loser", value: 100, outcome: "Dave" },
      ],
    });
    const payouts = calculateEventPayouts(event);
    assertEqual(payouts.length, 1, "Payout count");
    assertClose(payoutFor(payouts, "winner").amount, 180, "Winner payout");
  });

  test("No winning bets returns no payouts", () => {
    const event = normalEvent({
      winningOutcome: "Chris",
      bets: [{ playerId: "player", value: 100, outcome: "Dan" }],
    });
    assertEqual(calculateEventPayouts(event).length, 0, "Payout count");
  });

  test("Bonus points are shared proportionally", () => {
    const event = normalEvent({
      bonusPoints: 200,
      bets: [
        { playerId: "small", value: 100, outcome: "Dan" },
        { playerId: "large", value: 300, outcome: "Dan" },
        { playerId: "loser", value: 600, outcome: "Dave" },
      ],
    });
    const payouts = calculateEventPayouts(event, true);
    assertClose(payoutFor(payouts, "small").amount, 275, "Smaller winner payout");
    assertClose(payoutFor(payouts, "large").amount, 825, "Larger winner payout");
  });

  const comboPayouts = calculateComboEventPayouts(comboEvent());

  test("Combo 3 matches uses weight 5", () => {
    assertEqual(getComboMatchWeight(3), 5, "Match weight");
    assertClose(payoutFor(comboPayouts, "three").amount, 240, "Three-match payout");
  });

  test("Combo 2 matches uses weight 2", () => {
    assertEqual(getComboMatchWeight(2), 2, "Match weight");
    assertClose(payoutFor(comboPayouts, "two").amount, 96, "Two-match payout");
  });

  test("Combo 1 match uses weight 0.5", () => {
    assertEqual(getComboMatchWeight(1), 0.5, "Match weight");
    assertClose(payoutFor(comboPayouts, "one").amount, 24, "One-match payout");
  });

  test("Combo 0 matches gets no payout", () => {
    assertEqual(getComboMatchWeight(0), 0, "Match weight");
    assertEqual(Boolean(payoutFor(comboPayouts, "zero")), false, "Zero-match payout exists");
  });

  test("Stored payout compatibility restores a missing bonus", () => {
    const event = normalEvent({
      bonusPoints: 20,
      bonusAwarded: true,
      bets: [
        { playerId: "winner", value: 100, outcome: "Dan" },
        { playerId: "loser", value: 100, outcome: "Dave" },
      ],
    });
    const normalized = normalizeStoredPayouts(event, [{ playerId: "winner", amount: 180 }]);
    assertClose(normalized[0].amount, 200, "Compatible payout amount");
    assertClose(normalized[0].noticeAmount, 180, "Original notice amount");
  });

  test("Fixed-odds Winner bet pays stake times locked odds", () => {
    const event = fixedEvent({
      bets: [{ playerId: "winner", value: 100, outcome: "Dan", lockedOdds: 2.4, potentialPayout: 240 }],
    });
    const payouts = calculateEventPayouts(event);
    assertEqual(payouts.length, 1, "Payout count");
    assertClose(payoutFor(payouts, "winner").amount, 240, "Fixed payout");
  });

  test("Losing fixed-odds bet pays zero", () => {
    const event = fixedEvent({
      bets: [{ playerId: "loser", value: 100, outcome: "Dave", lockedOdds: 4 }],
    });
    assertEqual(calculateEventPayouts(event).length, 0, "Payout count");
  });

  test("Multiple fixed-odds winners use their own locked odds", () => {
    const event = fixedEvent({
      bets: [
        { playerId: "early", value: 100, outcome: "Dan", lockedOdds: 2 },
        { playerId: "late", value: 50, outcome: "Dan", lockedOdds: 3 },
        { playerId: "loser", value: 100, outcome: "Dave", lockedOdds: 2 },
      ],
    });
    const payouts = calculateEventPayouts(event);
    assertClose(payoutFor(payouts, "early").amount, 200, "Early winner payout");
    assertClose(payoutFor(payouts, "late").amount, 150, "Late winner payout");
    assertEqual(Boolean(payoutFor(payouts, "loser")), false, "Loser payout exists");
  });

  test("Fixed-odds bet missing locked odds falls back to 1x", () => {
    const event = fixedEvent({
      bets: [{ playerId: "legacy", value: 100, outcome: "Dan" }],
    });
    assertClose(payoutFor(calculateEventPayouts(event), "legacy").amount, 100, "Fallback payout");
  });

  test("Fixed-odds bonus is shared by winning stake", () => {
    const event = fixedEvent({
      bonusPoints: 200,
      bonusAwarded: true,
      bets: [
        { playerId: "small", value: 100, outcome: "Dan", lockedOdds: 2 },
        { playerId: "large", value: 300, outcome: "Dan", lockedOdds: 2 },
      ],
    });
    const payouts = calculateEventPayouts(event, true);
    assertClose(payoutFor(payouts, "small").amount, 250, "Smaller fixed winner payout");
    assertClose(payoutFor(payouts, "large").amount, 750, "Larger fixed winner payout");
  });

  test("Odds movement is capped at 20% per bet", () => {
    assertClose(clampFixedOddsMovement(2, 5), 2.4, "Upward movement cap");
    assertClose(clampFixedOddsMovement(2, 0.5), 1.6, "Downward movement cap");
    assertClose(clampFixedOddsMovement(2, 2.2), 2.2, "Movement within cap");

    const event = fixedEvent({
      status: "open",
      winningOutcome: null,
      outcomes: [
        { label: "Dan", seedLiquidity: 50 },
        { label: "Dave", seedLiquidity: 50 },
      ],
      bets: [],
    });
    const previous = getRawFixedOdds(event);
    event.currentOdds = previous;
    event.bets.push({ playerId: "player", value: 100, outcome: "Dan", lockedOdds: previous.Dan });
    const next = calculateNextFixedOdds(event, previous);
    Object.keys(next).forEach((outcome) => {
      if (next[outcome] > previous[outcome] * 1.2 + 0.000001 || next[outcome] < previous[outcome] * 0.8 - 0.000001) {
        throw new Error(`${outcome} moved more than 20% after one bet`);
      }
    });
  });

  const passed = results.filter((result) => result.passed).length;
  const summary = document.getElementById("summary");
  const list = document.getElementById("results");
  summary.textContent = `${passed} of ${results.length} tests passed.`;
  summary.dataset.passed = String(passed);
  summary.dataset.total = String(results.length);
  list.innerHTML = results.map((result) => `
    <li class="${result.passed ? "pass" : "fail"}">
      ${result.passed ? "PASS" : "FAIL"}: ${escapeHtml(result.name)}
      ${result.message ? `<small>${escapeHtml(result.message)}</small>` : ""}
    </li>
  `).join("");

  return results;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", runPayoutTests);
} else {
  runPayoutTests();
}
