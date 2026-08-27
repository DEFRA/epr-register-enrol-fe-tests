import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import TaskListPage from 'page-objects/tasklist.page'
import { getApplication } from '../helpers/case-management.js'
import { expectedMaterialDisplay } from '../helpers/applicationHeader.js'

/**
 * RA-307: the ReEx API returns glassRecyclingProcess as an array of 0 or 1
 * elements (glass_re_melt / glass_other) rather than the plain string the
 * codebase previously assumed. This proves the fix end-to-end: the stub
 * ReEx org (50002, "Beta Recycling Co", seeded with glass_re_melt — see
 * FakeOrganisationPersistence.cs and StubReExApiAdapter.cs in
 * epr-register-enrol-backend) flows through to the persistent application
 * header as "Glass - Remelt", not plain "Glass".
 */
describe('RA-307: Glass recycling type shown on the application header', () => {
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

  it('shows "Glass - Remelt" on the task list header, not plain "Glass"', async () => {
    await OperatorPage.navigateToOperatorAccreditationGlass()
    await expect(OperatorAccreditationPage.pageHeading).not.toHaveText('')

    const landingUrl = await browser.getUrl()
    const [, organisationId] = new URL(landingUrl).pathname
      .split('/')
      .filter(Boolean)

    await OperatorAccreditationPage.clickContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list')
    )

    const applicationId = (await browser.getUrl())
      .split('/accreditation/task-list/')[1]
      .split('?')[0]
    const application = await getApplication(organisationId, applicationId)

    // Data-driven assertion (mirrors the real display logic against live
    // application data, so it can't drift out of sync with the fixture) ...
    await expect(TaskListPage.pageCaption).toHaveText(
      expect.stringContaining(expectedMaterialDisplay(application))
    )
    // ... plus an explicit assertion on the exact wording, so a helper-level
    // regression (e.g. expectedMaterialDisplay itself losing the array/string
    // handling this ticket fixed) would still be caught.
    await expect(TaskListPage.pageCaption).toHaveText(
      expect.stringContaining('Glass - Remelt')
    )
  })
})
