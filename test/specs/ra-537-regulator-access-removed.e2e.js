import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import ErrorPage from 'page-objects/error.page'

// RA-537: the OJ frontend no longer has a regulator side. Regulator casework
// lives in the separate Case Management service, so the frontend's
// placeholder /regulator page, the regulator user scope, the Azure Entra ID
// regulator login and the stub chooser's regulator option have all gone.
//
// The frontend's unit tests prove each route is no longer registered; this
// spec proves the removal is what a real browser sees through the running
// stack. The stub sign-in page offers no way into a regulator login, a stale
// ?type=regulator link lands on the operator chooser, and every old regulator
// URL — page and Entra ID auth routes alike — ends on the service's own
// not-found page (for signed-out and signed-in callers), while operator
// sign-in, which shares the stub routes, still works.
const REMOVED_PATHS = [
  '/regulator',
  '/en/regulator',
  '/cy/regulator',
  '/auth/regulator/login',
  '/auth/regulator/callback'
]

async function expectNotFoundPage() {
  await expect(ErrorPage.statusCode).toHaveText('404')
  await expect(ErrorPage.message).toHaveText('Page not found')
}

describe('RA-537: OJ regulator access removed', () => {
  beforeEach(async () => {
    await browser.deleteCookies()
  })

  it('offers no regulator sign-in on the stub login page', async () => {
    await LoginPage.switchToOperator()
    await expect(LoginPage.pageHeading).toHaveText('Select a operator user')
    await expect(LoginPage.regulatorLinks).toBeElementsArrayOfSize(0)
  })

  it('sends a stale ?type=regulator stub link to the operator chooser', async () => {
    await LoginPage.openStubLogin('regulator')
    await expect(browser).toHaveUrl(
      expect.stringContaining('/auth/stub/login?type=operator')
    )
    await expect(LoginPage.pageHeading).toHaveText('Select a operator user')
    await expect(LoginPage.regulatorLinks).toBeElementsArrayOfSize(0)
  })

  for (const path of REMOVED_PATHS) {
    it(`shows the not-found page for ${path} when signed out`, async () => {
      await browser.url(path)
      await expectNotFoundPage()
    })
  }

  it('shows the not-found page for the regulator URLs to a signed-in operator', async () => {
    await LoginPage.switchToOperator()
    await LoginPage.loginAsOperator()
    for (const path of REMOVED_PATHS) {
      await browser.url(path)
      await expectNotFoundPage()
    }
    // Operator access is untouched by the removal.
    await OperatorPage.open()
    await expect(LoginPage.signOutLink).toBeDisplayed()
    await LoginPage.signOut()
  })
})
