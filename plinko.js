function playPlinko() {
  const slots = [0.5, 1, 2, 5, 10]; // Multipliers
  const resultIndex = Math.floor(Math.random() * slots.length);
  return slots[resultIndex];
}
