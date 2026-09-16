import { browser, expect, $ } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import TaskListPage from 'page-objects/tasklist.page'
import PrnTonnagePage from 'page-objects/prn-tonnage.page'
import PrnAuthorityPage from 'page-objects/prn-authority.page'
import PrnCheckAnswersPage from 'page-objects/prn-check-answers.page'
import BusinessPlanPage from 'page-objects/business-plan.page'
import BusinessPlanDetailPage from 'page-objects/business-plan-detail.page'
import BusinessPlanCheckAnswersPage from 'page-objects/business-plan-check-answers.page'
import SamplingPlanPage from 'page-objects/sampling-plan.page'
import OverseasReprocessingSitesPage from 'page-objects/overseas-reprocessing-sites.page'
import AddOrsSiteNamePage from 'page-objects/add-ors-site-name.page'
import AddOrsSiteLocationPage from 'page-objects/add-ors-site-location.page'

// RA-580-2: the site-location coordinates field now accepts 4-10 decimal
// places inclusive (was an unbounded "4+" floor) — see
// epr-register-enrol-frontend's site-location/controller.js and
// epr-register-enrol-backend's CoordinatesValidation.cs for the matching
// backend rule. DMS (degrees/minutes/seconds) input is a ReEx-import-only
// concern handled entirely server-side in epr-register-enrol-backend's
// HttpReExApiAdapter.MapCoordinates — there is no user-facing form or API
// this suite can drive to exercise that path, so it is covered by
// HttpReExApiAdapterTests in the backend repo instead, not here.
describe('RA-580-2: coordinate decimal-place precision on Add ORS site location', () => {
  let applicationId

  // The "Overseas sites" task-list item is locked (task-list/controller.js:
  // osLocked = !spComplete) until PRN tonnage, business plan, and sampling
  // plan are all Completed — confirmed live via CI: reusing org 50017 with
  // nothing but a Continue click landed on a task-list page where
  // task-overseas-sites-tag/-status rendered but NOT task-overseas-sites-link,
  // exactly this lock. Every other spec that reaches the overseas-sites task
  // either drives this same chain itself (ors-fee-calculation.e2e.js) or
  // piggybacks on an earlier test in its own file having already completed
  // it for the same shared org/application (exporter-accreditation.e2e.js).
  // Doing it once here, in a `before` hook, unlocks org 50017's one
  // application for every `it()` below without re-driving PRN/business-plan/
  // sampling-plan four times over.
  before(async () => {
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

    await OperatorPage.navigateToPrecisionTestOrg()
    await OperatorAccreditationPage.clickContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )
    applicationId = (await browser.getUrl())
      .split('/accreditation/task-list/')[1]
      .split('?')[0]

    // PRN tonnage — mirrors ors-fee-calculation.e2e.js's idempotent handling:
    // a re-run against an already-completed section lands straight on its
    // check-answers page instead of the input form.
    await TaskListPage.PRNTonnageLink.click()
    const headingText = await $('h1')
      .getText()
      .catch(() => '')
    const alreadyOnCheckAnswers =
      headingText === 'Check your answers before you continue'

    if (alreadyOnCheckAnswers) {
      await PrnCheckAnswersPage.confirmAndContinue()
    } else {
      await expect(browser).toHaveUrl(
        expect.stringContaining('/accreditation/tonnage')
      )
      await PrnTonnagePage.selectRandomOption()
      await PrnTonnagePage.saveAndContinue()

      await expect(browser).toHaveUrl(
        expect.stringContaining('/accreditation/tonnage-authority')
      )
      await PrnAuthorityPage.addAuthoriser()
      await PrnAuthorityPage.saveAndContinue()

      await expect(PrnCheckAnswersPage.pageHeading).toHaveText(
        'Check your answers before you continue'
      )
      await PrnCheckAnswersPage.confirmAndContinue()
    }

    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )

    // Business plan.
    await TaskListPage.businessPlanLink.click()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/business-plan')
    )
    await BusinessPlanPage.fillPercentages([15, 15, 15, 15, 15, 15, 10])
    await BusinessPlanPage.saveAndContinue()

    await expect(BusinessPlanDetailPage.pageHeading).toHaveText(
      "Add more details about how you'll spend the PERN income"
    )
    await BusinessPlanDetailPage.fillDescriptions()
    await BusinessPlanDetailPage.saveAndContinue()

    await BusinessPlanCheckAnswersPage.confirmAndContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )

    // Sampling plan — unlocks "Overseas sites" once Completed.
    await TaskListPage.SIPlanLink.click()
    await expect(SamplingPlanPage.pageHeading).toHaveText(
      'Upload sampling and inspection plan - part 2 - Plastic'
    )
    await SamplingPlanPage.uploadFile('business-plan.pdf')
    await SamplingPlanPage.saveAndContinue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )

    await LoginPage.signOut()
  })

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
  })

  afterEach(async () => {
    await LoginPage.signOut()
  })

  // Starts a fresh "Add ORS" wizard entry directly from select-overseas-sites
  // (now unlocked by the `before` hook above) rather than re-navigating via
  // /operator + Continue each time. Site name is unique per call so each
  // test adds its own distinct site.
  async function goToAddOrsSiteLocation(siteName) {
    await browser.url(`/accreditation/select-overseas-sites/${applicationId}`)
    await OverseasReprocessingSitesPage.addNewOrsButton.waitForDisplayed()
    await OverseasReprocessingSitesPage.addNewOrsButton.click()
    await expect(browser).toHaveUrl(expect.stringContaining('/site-name'))

    await AddOrsSiteNamePage.enterSiteName(siteName)
    await AddOrsSiteNamePage.continue()
    await expect(browser).toHaveUrl(expect.stringContaining('/site-location'))
  }

  it('accepts coordinates given to exactly 4 decimal places', async () => {
    await goToAddOrsSiteLocation('RA-580-2 Precision 4dp GmbH')
    await AddOrsSiteLocationPage.enterLocation({
      addressLine1: 'Praezisionsstrasse 4',
      townOrCity: 'Hamburg',
      country: 'Germany',
      coordinates: '53.5511, 9.9937'
    })
    await AddOrsSiteLocationPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/site-contact-details')
    )
  })

  it('accepts coordinates given to exactly 10 decimal places', async () => {
    await goToAddOrsSiteLocation('RA-580-2 Precision 10dp GmbH')
    await AddOrsSiteLocationPage.enterLocation({
      addressLine1: 'Praezisionsstrasse 10',
      townOrCity: 'Hamburg',
      country: 'Germany',
      coordinates: '53.5511000000, 9.9937000000'
    })
    await AddOrsSiteLocationPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/site-contact-details')
    )
  })

  it('rejects coordinates given to fewer than 4 decimal places', async () => {
    await goToAddOrsSiteLocation('RA-580-2 Precision 3dp GmbH')
    await AddOrsSiteLocationPage.enterLocation({
      addressLine1: 'Praezisionsstrasse 3',
      townOrCity: 'Hamburg',
      country: 'Germany',
      coordinates: '53.551, 9.993'
    })
    await AddOrsSiteLocationPage.continue()

    await expect(browser).toHaveUrl(expect.stringContaining('/site-location'))
    await expect(AddOrsSiteLocationPage.errorSummary).toBeDisplayed()
    await expect(AddOrsSiteLocationPage.errorSummary).toHaveText(
      expect.stringContaining(
        'Enter the latitude and longitude to between 4 and 10 decimal places'
      )
    )
  })

  it('rejects coordinates given to more than 10 decimal places', async () => {
    await goToAddOrsSiteLocation('RA-580-2 Precision 11dp GmbH')
    await AddOrsSiteLocationPage.enterLocation({
      addressLine1: 'Praezisionsstrasse 11',
      townOrCity: 'Hamburg',
      country: 'Germany',
      coordinates: '53.55110000001, 9.99370000001'
    })
    await AddOrsSiteLocationPage.continue()

    await expect(browser).toHaveUrl(expect.stringContaining('/site-location'))
    await expect(AddOrsSiteLocationPage.errorSummary).toBeDisplayed()
    await expect(AddOrsSiteLocationPage.errorSummary).toHaveText(
      expect.stringContaining(
        'Enter the latitude and longitude to between 4 and 10 decimal places'
      )
    )
  })
})
