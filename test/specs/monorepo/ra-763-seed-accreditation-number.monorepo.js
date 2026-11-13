import { expect } from '@wdio/globals'
import CmWorkItemPage from 'page-objects/cm-work-item.page'
import CmWorkItemsPage from 'page-objects/cm-work-items.page'

import {
  WORK_ITEM_STATES,
  findWorkItem,
  signInToCaseManagement
} from '../../helpers/case-management-journey.js'
import {
  MONOREPO_ORGS,
  forgetRegistrationAccreditationNumbers,
  seededAccreditationNumbers,
  skipUnlessMonorepoRun
} from '../../helpers/monorepo.js'
import {
  openAccreditation,
  startFresh,
  submitAccreditation
} from '../../helpers/monorepo-journey.js'
import { reportDetails, reportStep } from '../../helpers/report-step.js'
import { accreditationYear } from '../../config.js'

// Runs only against the DEFRA/epr-register-enrol monorepo's local stack:
// npm run test:monorepo (wdio.monorepo.conf.js). Never in CI.
//
// RA-763: seeding an application must keep the operator's accreditation
// number for last year, which renewals are derived from, instead of dropping
// it. The monorepo's backend uses the stub ReEx, which, like real ReEx, gives
// the accreditation a different sequence from the registration's, so a number
// derived from the registration number instead would fail here.
//
//   1 operator    opens the accreditation page, which seeds the application:
//                 last year's number is on it and on the Registration
//   2 operator    completes and submits it; the number is still there
//   3 regulator   finds the new work item in case management and opens it
//
// The Registration check needs the seed dual-write on, which the monorepo
// stack has off: run it with a compose.override.yml that sets
// DomainModel__ExpandEnabled and DomainModel__DualWriteSeed, and runs MongoDB
// as a replica set.

const ACCREDITATION_NUMBER = /^A\d{2}[ESWN][RX]\d{10}[A-Z]{2}$/

describe(`RA-763 seeding keeps last year's accreditation number ${accreditationYear} @monorepo`, () => {
  const org = MONOREPO_ORGS.reprocessor
  const progress = {}

  before(function () {
    skipUnlessMonorepoRun(this)
  })

  before(async () => {
    await startFresh(org)
    reportDetails(
      "Forgot the Registration's accreditation numbers",
      await forgetRegistrationAccreditationNumbers(org)
    )
  })

  it('Operator: opening the accreditation page seeds it with last year’s accreditation number', async () => {
    expect(await openAccreditation(org)).toBe('NOT STARTED')

    const seeded = await seededAccreditationNumbers(org, accreditationYear)
    reportDetails('Seeded numbers', seeded)
    const lastYear = Number(accreditationYear) - 1
    const registration = seeded.registrationReference
    const accreditation = seeded.lastYearsAccreditation?.accreditationNumber

    expect(seeded.lastYearsAccreditation?.year).toBe(lastYear)
    expect(accreditation).toMatch(ACCREDITATION_NUMBER)
    // Last year's registration and accreditation share the year, agency, org
    // and material; only the four-digit sequence differs.
    expect(accreditation.slice(1, 11)).toBe(registration.slice(1, 11))
    expect(accreditation.slice(15)).toBe(registration.slice(15))
    expect(accreditation.slice(11, 15)).not.toBe(registration.slice(11, 15))

    // The Registration keeps it against last year, in the same shape.
    expect(seeded.registrationAccreditationNumbers).toEqual([
      seeded.lastYearsAccreditation
    ])
    progress.lastYearsAccreditationNumber = accreditation
  })

  it('Operator: submits the application, which keeps the number', async function () {
    if (!progress.lastYearsAccreditationNumber) {
      this.skip()
    }

    progress.reference = await reportStep(
      'Operator: complete and submit the application',
      () => submitAccreditation({ org, isExporter: false })
    )

    const submitted = await seededAccreditationNumbers(org, accreditationYear)
    reportDetails('Numbers after submitting', submitted)
    expect(submitted.lastYearsAccreditation?.accreditationNumber).toBe(
      progress.lastYearsAccreditationNumber
    )
  })

  it('Regulator: sees the new work item in case management', async function () {
    if (!progress.reference) {
      this.skip()
    }

    await signInToCaseManagement()
    await reportStep(
      `Regulator: open the work item ${progress.reference}`,
      async () => {
        const workItem = await findWorkItem({
          organisation: org.name,
          applicantType: 'Reprocessor',
          state: WORK_ITEM_STATES.notStarted,
          reference: progress.reference
        })
        await CmWorkItemsPage.openWorkItem(workItem.workItemId)
        await CmWorkItemPage.waitUntilLoaded()
      }
    )
  })
})
