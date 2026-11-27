import { Page } from 'page-objects/page'
import { withInterimSiteDisclosure } from 'page-objects/interim-site-disclosure.mixin'

// RA-425: the "Manage overseas reprocessing sites" page for an exporter's
// current accreditation (or, since RA-697, its registration only). RA-814:
// one table of every ORS - Site name, Status and Actions - ordered by ORS ID,
// ten to a page. Each row is tagged Approved (on the accreditation) or
// Registered, and carries the shared, read-only "Interim sites (n)"
// disclosure when the ORS has interim sites.
//
// The row selectors take the ORS's own site id, so a spec reads only the
// sites it knows about.
//
// Paging: no org the specs use reaches a second page. The seeds give org
// 50018 four ORSs, 50019 six (one never registered, so not listed) and 50021
// four, and no spec adds an ORS to any of them: they only move registered
// sites onto the accreditation. So every site is on page 1, and paging is
// covered by the frontend's page tests instead. A spec that takes an org past
// ten sites would need this page object to follow the pagination to find a
// site.
//
// RA-492 adds the in-year change request to it: an "Add to accreditation"
// button on each registered site not yet in a request, a status tag (and, for
// the in-progress request, a "View change requests" link) on each site that
// is, and banners for the in-progress and submitted requests.
class ManageOverseasSitesPage extends withInterimSiteDisclosure(Page) {
  get backLink() {
    return $('[data-testid="back-link"]')
  }

  get returnToHomeLink() {
    return $('[data-testid="return-to-home-link"]')
  }

  get intro() {
    return $('[data-testid="overseas-sites-intro"]')
  }

  get table() {
    return $('[data-testid="overseas-sites-table"]')
  }

  // "Showing {start}-{end} of {total}", above the table.
  get countLine() {
    return $('[data-testid="overseas-sites-count"]')
  }

  get pagination() {
    return $('[data-testid="overseas-sites-pagination"]')
  }

  // Shown instead of the table when the operator has no ORSs at all.
  get emptyMessage() {
    return $('[data-testid="overseas-sites-empty"]')
  }

  // RA-814 replaced the Approved and Registered tabs with the one table, so
  // any GOV.UK tabs on the page would mean they are back.
  get anyTabs() {
    return $('.govuk-tabs')
  }

  // The visible text of each element, in page order.
  async texts(elements) {
    const texts = []
    for (const element of [...(await elements)]) {
      texts.push(await element.getText())
    }
    return texts
  }

  async columnHeadings() {
    return this.texts(this.table.$$('thead th'))
  }

  siteRow(siteId) {
    return $(`[data-testid="site-row-${siteId}"]`)
  }

  siteOrsId(siteId) {
    return $(`[data-testid="site-orsid-${siteId}"]`)
  }

  siteName(siteId) {
    return $(`[data-testid="site-name-${siteId}"]`)
  }

  siteAddress(siteId) {
    return $(`[data-testid="site-address-${siteId}"]`)
  }

  // "Approved" (green) or "Registered" (grey).
  orsStatusTag(siteId) {
    return $(`[data-testid="ors-status-tag-${siteId}"]`)
  }

  siteActionsCell(siteId) {
    return $(`[data-testid="site-actions-${siteId}"]`)
  }

  // The ORS ids of the rows on this page, in page order. Read from each row's
  // own ORS id cell, so interim sites are never counted.
  async rowOrsIds() {
    return this.texts(this.table.$$('[data-testid^="site-orsid-"]'))
  }

  // The visible text of every link and button in the page's main content,
  // to check that no control the page must not offer has crept in.
  async controlTexts() {
    return this.texts($$('main a, main button'))
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

  // RA-697: a registration-only exporter has none on any site.
  get anyAddToAccreditationButton() {
    return $('[data-testid^="add-to-accreditation-"]')
  }

  // "View change requests": beside the "In progress" tag on a registered site
  // already in the in-progress request, in place of the add button.
  viewRequestLink(siteId) {
    return $(`[data-testid="view-request-${siteId}"]`)
  }

  // RA-682: an approved ORS's Change link, to its details page.
  changeSiteLink(siteId) {
    return $(`[data-testid="change-site-${siteId}"]`)
  }

  // A site already in the draft shows "In progress" and View instead; both
  // open its details page.
  async changeSite(siteId) {
    const change = this.changeSiteLink(siteId)
    const view = $(`[data-testid="view-request-${siteId}"]`)
    await browser.waitUntil(
      async () => (await change.isExisting()) || (await view.isExisting()),
      { timeoutMsg: `Approved site ${siteId} has neither Change nor View` }
    )
    await this.clickAndWaitForNextPage(
      (await change.isExisting()) ? change : view
    )
  }

  async addToAccreditation(siteId) {
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
