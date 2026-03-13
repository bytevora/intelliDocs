const CURSOR_COLORS = [
  { color: "#958DF1", light: "#958DF133" },
  { color: "#F98181", light: "#F9818133" },
  { color: "#FBBC88", light: "#FBBC8833" },
  { color: "#FAF594", light: "#FAF59433" },
  { color: "#70CFF8", light: "#70CFF833" },
  { color: "#94FADB", light: "#94FADB33" },
  { color: "#B9F18D", light: "#B9F18D33" },
  { color: "#FFC0CB", light: "#FFC0CB33" },
];

export function getCursorColor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  const index = Math.abs(hash) % CURSOR_COLORS.length;
  return CURSOR_COLORS[index];
}
