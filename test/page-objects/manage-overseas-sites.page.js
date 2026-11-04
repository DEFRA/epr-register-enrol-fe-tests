import { Page } from 'page-objects/page'
import { withInterimSiteDisclosure } from 'page-objects/interim-site-disclosure.mixin'

// RA-425: the read-only "Manage overseas reprocessing sites" page for an
// exporter's current accreditation. GOV.UK tabs split the ORSs into
// Accredited and Registered; each ORS row carries the shared, read-only
// "Show interim sites (n)" disclosure.
//
// The row selectors take the tab's name ('accredited' or 'registered') and
// the ORS's own site id, so a spec reads only the sites it knows about.
class ManageOverseasSitesPage extends withInterimSiteDisclosure(Page) {
  get backLink() {
    return $('[data-testid="back-link"]')
  }

  get returnToHomeLink() {
    return $('[data-testid="return-to-home-link"]')
  }

  tab(name) {
    return $(`[data-testid="${name}-sites-tab"]`)
  }

  panel(name) {
    return $(`[data-testid="${name}-sites-panel"]`)
  }

  siteRow(name, siteId) {
    return $(`[data-testid="${name}-site-row-${siteId}"]`)
  }

  siteOrsId(name, siteId) {
    return $(`[data-testid="${name}-site-orsid-${siteId}"]`)
  }

  siteName(name, siteId) {
    return $(`[data-testid="${name}-site-name-${siteId}"]`)
  }

  siteAddress(name, siteId) {
    return $(`[data-testid="${name}-site-address-${siteId}"]`)
  }

  // GOV.UK tabs switch panels client-side, without a page load.
  async openTab(name) {
    const tab = this.tab(name)
    await tab.waitForDisplayed()
    await tab.click()
    await this.panel(name).waitForDisplayed({
      timeoutMsg: `The ${name} tab's panel did not show`
    })
  }

  async returnToHome() {
    await this.clickAndWaitForNextPage(this.returnToHomeLink)
  }

  async goBack() {
    await this.clickAndWaitForNextPage(this.backLink)
  }
}

export default new ManageOverseasSitesPage()
