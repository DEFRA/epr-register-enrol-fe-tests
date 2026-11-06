import { expect } from '@wdio/globals'
import ManageRegistrationAccreditationPage from 'page-objects/manage-registration-accreditation.page'

// Org names can hold regex metacharacters ("Smith & Co. (UK) Ltd").
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// The seed's year follows the backend's clock when the stack started, which
// is not this runner's clock if the stack was started before 1 January, so it
// is read off the manage page's caption ("orgName (year, material)") rather
// than worked out here. Shared by the specs whose orgs are seeded by the
// backend's DevExporterAccreditationSeedService; leaves the browser on the
// manage page at managePath.
export async function readSeededYear({
  managePath,
  organisationName,
  material
}) {
  const captionPattern = new RegExp(
    `^${escapeRegExp(organisationName)} \\((\\d{4}), ${escapeRegExp(material)}\\)$`
  )
  await ManageRegistrationAccreditationPage.open(managePath)
  const pageCaption = ManageRegistrationAccreditationPage.pageCaption
  await pageCaption.waitForDisplayed()
  const text = await pageCaption.getText()
  expect(text).toMatch(captionPattern)
  const year = Number(text.match(captionPattern)[1])
  // Sanity check: seeded this year, or last year for a stack started before
  // 1 January (UTC, as the backend's clock is).
  const thisYear = new Date().getUTCFullYear()
  expect([thisYear - 1, thisYear]).toContain(year)
  return year
}
