export const title = "Selecting and preparing a question photo";
export const state = (v) => {
  if (v.attached !== 0 && v.attached !== v.selected) return "Wrong photo attached";
  if (v.errorFrom !== 0 && v.errorFrom !== v.selected) return "Old photo error shown";
  if (v.pending.length && v.oldAnswer) return "Previous answer still visible";
  if (v.attached !== 0) return "Selected photo ready";
  if (v.pending.length) return "Preparing a photo";
  if (v.selected === 0) return "No photo attached";
  return "Photo preparation failed";
};
export const step = (action) => {
  if (action.startsWith("Select") || action.startsWith("LegacySelect")) return "you choose a photo";
  if (action.startsWith("Remove")) return "you remove the photo";
  if (action.startsWith("Ready") || action.startsWith("LegacyReady")) return "a photo finishes loading";
  if (action.startsWith("Failed") || action.startsWith("LegacyFailed")) return "a photo fails to load";
  return null;
};
