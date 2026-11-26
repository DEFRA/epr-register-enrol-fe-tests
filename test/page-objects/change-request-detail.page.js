import { Page } from 'page-objects/page'

// RA-697: the read-only detail page for one change item, at
// {manage page}/change-requests/{itemId}.
class ChangeRequestDetailPage extends Page {
  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get backLink() {
    return $('[data-testid="back-link"]')
  }

  get statusTag() {
    return $('[data-testid="header-status"]')
  }

  // An ORS item's header: the location, ORS id, date added and BES expiry
  // date shown alongside the status.
  get headerLocation() {
    return $('[data-testid="header-location"]')
  }

  get headerSiteId() {
    return $('[data-testid="header-site-id"]')
  }

  get headerDateAdded() {
    return $('[data-testid="header-date-added"]')
  }

  get headerBesExpiry() {
    return $('[data-testid="header-bes-expiry"]')
  }

  get queryRaisedBanner() {
    return $('[data-testid="query-raised-banner"]')
  }

  get siteSummary() {
    return $('[data-testid="site-summary"]')
  }

  get tonnageSummary() {
    return $('[data-testid="tonnage-summary"]')
  }

  // A summary row's label and value, by row id (site-name, location,
  // recycling-operation, bes-evidence, requested-band and so on).
  rowLabel(id) {
    return $(`[data-testid="row-${id}-label"]`)
  }

  rowValue(id) {
    return $(`[data-testid="row-${id}-value"]`)
  }

  // A tonnage band upgrade's "Tonnage band" row.
  get requestedBandLabel() {
    return this.rowLabel('requested-band')
  }

  get requestedBand() {
    return this.rowValue('requested-band')
  }

  get interimSitesHeading() {
    return $('[data-testid="interim-sites-heading"]')
  }

  get interimSiteRows() {
    return $$('[data-testid="interim-sites"] [data-testid^="interim-site-"]')
  }

  get noInterimSites() {
    return $('[data-testid="no-interim-sites"]')
  }

  interimSite(siteId) {
    return $(`[data-testid="interim-site-${siteId}"]`)
  }

  get requestType() {
    return $('[data-testid="request-type"]')
  }

  get requestSent() {
    return $('[data-testid="request-sent"]')
  }

  get requestSubmittedBy() {
    return $('[data-testid="request-submitted-by"]')
  }

  get requestValidFrom() {
    return $('[data-testid="request-valid-from"]')
  }

  get requestValidTo() {
    return $('[data-testid="request-valid-to"]')
  }

  get requestReference() {
    return $('[data-testid="request-reference"]')
  }

  // RA-698: a Queried item's page. It shows the regulator's note, a Change (or,
  // for BES evidence, Upload) link on each field the query leaves open, a
  // Change link on each interim site, and Save and continue to the declaration.
  get queryNote() {
    return $('[data-testid="query-note"]')
  }

  get successBanner() {
    return $('[data-testid="success-banner"]')
  }

  // The problem a refused declaration returns to the page with.
  get errorSummary() {
    return $('[data-testid="error-summary"]')
  }

  get saveAndContinueButton() {
    return $('[data-testid="save-and-continue-button"]')
  }

  get cancelLink() {
    return $('[data-testid="cancel-link"]')
  }

  // The row's Change (or Upload) link, which only an open field has.
  rowAction(id) {
    return $(`[data-testid="row-${id}-action"]`)
  }

  // The ids of the rows with a Change or Upload link, top to bottom.
  async rowIdsWithActions() {
    const links = await $$('[data-testid^="row-"][data-testid$="-action"]')
    const ids = []
    for (const link of [...links]) {
      const testId = await link.getAttribute('data-testid')
      ids.push(testId.slice('row-'.length, -'-action'.length))
    }
    return ids
  }

  interimChangeLink(siteId) {
    return $(`[data-testid="change-interim-site-${siteId}"]`)
  }

  get interimChangeLinks() {
    return $$('[data-testid^="change-interim-site-"]')
  }

  // An interim site's own summary page, at {item page}/interim-sites/{siteId}:
  // the ORS summary's layout, with a Change link (change-{row id}) on each
  // field the query leaves open, and Continue back to the ORS.
  get interimSiteSummary() {
    return $('[data-testid="interim-site-summary"]')
  }

  interimRowChange(id) {
    return $(`[data-testid="change-${id}"]`)
  }

  get interimChangeActions() {
    return $$('[data-testid="interim-site-summary"] a[data-testid^="change-"]')
  }

  get continueButton() {
    return $('[data-testid="continue-button"]')
  }

  // Follows an ORS row's Change or Upload link to the page that changes it.
  async changeRow(id) {
    await this.clickAndWaitForNextPage(this.rowAction(id))
  }

  async changeInterimSite(siteId) {
    await this.clickAndWaitForNextPage(this.interimChangeLink(siteId))
  }

  async changeInterimRow(id) {
    await this.clickAndWaitForNextPage(this.interimRowChange(id))
  }

  async saveAndContinue() {
    await this.clickAndWaitForNextPage(this.saveAndContinueButton)
  }

  async continueToOrs() {
    await this.clickAndWaitForNextPage(this.continueButton)
  }

  // Read-only: no Change, Remove or Add links, and no buttons or forms.
  get controls() {
    return $$('main button, main form')
  }

  get actions() {
    return $$('main .govuk-summary-list__actions, main button, main form')
  }
}

export default new ChangeRequestDetailPage()
