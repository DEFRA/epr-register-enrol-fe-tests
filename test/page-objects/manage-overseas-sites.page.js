import { Page } from 'page-objects/page'
import { withInterimSiteDisclosure } from 'page-objects/interim-site-disclosure.mixin'

// RA-425: the "Manage overseas reprocessing sites" page for an exporter's
// current accreditation. GOV.UK tabs split the ORSs into Accredited and
// Registered; each ORS row carries the shared, read-only "Show interim sites
// (n)" disclosure.
//
// The row selectors take the tab's name ('accredited' or 'registered') and
// the ORS's own site id, so a spec reads only the sites it knows about.
//
// RA-492 adds the in-year change request to it: an "Add to accreditation"
// button on each registered site not yet in a request, a status tag (and, for
// the in-progress request, a "View" link) on each site that is, and banners
// for the in-progress and submitted requests. Its row selectors take the site
// id too.
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

  // RA-492 (f12): shown while the in-progress request has sites in it.
  get requestsBanner() {
    return $('[data-testid="requests-banner"]')
  }

  get viewRequestsLink() {
    return $('[data-testid="view-requests-link"]')
  }

  // RA-492 AC09: shown once a request is Submitted and awaiting the regulator.
  get pendingChangeBanner() {
    return $('[data-testid="pending-change-banner"]')
  }

  // On a registered site: "In progress" while it is in the in-progress
  // request, "Pending" once that request is submitted.
  siteStatusTag(siteId) {
    return $(`[data-testid="site-status-tag-${siteId}"]`)
  }

  // A link-styled button in a POST form: it adds the registered site to the
  // in-progress request and redirects to that site's add-to-accreditation
  // summary.
  addToAccreditationButton(siteId) {
    return $(`[data-testid="add-to-accreditation-${siteId}"]`)
  }

  // Replaces the add button on a registered site already in the in-progress
  // request.
  viewRequestLink(siteId) {
    return $(`[data-testid="view-request-${siteId}"]`)
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

  async addToAccreditation(siteId) {
    await this.openTab('registered')
    await this.clickAndWaitForNextPage(this.addToAccreditationButton(siteId))
  }

  async viewRequests() {
    await this.clickAndWaitForNextPage(this.viewRequestsLink)
  }

  async goBack() {
    await this.clickAndWaitForNextPage(this.backLink)
  }
}

export default new ManageOverseasSitesPage()
