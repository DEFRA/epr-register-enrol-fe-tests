// The 2-digit year in seeded registration, accreditation and change request
// numbers, e.g. 26 for 2026.
export const yearSuffix = (year) => String(year).slice(-2)

// RA-739: the /manage URLs carry the registration number, which the seed gives
// for the year it ran in (UTC, as the backend's clock is), so a stack seeded
// before 1 January needs restarting for these paths.
export const seededRegistrationYear = () => new Date().getUTCFullYear()
