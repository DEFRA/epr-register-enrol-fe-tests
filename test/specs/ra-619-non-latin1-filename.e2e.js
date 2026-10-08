import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import TaskListPage from 'page-objects/tasklist.page'
import OverseasReprocessingSitesPage from 'page-objects/overseas-reprocessing-sites.page'
import ConfirmOverseasSitesPage from 'page-objects/confirm-overseas-sites.page'
import BesEvidencePage from 'page-objects/bes-evidence.page'
import { completePrnBusinessPlanSamplingPlan } from '../helpers/accreditation-journey.js'
import { completeOverseasSites } from '../helpers/case-management.js'

// RA-619: a file whose original name holds a character above U+00FF (Vietnamese
// diacritics, CJK) used to fail the upload with a generic error, because the frontend
// passed the filename to cdp-uploader in an HTTP header and fetch() only allows Latin-1
// there. Both upload flows share that code, so this walks one exporter application
// through both: the sampling plan under a Vietnamese name and the BES evidence under a
// CJK-only name, and asserts each is listed exactly as the user chose it.
//
// Same org (50006, Glass exporter) and run-unique disposable year as
// ra-570-amend-bes-evidence.e2e.js, so it does not race the other exporter specs.
describe('RA-619: uploads with filenames outside Latin-1', () => {
  const SAMPLING_PLAN_NAME = 'Báo cáo kiểm tra ẻ'
  const BES_EVIDENCE_NAME = '报告'
  const TASK_LIST_PATH = '/accreditation/task-list/'

  beforeEach(async () => {
    await browser.deleteCookies()
    await LoginPage.open()
    await browser.execute(() => {
      // eslint-disable-next-line no-undef
      localStorage.clear()
      // eslint-disable-next-line no-undef
      sessionStorage.clear()
    })
    await LoginPage.switchToOperator()
    await LoginPage.loginAsOperator()
    await OperatorPage.open()
  })

  afterEach(async () => {
    await LoginPage.signOut()
  })

  it('lists a Vietnamese-named sampling plan and a CJK-named BES evidence file exactly as uploaded', async () => {
    await OperatorPage.navigateToExporterAccreditationGlass()
    const [, organisationId, registrationId, materialType] = new URL(
      await browser.getUrl()
    ).pathname
      .split('/')
      .filter(Boolean)
    const year = String(3000 + (Date.now() % 1000))
    await browser.url(
      `/operator-accreditation/${organisationId}/${registrationId}/${materialType}/${year}`
    )

    await OperatorAccreditationPage.clickContinue()
    await browser.waitUntil(
      async () => (await browser.getUrl()).includes(TASK_LIST_PATH),
      { timeout: 10000, timeoutMsg: 'Did not reach task list' }
    )
    const applicationId = (await browser.getUrl())
      .split(TASK_LIST_PATH)[1]
      .split('?')[0]

    // Sampling plan flow: the page object asserts the name is listed as given.
    await completePrnBusinessPlanSamplingPlan({
      material: 'Glass',
      samplingPlanBaseName: SAMPLING_PLAN_NAME
    })

    await expect(browser).toHaveUrl(expect.stringContaining(TASK_LIST_PATH))
    await TaskListPage.overseasSitesLink.click()
    // RA-597: ReEx seeds this application with sites that have no contact
    // details, recycling operations or codes, and the site list will not
    // continue while any site in the application is missing them. This journey
    // is about something else, so fill them in rather than walk each by hand.
    await completeOverseasSites(organisationId, applicationId)
    await OverseasReprocessingSitesPage.continue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/confirm-overseas-sites')
    )
    await ConfirmOverseasSitesPage.confirmAndContinue()

    // BES evidence flow.
    await expect(browser).toHaveUrl(expect.stringContaining(TASK_LIST_PATH))
    await TaskListPage.besLink.click()
    await BesEvidencePage.pendingUploadLink.click()
    await BesEvidencePage.uploadFile('business-plan.pdf', {
      baseName: BES_EVIDENCE_NAME
    })
    await BesEvidencePage.selectNo()

    const listed = await BesEvidencePage.cyaFilenames()
    expect(listed).toHaveLength(1)
    expect(listed[0]).toContain(BES_EVIDENCE_NAME)
    expect(listed[0]).toMatch(/\.pdf$/)
  })
})
