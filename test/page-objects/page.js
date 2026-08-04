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

  // RA-309 AC02: the service-navigation "Home" link, now pointing at
  // /operator rather than /.
  get homeNavLink() {
    return $('a.govuk-service-navigation__link[href="/operator"]')
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
