export const title = "Question editing and asynchronous answers";
export const state = (v) => {
  if (v.phase === "Answered" && v.visible !== v.draft) return "Old answer shown for new question";
  if (v.phase === "Failed" && v.failedFrom !== v.draft) return "Old error shown for new question";
  if (v.phase === "Loading") {
    return v.source[v.active] === v.draft ? "Answer is loading" : "Question changed while answer loads";
  }
  if (v.phase === "Answered") return "Current answer shown";
  if (v.phase === "Failed") return "Current error shown";
  return "Editing question";
};
export const step = (action, from, to) => {
  if (action.startsWith("Begin")) return "you ask to solve";
  if (action.startsWith("LegacyEdit") || action.startsWith("Edit")) return "you change the question";
  if (action.startsWith("Complete")) return "the answer arrives";
  if (action.startsWith("Fail")) return "the request fails";
  return null;
};
