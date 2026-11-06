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

  // Read-only: no Change, Remove or Add links, and no buttons or forms.
  get actions() {
    return $$('main .govuk-summary-list__actions, main button, main form')
  }
}

export default new ChangeRequestDetailPage()
