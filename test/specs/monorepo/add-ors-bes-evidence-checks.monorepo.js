import { browser, expect } from '@wdio/globals'
import AddToAccreditationPage from 'page-objects/add-to-accreditation.page'
import BesEvidencePage from 'page-objects/bes-evidence.page'
import ManageOverseasSitesPage from 'page-objects/manage-overseas-sites.page'

import { getAccreditationChanges } from '../../helpers/case-management.js'
import {
  MONOREPO_RUN_FLAG,
  clearChangeRequests,
  setOverseasSiteBesEvidence,
  skipUnlessMonorepoRun
} from '../../helpers/monorepo.js'
import { signInAsOperator } from '../../helpers/monorepo-journey.js'
import { reportDetails, reportStep } from '../../helpers/report-step.js'
import { readSeededYear } from '../../helpers/seeded-year.js'
import { waitForUrl } from '../../helpers/wait-for-url.js'
import {
  MANAGE_PATH,
  MATERIAL,
  ORGANISATION_ID,
  ORGANISATION_NAME,
  ORS,
  OVERSEAS_SITES_PATH,
  accreditationApplicationId
} from '../../fixtures/in-year-change-org.js'

// Runs only against the DEFRA/epr-register-enrol monorepo's local stack:
// npm run test:monorepo (wdio.monorepo.conf.js). Never in CI.
//
// RA-495 (3bb.38): granting an add-ORS change request adds the BES evidence
// uploaded on it to the files the site already holds on the accreditation,
// and a grant cannot refuse. So the operator's upload on the request is held
// to the application's rules across both, before anything is submitted: the
// 10-file cap per site (RA-605) counts the site's existing files, and no file
// may share a name with one already on the accreditation (RA-571).
//
// Delhi (India, outside the EU and OECD) needs BES evidence. The spec gives
// its site on the seeded accreditation application files of its own, as if
// uploaded on the application, and takes them away again afterwards. Both
// refusals happen before the file is sent to the CDP uploader.

const DELHI = ORS.delhi

const MAX_FILES_MESSAGE =
  'You can only upload a maximum of 10 files as evidence of broadly equivalent standards.'
const DUPLICATE_FILENAME_MESSAGE =
  'A file with this name has already been uploaded. Please rename the file so that each uploaded document has a unique filename'

describe('RA-495: an add-ORS BES upload is checked against the files the site already holds @monorepo', () => {
  let changePath
  let applicationId

  async function resetOrganisation() {
    const cleared = await clearChangeRequests({
      organisationId: ORGANISATION_ID
    })
    const evidence = await setOverseasSiteBesEvidence({
      organisationId: ORGANISATION_ID,
      siteId: DELHI.siteId
    })
    reportDetails(`Reset organisation ${ORGANISATION_ID}`, {
      ...cleared,
      ...evidence
    })
  }

  async function giveDelhiFiles(filenames) {
    const { applications } = await setOverseasSiteBesEvidence({
      organisationId: ORGANISATION_ID,
      siteId: DELHI.siteId,
      filenames
    })
    reportDetails("Delhi's files on the accreditation", { filenames })
    expect(applications).toBeGreaterThan(0)
  }

  async function openDelhiBesUpload() {
    await browser.url(`${changePath}/add/${DELHI.siteId}/bes-evidence`)
    await waitForUrl(
      (url) =>
        new URL(url).pathname.endsWith(`/add/${DELHI.siteId}/bes-evidence`),
      "Did not reach Delhi's BES evidence upload"
    )
  }

  async function delhiRequestUploads() {
    const { activeRequest } = await getAccreditationChanges(
      ORGANISATION_ID,
      applicationId
    )
    const site = activeRequest.sites.find((s) => s.siteId === DELHI.siteId)
    return site.besEvidence?.besEvidenceUploads ?? []
  }

  before(function () {
    skipUnlessMonorepoRun(this)
  })

  before(async () => {
    await resetOrganisation()

    await browser.deleteCookies()
    await signInAsOperator()
    const year = await readSeededYear({
      managePath: MANAGE_PATH,
      organisationName: ORGANISATION_NAME,
      material: MATERIAL
    })
    applicationId = accreditationApplicationId(year)
    changePath = `/accreditation/manage-overseas-sites/${applicationId}`

    await reportStep(
      `Operator: add ORS ${DELHI.orsId} to the accreditation`,
      async () => {
        await browser.url(OVERSEAS_SITES_PATH)
        await ManageOverseasSitesPage.openTab('registered')
        await ManageOverseasSitesPage.addToAccreditation(DELHI.siteId)
        await waitForUrl(
          (url) => new URL(url).pathname.endsWith(`/add/${DELHI.siteId}`),
          "Did not reach Delhi's add to accreditation summary"
        )
        await expect(AddToAccreditationPage.rowAction('bes-evidence')).toExist()
      }
    )
  })

  after(async () => {
    if (process.env[MONOREPO_RUN_FLAG] === 'true') {
      await resetOrganisation()
    }
  })

  it("refuses a file once the site's own files and the request's reach the 10-file cap", async () => {
    await giveDelhiFiles(
      Array.from({ length: 10 }, (_, i) => `held-evidence-${i + 1}.pdf`)
    )

    await reportStep('Operator: upload an 11th file for Delhi', async () => {
      await openDelhiBesUpload()
      await BesEvidencePage.attemptUpload('business-plan.pdf')
    })

    await expect(BesEvidencePage.fileError).toHaveText(
      expect.stringContaining(MAX_FILES_MESSAGE)
    )
    expect(await delhiRequestUploads()).toEqual([])
  })

  it('refuses a file named as one the site already holds on the accreditation', async () => {
    await giveDelhiFiles(['held-evidence.pdf'])

    await reportStep(
      'Operator: upload held-evidence.pdf for Delhi again',
      async () => {
        await openDelhiBesUpload()
        await BesEvidencePage.attemptUpload('business-plan.pdf', {
          exactName: 'held-evidence.pdf'
        })
      }
    )

    await expect(BesEvidencePage.fileError).toHaveText(
      expect.stringContaining(DUPLICATE_FILENAME_MESSAGE)
    )
    expect(await delhiRequestUploads()).toEqual([])
  })
})
