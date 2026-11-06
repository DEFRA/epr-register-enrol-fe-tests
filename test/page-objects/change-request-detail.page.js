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

  get queryRaisedBanner() {
    return $('[data-testid="query-raised-banner"]')
  }

  get requestType() {
    return $('[data-testid="request-type"]')
  }

  get requestValidFrom() {
    return $('[data-testid="request-valid-from"]')
  }

  get requestValidTo() {
    return $('[data-testid="request-valid-to"]')
  }

  // Read-only: no Change, Remove or Add links, and no buttons or forms.
  get actions() {
    return $$('main .govuk-summary-list__actions, main button, main form')
  }
}

export default new ChangeRequestDetailPage()
