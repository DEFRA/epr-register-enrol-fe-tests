import { browser } from '@wdio/globals'

import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import RegulatorPage from 'page-objects/regulator.page'
import AboutPage from 'page-objects/about.page'
import { expectNoAccessibilityViolations } from '../../helpers/accessibility.js'

// RA-437: `npm run test:accessibility` referenced this directory before any
// spec existed in it, so accessibility was never actually checked. Covers
// the sign-in page (public, unauthenticated) and one authenticated landing
// page per role, plus a static content page — the pages every user hits
// regardless of which journey they're on.
describe('Accessibility — key pages', () => {
  beforeEach(async () => {
    await browser.deleteCookies()
  })

  it('Sign-in page should have no WCAG 2.1 A/AA violations', async () => {
    await LoginPage.open()
    await expectNoAccessibilityViolations()
  })

  it('About page should have no WCAG 2.1 A/AA violations', async () => {
    await AboutPage.open()
    await expectNoAccessibilityViolations()
  })

  it('Operator home page should have no WCAG 2.1 A/AA violations', async () => {
    await LoginPage.switchToOperator()
    await LoginPage.loginAsOperator()
    await OperatorPage.open()
    await expectNoAccessibilityViolations()
    await LoginPage.signOut()
  })

  it('Regulator home page should have no WCAG 2.1 A/AA violations', async () => {
    await LoginPage.openRegulatorLogin()
    await LoginPage.loginAsUser()
    await browser.waitUntil(
      async () => !(await browser.getUrl()).includes('/stub/login'),
      { timeout: 15000, timeoutMsg: 'Stub login did not redirect after login' }
    )
    await RegulatorPage.open()
    await expectNoAccessibilityViolations()
    await LoginPage.signOut()
  })
})
