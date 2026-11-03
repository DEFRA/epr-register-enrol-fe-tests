import { browser } from '@wdio/globals'
import { Page } from 'page-objects/page'

// RA-492: the in-year "Manage overseas reprocessing sites" page for a GRANTED
// accreditation (/accreditation/manage-overseas-sites/{applicationId}),
// reached from the material landing's manage-overseas-sites-link. Not to be
// confused with overseas-reprocessing-sites.page.js, which is the
// select-overseas-sites step of an accreditation APPLICATION.
//
// Rows are keyed by the ORS id shown in the UI (e.g. "007"), not the numeric
// siteId the add/{siteId} routes use.
class ManageOverseasSitesPage extends Page {
  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  open(applicationId) {
    return super.open(`/accreditation/manage-overseas-sites/${applicationId}`)
  }

  get accreditedTab() {
    return $('[data-testid="tab-accredited"]')
  }

  get registeredTab() {
    return $('[data-testid="tab-registered"]')
  }

  get accreditedSites() {
    return $('[data-testid="accredited-sites"]')
  }

  get registeredSites() {
    return $('[data-testid="registered-sites"]')
  }

  // f12: shown while In progress requests exist that have not been submitted.
  get requestsBanner() {
    return $('[data-testid="requests-banner"]')
  }

  get viewRequestsLink() {
    return $('[data-testid="view-requests-link"]')
  }

  // AC09: shown once a request is Submitted and awaiting the regulator.
  get pendingChangeBanner() {
    return $('[data-testid="pending-change-banner"]')
  }

  accreditedSiteRow(orsId) {
    return $(`[data-testid="accredited-site-${orsId}"]`)
  }

  registeredSiteRow(orsId) {
    return $(`[data-testid="registered-site-${orsId}"]`)
  }

  siteStatusTag(orsId) {
    return $(`[data-testid="site-status-tag-${orsId}"]`)
  }

  // A link-styled button in a POST form: it adds the site to the in-progress
  // request and redirects to that site's add-to-accreditation summary.
  addToAccreditationLink(orsId) {
    return $(`[data-testid="add-to-accreditation-${orsId}"]`)
  }

  // Replaces addToAccreditationLink on a registered row already in the
  // in-progress request.
  viewRequestLink(orsId) {
    return $(`[data-testid="view-request-${orsId}"]`)
  }

  // GOV.UK tabs only hide the inactive panel with JS; select the tab so the
  // registered rows are displayed before anything waits on or clicks them.
  async showRegisteredTab() {
    await this.registeredTab.waitForDisplayed()
    await this.registeredTab.click()
    await this.registeredSites.waitForDisplayed()
  }

  async showAccreditedTab() {
    await this.accreditedTab.waitForDisplayed()
    await this.accreditedTab.click()
    await this.accreditedSites.waitForDisplayed()
  }

  async addToAccreditation(orsId) {
    await this.showRegisteredTab()
    await this.clickAndWaitForNextPage(this.addToAccreditationLink(orsId))
  }

  // The manage page's {applicationId} is the granted accreditation's, read
  // from the URL the landing link lands on.
  async applicationIdFromUrl() {
    const { pathname } = new URL(await browser.getUrl())
    return pathname.split('/').filter(Boolean)[2]
  }
}

export default new ManageOverseasSitesPage()
