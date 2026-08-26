import { browser, $ } from '@wdio/globals'

class Page {
  get pageHeading() {
    return $('h1')
  }

  get pageText() {
    return $('span.govuk-caption-m')
  }

  // RA-309 AC03: persistent application-header strip (operator/material/site),
  // rendered below the back link on every accreditation page.
  get applicationHeader() {
    return $('[data-testid="application-header"]')
  }

  get applicationHeaderOperatorName() {
    return $('[data-testid="application-header-operator-name"]')
  }

  get applicationHeaderMaterialType() {
    return $('[data-testid="application-header-material-type"]')
  }

  get applicationHeaderSiteName() {
    return $('[data-testid="application-header-site-name"]')
  }

  // RA-487: the service-navigation "Home" link now always points at the
  // Re-Ex frontend (unreachable from this e2e env) — no in-app deep-linking
  // to assert on any more, so this just confirms the item renders.
  get homeNavLink() {
    return $('[data-testid="nav-home-link"]')
  }

  // RA-487: operator-only — regulators have no Defra ID account to manage.
  get manageAccountNavLink() {
    return $('[data-testid="nav-manage-account-link"]')
  }

  get signOutNavLink() {
    return $('[data-testid="nav-sign-out-link"]')
  }

  // Footer support links, rendered on every page via the shared layout.
  get footerContactLink() {
    return $('.govuk-footer__link[href="/contact"]')
  }

  get footerPrivacyLink() {
    return $('.govuk-footer__link[href*="privacy-policy"]')
  }

  get footerCookiesLink() {
    return $('.govuk-footer__link[href="/cookies"]')
  }

  get footerAccessibilityLink() {
    return $('.govuk-footer__link[href*="accessibility-statement"]')
  }

  open(path) {
    return browser.url(path)
  }

  // Headless Chrome in CI intermittently reports "move target out of bounds"
  // for the WebDriver Actions-based click on this suite's taller error-summary
  // pages, and silently never submits the form (confirmed via server logs —
  // no request is ever received). A JS-dispatched click sidesteps the
  // viewport/coordinate calculation entirely, so use it for anything that
  // must reliably submit.
  async clickReliably(element) {
    await element.waitForDisplayed()
    await element.scrollIntoView()
    const resolved = await element
    await browser.execute((el) => el.click(), resolved)
  }
}

export { Page }
