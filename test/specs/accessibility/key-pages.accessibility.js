import { browser } from '@wdio/globals'

import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import { expectNoAccessibilityViolations } from '../../helpers/accessibility.js'

// RA-437: `npm run test:accessibility` referenced this directory before any
// spec existed in it, so accessibility was never actually checked. Covers
// the sign-in page (public, unauthenticated) and the operator's
// authenticated landing page — the pages every user hits regardless of which
// journey they're on. (RA-537: the OJ frontend no longer has a regulator
// home page; regulator casework lives in Case Management.)
describe('Accessibility — key pages', () => {
  beforeEach(async () => {
    await browser.deleteCookies()
  })

  it('Sign-in page should have no WCAG 2.1 A/AA violations', async () => {
    await LoginPage.open()
    await expectNoAccessibilityViolations()
  })

  // /about was removed (epr-register-enrol-frontend) — a redundant,
  // never-built scaffold page — so there's nothing left here to check.

  it('Operator home page should have no WCAG 2.1 A/AA violations', async () => {
    await LoginPage.switchToOperator()
    await LoginPage.loginAsOperator()
    await OperatorPage.open()
    await expectNoAccessibilityViolations()
    await LoginPage.signOut()
  })
})
