// Character cards, the 3-slot hand, and the deck.
const CARD_DEFS = {
  knight: { name: "Knight", color: "#8fa6c0" },
  ranger: { name: "Ranger", color: "#6f9c5a" },
  mage: { name: "Mage", color: "#9b7fd1" },
  rat: { name: "Rat", color: "#a0826d" },
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
    reset,
    serialize,
    restore,
    get: (slot) => hand[slot],
    slots: () => hand.slice(),
    deckCount: () => deck.length,
  };
})();
