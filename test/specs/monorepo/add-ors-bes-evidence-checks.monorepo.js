import { browser, expect } from '@wdio/globals'
import AccreditationRequestsPage from 'page-objects/accreditation-requests.page'
import AddToAccreditationPage from 'page-objects/add-to-accreditation.page'
import BesEvidencePage from 'page-objects/bes-evidence.page'
import ManageOverseasSitesPage from 'page-objects/manage-overseas-sites.page'
import SubmitApplicationPage from 'page-objects/submit-application.page'

import { getAccreditationChanges } from '../../helpers/case-management.js'
import {
  MONOREPO_RUN_FLAG,
  clearChangeRequests,
  setChangeRequestSite,
  setOverseasSiteBesEvidence,
  setSamplingPlanFiles,
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
//
// 3bb.48: a name the frontend cannot see (a sampling plan file's) is refused
// by the backend after the CDP upload, and the upload page then shows the
// same duplicate message. 3bb.49: Submit applies both rules again, so a draft
// whose files predate the checks (set up here directly) is refused, and the
// requests page shows the upload message, linking to the site.

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
    const samplingPlan = await setSamplingPlanFiles({
      organisationId: ORGANISATION_ID
    })
    reportDetails(`Reset organisation ${ORGANISATION_ID}`, {
      ...cleared,
      ...evidence,
      samplingPlan
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

  it("shows the duplicate message when the backend refuses a name only it can see (a sampling plan file's)", async () => {
    await setOverseasSiteBesEvidence({
      organisationId: ORGANISATION_ID,
      siteId: DELHI.siteId
    })
    const { applications } = await setSamplingPlanFiles({
      organisationId: ORGANISATION_ID,
      filenames: ['e2e-sampling-plan.pdf']
    })
    expect(applications).toBeGreaterThan(0)

    await reportStep(
      'Operator: upload e2e-sampling-plan.pdf for Delhi',
      async () => {
        await openDelhiBesUpload()
        await BesEvidencePage.attemptUpload('business-plan.pdf', {
          exactName: 'e2e-sampling-plan.pdf'
        })
        // Through the CDP uploader and its status page to the backend.
        await waitForUrl(
          (url) =>
            new URL(url).searchParams.get('reason') === 'duplicateFilename',
          'Was not sent back to the upload page with the duplicate reason',
          { timeout: 60000 }
        )
      }
    )

    await expect(BesEvidencePage.fileError).toHaveText(
      expect.stringContaining(DUPLICATE_FILENAME_MESSAGE)
    )
    expect(await delhiRequestUploads()).toEqual([])
    await setSamplingPlanFiles({ organisationId: ORGANISATION_ID })
  })

  it('refuses at Submit a draft whose files and the site’s are over the cap, linking to the site', async () => {
    const { changeRequests } = await setChangeRequestSite({
      organisationId: ORGANISATION_ID,
      siteId: DELHI.siteId,
      answers: {
        coordinates: '28.6139, 77.2090',
        operationCodes: ['R3'],
        conditionsOfExport: false
      },
      besFilenames: ['request-evidence.pdf']
    })
    expect(changeRequests).toBe(1)
    await giveDelhiFiles(
      Array.from({ length: 10 }, (_, i) => `held-evidence-${i + 1}.pdf`)
    )

    await reportStep('Operator: submit the request', async () => {
      await browser.url(`${changePath}/requests`)
      await AccreditationRequestsPage.continue()
      await waitForUrl(
        (url) => new URL(url).pathname.endsWith('/declaration'),
        'Did not reach the declaration'
      )
      await SubmitApplicationPage.submitApplication()
      await waitForUrl(
        (url) =>
          new URL(url).pathname.endsWith('/requests') &&
          new URL(url).searchParams.get('maxFiles') === String(DELHI.siteId),
        'Was not sent back to the requests page naming Delhi'
      )
    })

    await expect(
      AccreditationRequestsPage.errorRequest(DELHI.orsId, 'maxFiles')
    ).toHaveText(MAX_FILES_MESSAGE)

    await reportStep(
      "Operator: open Delhi's summary from the error",
      async () => {
        await AccreditationRequestsPage.errorRequest(
          DELHI.orsId,
          'maxFiles'
        ).click()
        await waitForUrl(
          (url) => new URL(url).pathname.endsWith(`/add/${DELHI.siteId}`),
          "Did not reach Delhi's summary"
        )
      }
    )
    await expect(AddToAccreditationPage.rowError('bes-evidence')).toHaveText(
      expect.stringContaining(MAX_FILES_MESSAGE)
    )

    const { activeRequest } = await getAccreditationChanges(
      ORGANISATION_ID,
      applicationId
    )
    expect(activeRequest?.status).toBe('InProgress')
  })
})
