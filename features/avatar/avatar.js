const PokerAvatar = (() => {
  const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
  const SUITS = [
    { key: "spades", symbol: "♠", label: "Spades", color: "#eaeaea" },
    { key: "hearts", symbol: "♥", label: "Hearts", color: "#ff5d5d" },
    { key: "diamonds", symbol: "♦", label: "Diamonds", color: "#ff5d5d" },
    { key: "clubs", symbol: "♣", label: "Clubs", color: "#eaeaea" },
  ];

  let root = null;

  function suitMeta(suit) {
    return SUITS.find((item) => item.key === suit) || SUITS[0];
  }

  function cardName(card) {
    if (!card?.rank || !card?.suit) return "Not selected";
    return `${card.rank}${suitMeta(card.suit).symbol}`;
  }

  function cardLongName(card) {
    if (!card?.rank || !card?.suit) return "Choose a card";
    const rankNames = { A: "Ace", K: "King", Q: "Queen", J: "Jack", T: "Ten" };
    return `${rankNames[card.rank] || card.rank} of ${suitMeta(card.suit).label}`;
  }

  function normalizeConfig(config) {
    if (!config) return null;
    const next = {
      card1: {
        rank: config.card1?.rank || config.card_1_rank || "",
        suit: config.card1?.suit || config.card_1_suit || "",
      },
      card2: {
        rank: config.card2?.rank || config.card_2_rank || "",
        suit: config.card2?.suit || config.card_2_suit || "",
      },
      avatarImageUrl: config.avatarImageUrl || config.avatar_image_url || null,
    };
    return isComplete(next) ? next : null;
  }

  function isComplete(config) {
    return Boolean(config?.card1?.rank && config?.card1?.suit && config?.card2?.rank && config?.card2?.suit);
  }

  function isDuplicate(card, other) {
    return Boolean(card?.rank && card?.suit && other?.rank && other?.suit && card.rank === other.rank && card.suit === other.suit);
  }

  function validate(config) {
    if (!isComplete(config)) return "Choose both cards first.";
    if (isDuplicate(config.card1, config.card2)) return "Choose two different physical cards.";
    return "";
  }

  function placeholder(initial = "?") {
    return `
      <span class="avatar-chip avatar-placeholder" aria-hidden="true">
        <span>${escapeHtml(String(initial || "?").charAt(0).toUpperCase())}</span>
      </span>
    `;
  }

  function renderCard(card, side) {
    const suit = suitMeta(card?.suit);
    const rank = card?.rank || "?";
    return `
      <span class="avatar-card avatar-card-${side}" style="--card-suit: ${suit.color}">
        <span class="avatar-card-rank">${escapeHtml(rank)}</span>
        <span class="avatar-card-suit">${suit.symbol}</span>
      </span>
    `;
  }

  function render(config, options = {}) {
    const normalized = normalizeConfig(config);
    if (!normalized) return placeholder(options.initial);
    const label = `${cardName(normalized.card1)} ${cardName(normalized.card2)} avatar`;
    return `
      <span class="avatar-chip" role="img" aria-label="${escapeAttr(label)}">
        <span class="avatar-glow"></span>
        ${renderCard(normalized.card1, "left")}
        ${renderCard(normalized.card2, "right")}
      </span>
    `;
  }

  function toRow(config) {
    const normalized = normalizeConfig(config);
    if (!normalized) return null;
    return {
      card_1_rank: normalized.card1.rank,
      card_1_suit: normalized.card1.suit,
      card_2_rank: normalized.card2.rank,
      card_2_suit: normalized.card2.suit,
      avatar_image_url: normalized.avatarImageUrl || null,
    };
  }

  function fromRow(row) {
    return normalizeConfig(row);
  }

  function mount(rootElement) {
    root = rootElement;
  }

  function renderCardSummary(config, key) {
    const card = config[key];
    return `
      <button class="avatar-card-selector" type="button" data-avatar-select="${key}">
        <span class="avatar-selector-icon">${card?.suit ? suitMeta(card.suit).symbol : "?"}</span>
        <span>
          <strong>${escapeHtml(key === "card1" ? "Card One" : "Card Two")}</strong>
          <em>${escapeHtml(cardName(card))}</em>
          <small>${escapeHtml(cardLongName(card))}</small>
        </span>
        <span class="avatar-selector-chevron">›</span>
      </button>
    `;
  }

  function renderEditor(config, error = "") {
    root.innerHTML = `
      <div class="avatar-editor">
        <button class="avatar-close" type="button" data-avatar-close aria-label="Close avatar editor">×</button>
        <div class="avatar-editor-heading">
          <p class="eyebrow">Create Avatar</p>
          <h2>Choose your poker hand</h2>
          <p>Pick two real cards. Pocket pairs are fine, as long as the suits are different.</p>
        </div>
        <div class="avatar-preview-wrap">
          ${render(config, { initial: "?" })}
        </div>
        <div class="avatar-selector-list">
          ${renderCardSummary(config, "card1")}
          ${renderCardSummary(config, "card2")}
        </div>
        ${error ? `<p class="avatar-error">${escapeHtml(error)}</p>` : ""}
        <button class="avatar-generate" type="button" data-avatar-save>Generate Avatar</button>
      </div>
    `;
  }

  function renderPicker(config, key, draftCard, error = "") {
    const selectedSuit = draftCard.suit || "spades";
    const selectedRank = draftCard.rank || "A";
    root.innerHTML = `
      <div class="avatar-editor avatar-picker">
        <button class="avatar-close" type="button" data-avatar-back aria-label="Back to avatar editor">×</button>
        <div class="avatar-editor-heading">
          <p class="eyebrow">${key === "card1" ? "Select Card One" : "Select Card Two"}</p>
          <h2>Choose card and suit</h2>
          <p>${key === "card1" ? "First" : "Second"} card: ${escapeHtml(selectedRank)}${suitMeta(selectedSuit).symbol}</p>
        </div>
        <div class="avatar-rank-carousel" role="listbox" aria-label="Card ranks">
          ${RANKS.map((rank) => `
            <button class="${rank === selectedRank ? "active" : ""}" type="button" data-avatar-rank="${rank}">
              <span>${rank}</span><small>${suitMeta(selectedSuit).symbol}</small>
            </button>
          `).join("")}
        </div>
        <h3>Select Suit</h3>
        <div class="avatar-suit-grid">
          ${SUITS.map((suit) => `
            <button class="${suit.key === selectedSuit ? "active" : ""}" type="button" data-avatar-suit="${suit.key}">
              <span style="color: ${suit.color}">${suit.symbol}</span>
              <small>${suit.label}</small>
            </button>
          `).join("")}
        </div>
        ${error ? `<p class="avatar-error">${escapeHtml(error)}</p>` : ""}
        <button class="avatar-generate" type="button" data-avatar-ok>OK</button>
      </div>
    `;
  }

  function open(options = {}) {
    if (!root) return Promise.resolve(null);
    const initial = normalizeConfig(options.config) || {
      card1: { rank: "A", suit: "spades" },
      card2: { rank: "K", suit: "hearts" },
      avatarImageUrl: null,
    };
    let config = JSON.parse(JSON.stringify(initial));
    let picker = null;
    let pickerDraft = null;

    root.hidden = false;
    document.body.classList.add("avatar-open");
    return new Promise((resolve) => {
      function close(result = null) {
        root.hidden = true;
        root.innerHTML = "";
        root.removeEventListener("click", onClick);
        document.body.classList.remove("avatar-open");
        resolve(result);
      }

      function showEditor(error = "") {
        picker = null;
        pickerDraft = null;
        renderEditor(config, error);
      }

      function showPicker(key, error = "") {
        picker = key;
        pickerDraft = { ...(config[key] || { rank: "A", suit: "spades" }) };
        renderPicker(config, key, pickerDraft, error);
      }

      function onClick(event) {
        const closeButton = event.target.closest("[data-avatar-close]");
        const backButton = event.target.closest("[data-avatar-back]");
        const selector = event.target.closest("[data-avatar-select]");
        const rankButton = event.target.closest("[data-avatar-rank]");
        const suitButton = event.target.closest("[data-avatar-suit]");
        const okButton = event.target.closest("[data-avatar-ok]");
        const saveButton = event.target.closest("[data-avatar-save]");
        if (event.target === root || closeButton) close(null);
        if (backButton) showEditor();
        if (selector) showPicker(selector.dataset.avatarSelect);
        if (rankButton && pickerDraft) {
          pickerDraft.rank = rankButton.dataset.avatarRank;
          renderPicker(config, picker, pickerDraft);
        }
        if (suitButton && pickerDraft) {
          pickerDraft.suit = suitButton.dataset.avatarSuit;
          renderPicker(config, picker, pickerDraft);
        }
        if (okButton && picker) {
          const otherKey = picker === "card1" ? "card2" : "card1";
          if (isDuplicate(pickerDraft, config[otherKey])) {
            renderPicker(config, picker, pickerDraft, `Cannot select the same card as ${otherKey === "card1" ? "Card One" : "Card Two"}.`);
            return;
          }
          config[picker] = { ...pickerDraft };
          showEditor();
        }
        if (saveButton) {
          const error = validate(config);
          if (error) {
            showEditor(error);
            return;
          }
          close(config);
        }
      }

      root.addEventListener("click", onClick);
      showEditor();
    });
  }

  return {
    mount,
    open,
    render,
    toRow,
    fromRow,
    validate,
    cardName,
  };
})();

window.PokerAvatar = PokerAvatar;
