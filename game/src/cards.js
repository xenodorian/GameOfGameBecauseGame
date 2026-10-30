// Character cards, the 3-slot hand, and the deck.
const CARD_DEFS = {
  knight: { name: "Knight", color: "#8fa6c0" },
  ranger: { name: "Ranger", color: "#6f9c5a" },
  mage: { name: "Mage", color: "#9b7fd1" },
  weaver: { name: "Bone Weaver", color: "#d8d2c0" },
};

// Hand fills left to right. Extra cards go into the deck at a random spot.
// Deck contents stay hidden; the HUD only shows the count.
// When a hand slot opens, the top card of the deck moves into it.
const Hand = (() => {
  const SLOTS = 3;
  const hand = new Array(SLOTS).fill(null);
  const deck = [];

  function refill() {
    for (let i = 0; i < SLOTS; i++) {
      if (hand[i] === null && deck.length > 0) hand[i] = deck.shift();
    }
  }

  // Returns where the card landed so the HUD can animate to it.
  function collect(cardId) {
    const free = hand.indexOf(null);
    if (free !== -1) {
      hand[free] = cardId;
      return { where: "hand", slot: free };
    }
    const at = Math.floor(Math.random() * (deck.length + 1));
    deck.splice(at, 0, cardId);
    return { where: "deck" };
  }

  function discard(slot) {
    const cardId = hand[slot];
    hand[slot] = null;
    refill();
    return cardId;
  }

  // Card menu: the card in slot becomes the active face and leaves the hand; the old face goes
  // to the end of the filled slots.
  function useCard(slot, current) {
    const next = hand[slot];
    if (!next) return null;
    hand[slot] = null;
    const cards = hand.filter((c) => c !== null);
    cards.push(current);
    for (let i = 0; i < SLOTS; i++) hand[i] = cards[i] || null;
    return next;
  }

  // The leftmost card becomes the active face (kept for tests and tools).
  function swapIn(current) {
    const i = hand.findIndex((c) => c !== null);
    return i === -1 ? null : useCard(i, current);
  }

  // Empties the hand and the deck. Called when a new game starts.
  function reset() {
    hand.fill(null);
    deck.length = 0;
  }

  // Plain data for the save file, and back again.
  function serialize() {
    return { hand: hand.slice(), deck: deck.slice() };
  }

  function restore(data) {
    for (let i = 0; i < SLOTS; i++) hand[i] = data.hand[i] || null;
    deck.length = 0;
    deck.push(...data.deck);
  }

  return {
    SLOTS,
    collect,
    discard,
    swapIn,
    useCard,
    reset,
    serialize,
    restore,
    get: (slot) => hand[slot],
    slots: () => hand.slice(),
    deckCount: () => deck.length,
  };
})();
