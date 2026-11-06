import { Page } from 'page-objects/page'

async function textsOf(elements) {
  const texts = []
  for (const element of [...elements]) {
    texts.push(await element.getText())
  }
  return texts
}

// RA-697: "In year change requests", every change item (an ORS or a tonnage
// band upgrade) against one current accreditation, most urgent status first,
// at {manage page}/change-requests.
class ChangeRequestsPage extends Page {
  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get backLink() {
    return $('[data-testid="back-link"]')
  }

  get table() {
    return $('[data-testid="change-requests-table"]')
  }

  get statusTags() {
    return $$('[data-testid^="change-request-status-"]')
  }

  get typeCells() {
    return $$('[data-testid^="change-request-type-"]')
  }

  get countLine() {
    return $('[data-testid="change-requests-count"]')
  }

  get pagination() {
    return $('.govuk-pagination')
  }

  get nextPageLink() {
    return $('.govuk-pagination a[rel="next"]')
  }

  get noResultsTitle() {
    return $('[data-testid="no-results-title"]')
  }

  get noResultsBody() {
    return $('[data-testid="no-results-body"]')
  }

  get statusFilter() {
    return $('[data-testid="status-filter"]')
  }

  get typeFilter() {
    return $('[data-testid="type-filter"]')
  }

  get viewLinks() {
    return $$('[data-testid^="change-request-view-"]')
  }

  get clearFiltersLink() {
    return $('[data-testid="clear-filters-link"]')
  }

  async statusTexts() {
    return textsOf(await this.statusTags)
  }

  async typeTexts() {
    return textsOf(await this.typeCells)
  }
}

export default new ChangeRequestsPage()
