export const title = "Safely replacing a personal API key";
export const state = (v) => {
  if (v.phase === "Failed" && v.stored === "no key") return "Replacement fails and old key is lost";
  if (v.phase === "Failed") return "Replacement fails and old key remains";
  if (v.phase === "Updated") return "New key saved";
  if (v.phase === "Deleted") return "Previous key deleted";
  if (v.phase === "Pending") return "Replacing the key";
  return "Existing key available";
};
export const step = (action) => {
  if (action === "BeginReplacement") return "you save a new key";
  if (action === "LegacyDelete") return "the old key is deleted";
  if (action === "LegacyWriteSucceeds" || action === "AtomicUpdateSucceeds") return "the new key saves";
  if (action === "LegacyWriteFails" || action === "AtomicUpdateFails") return "the replacement write fails";
  return null;
};
