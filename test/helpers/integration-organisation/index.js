// The organisation an integrated run on the test environment works with.
//
// onPrepare (hooks.js) seeds it once per run: a Companies House organisation
// approved to reprocess and export every material, linked to a Defra ID user,
// with overseas sites on some exporter registrations. Each test then looks up
// the ids for its material and signs in as that user:
//
//   let plastic
//   beforeEach(async () => {
//     plastic = await signInForMaterial({
//       material: 'plastic',
//       wasteProcessingType: 'exporter'
//     })
//   })
//
// The seeding itself, also usable on its own, is under seeding/.
export {
  operatorAccreditationLinks,
  registerEnrolFrontendUrl
} from './accreditation-links.js'
export { prepareSeededOrganisation } from './hooks.js'
export {
  hasSeededOrganisation,
  loadOrganisation,
  seedOrganisation,
  seededMaterial,
  seededOrganisation
} from './seeded-organisation.js'
export { signInAsSeededOperator, signInForMaterial } from './sign-in.js'
