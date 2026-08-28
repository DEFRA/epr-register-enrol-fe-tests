import { Page } from 'page-objects/page'

class ConfirmOverseasSitesPage extends Page {
  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  changeLink(siteId) {
    return $(`[data-testid="change-link-${siteId}"]`)
  }

  async changeSite(siteId) {
    const link = this.changeLink(siteId)
    await link.waitForDisplayed()
    await link.scrollIntoView()
    await link.click()
  }

  // RA-486: interim sites are now shown on this review page too (only for
  // sites with selected !== false), nested under their linked ORS row
  // (keyed by the ORS's own siteId — 1 ORS : 0-or-1 interim site, no
  // separate index needed). Only a Change link here (this is the final
  // read-through-and-confirm page); Remove stays on select-overseas-sites,
  // same as for ORS rows themselves. Unlike the equivalent link on
  // select-overseas-sites (which re-enters the edit wizard directly),
  // both this page's Change links — the main site row's and the interim
  // site's — point at the shared backLink target
  // (/accreditation/select-overseas-sites/{applicationId}), matching this
  // page's existing pattern as a pre-confirm summary rather than a
  // management page.
  interimSiteRow(siteId) {
    return $(`[data-testid="interim-site-row-${siteId}"]`)
  }

  interimSiteNameValue(siteId) {
    return $(`[data-testid="interim-site-name-${siteId}"]`)
  }

  changeInterimSiteLink(siteId) {
    return $(`[data-testid="change-interim-site-${siteId}"]`)
  }

  async changeInterimSite(siteId) {
    const link = this.changeInterimSiteLink(siteId)
    await link.waitForDisplayed()
    await link.scrollIntoView()
    await link.click()
  }

  get confirmAndContinueButton() {
    return $('[data-testid="confirm-button"]')
  }

  async confirmAndContinue() {
    await this.clickReliably(this.confirmAndContinueButton)
  }
}

export default new ConfirmOverseasSitesPage()
