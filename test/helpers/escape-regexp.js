// Escapes text for use as a literal inside a RegExp (or a Mongo $regex), so
// metacharacters in org names ("Smith & Co. (UK) Ltd") or paths match as-is.
export const escapeRegExp = (text) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
