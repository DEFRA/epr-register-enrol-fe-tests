import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import TaskListPage from 'page-objects/tasklist.page'
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

  // Reaches the Add ORS wizard's site-location step via the exporter path,
  // which needs no PRN tonnage/business-plan/sampling-plan setup first —
  // see exporter-accreditation.e2e.js's "Add ORS wizard" test for the same
  // shortcut. Site name is unique per call so each test starts a fresh ORS.
  async function goToAddOrsSiteLocation(siteName) {
    await OperatorPage.navigateToExporterAccreditationOwnOrg()
    await OperatorAccreditationPage.clickContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )

    await TaskListPage.overseasSitesLink.click()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/select-overseas-sites')
    )

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
