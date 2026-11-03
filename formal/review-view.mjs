export const title = "Review answer visibility across due questions";
export const state = (v) => {
  if (v.revealed && v.revealedFor !== v.shown) return "Next question shows old reveal";
  if (v.revealed) return "Current review answer revealed";
  return "Review answer hidden";
};
export const step = (action) => {
  if (action === "Reveal") return "you reveal the answer";
  if (action === "Hide") return "you hide the answer";
  if (action === "ChangeDue" || action === "LegacyChangeDue") return "a different question becomes due";
  return null;
};
