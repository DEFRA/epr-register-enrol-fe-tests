// RA-000: the bank payment reference an operator is told to quote. The OJ
// backend builds it once, at submit, from the organisation number stored on
// the application (ReEx's numeric orgId, never its ObjectId) and the nation,
// and every page shows that stored string. These are the backend's formats
// (PaymentReferenceBuilder.Build in epr-register-enrol-backend's
// AccreditationApplication/Services/PaymentReferences.cs).
import { expect } from '@wdio/globals'
import ViewPaymentDetailsPage from 'page-objects/view-payment-details.page'
import { getApplication } from './case-management.js'

const ENGLAND_REPROCESSOR = 'PR/PK/REP'
const ENGLAND_EXPORTER = 'PR/PK/EXP'
const NATION_PREFIXES = [
  ENGLAND_REPROCESSOR,
  ENGLAND_EXPORTER,
  'NI/PR/REEX',
  'PREX',
  'E800 81581'
]

/**
 * The reference for an England organisation. Every org the compose stack
 * seeds (StubReExApiAdapter / FakeOrganisationPersistence, bar the perf-test
 * orgs) is England, and its numeric URL organisation id is its org number.
 *
 * @param {object} options
 * @param {string | number} options.orgNumber
 * @param {boolean} options.isExporter
 * @returns {string}
 */
export function englandPaymentReference({ orgNumber, isExporter }) {
  if (!/^\d+$/.test(String(orgNumber))) {
    throw new Error(`Not an organisation number: ${orgNumber}`)
  }
  const prefix = isExporter ? ENGLAND_EXPORTER : ENGLAND_REPROCESSOR
  return `${prefix}/${orgNumber}`
}

/**
 * Asserts a reference is in one of the backend's formats and ends in a
 * numeric org number (so never "/null" and never an ObjectId), and, when the
 * org number is known, that it is that org's. For the test environment,
 * where the nation is ReEx's and not the suite's to choose.
 *
 * @param {string} reference
 * @param {object} [options]
 * @param {number} [options.orgNumber]
 */
export function assertPaymentReferenceFormat(reference, { orgNumber } = {}) {
  const prefix = NATION_PREFIXES.find((candidate) =>
    reference.startsWith(`${candidate}/`)
  )
  const number = prefix ? reference.slice(prefix.length + 1) : undefined
  if (!prefix || !/^\d+$/.test(number)) {
    throw new Error(`Payment reference "${reference}" is not in a known format`)
  }
  if (orgNumber !== undefined && number !== String(orgNumber)) {
    throw new Error(
      `Payment reference "${reference}" is not for organisation ${orgNumber}`
    )
  }
}

/**
 * For a submitted application: the backend's application carries the
 * expected reference (its GET builds paymentReference from the stored org
 * number and nation, with no ReEx lookup), and the view-payment-details page
 * shows that same string. Leaves the browser on view-payment-details.
 *
 * @param {object} options
 * @param {string} options.organisationId
 * @param {string} options.applicationId
 * @param {string} options.expected
 */
export async function assertStoredPaymentReference({
  organisationId,
  applicationId,
  expected
}) {
  const application = await getApplication(organisationId, applicationId)
  expect(application.paymentReference).toBe(expected)

  await ViewPaymentDetailsPage.open(applicationId)
  await expect(ViewPaymentDetailsPage.bankPaymentReference).toHaveText(expected)
}
