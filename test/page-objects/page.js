import { browser, $ } from '@wdio/globals'

class Page {
  get pageHeading() {
    return $('h1')
  }

  // RA-506: govuk-caption-l shown immediately before the page heading on
  // every journey page except operator-accreditation, which keeps the
  // legacy applicationHeader strip below instead.
  get pageCaption() {
    return $('[data-testid="page-caption"]')
  }

  // RA-309 AC03: persistent application-header strip, rendered below the
  // back link on the operator-accreditation landing page only (RA-506 —
  // every other journey page uses pageCaption above instead). Operator,
  // material, year and site are all rendered as one caption inside
  // applicationHeaderOperatorName rather than separate elements.
  get applicationHeader() {
    return $('[data-testid="application-header"]')
  }

  get applicationHeaderOperatorName() {
    return $('[data-testid="application-header-operator-name"]')
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

  // clickReliably returns before the next page loads, so anything read
  // straight after it can come from the page being left. Called with the URL
  // read before the click, this waits until the browser is on another page,
  // fully loaded.
  async waitToLeave(url) {
    await this.waitUntilLoadedAt(
      (current) => current !== url,
      `Did not move on from ${url}`
    )
  }

  // Waits until the browser is on a URL that satisfies predicate, fully
  // loaded, for a page reached without a click (e.g. a form that submits
  // itself). Returns that URL.
  async waitUntilLoadedAt(predicate, timeoutMsg) {
    let url
    await browser.waitUntil(
      async () => {
        url = await browser.getUrl()
        return (
          predicate(url) &&
          (await browser.execute(() => document.readyState)) === 'complete'
        )
      },
      { timeout: 30000, timeoutMsg }
    )
    return url
  }

  // clickReliably, then waits for the page the click loads, fully loaded. The
  // page being left is marked first, so a click that reloads the same URL
  // (a tab link to the tab already open) still waits for the reload.
  async clickAndWaitForNextPage(element) {
    await browser.execute(() => {
      window.__leavingPage = true
    })
    await this.clickReliably(element)
    await browser.waitUntil(
      async () =>
        (await browser.execute(
          () => !window.__leavingPage && document.readyState === 'complete'
        )) === true,
      { timeout: 30000, timeoutMsg: 'The next page did not load' }
    )
  }
}

export { Page }
