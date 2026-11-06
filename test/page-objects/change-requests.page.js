import { Page } from 'page-objects/page'

async function textsOf(elements) {
  const texts = []
  for (const element of [...elements]) {
    texts.push(await element.getText())
  }
  return texts
}

const ROW_TEST_ID_PREFIX = 'change-request-row-'

// RA-697: "In year change requests", every change item (an ORS or a tonnage
// band upgrade) against one current accreditation, most urgent status first,
// at {manage page}/change-requests. Each row's test ids end with its item id.
class ChangeRequestsPage extends Page {
  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get backLink() {
    return $('[data-testid="back-link"]')
  }

  get returnToHomeLink() {
    return $('[data-testid="return-to-home-link"]')
  }

  get table() {
    return $('[data-testid="change-requests-table"]')
  }

  get rows() {
    return $$(`[data-testid^="${ROW_TEST_ID_PREFIX}"]`)
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

  get previousPageLink() {
    return $('.govuk-pagination a[rel="prev"]')
  }

  get currentPageNumber() {
    return $('.govuk-pagination__item--current')
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

  row(itemId) {
    return $(`[data-testid="${ROW_TEST_ID_PREFIX}${itemId}"]`)
  }

  siteName(itemId) {
    return $(`[data-testid="change-request-site-name-${itemId}"]`)
  }

  siteAddress(itemId) {
    return $(`[data-testid="change-request-site-address-${itemId}"]`)
  }

  type(itemId) {
    return $(`[data-testid="change-request-type-${itemId}"]`)
  }

  status(itemId) {
    return $(`[data-testid="change-request-status-${itemId}"]`)
  }

  viewLink(itemId) {
    return $(`[data-testid="change-request-view-${itemId}"]`)
  }

  // The item ids of the rows on this page, top to bottom.
  async rowItemIds() {
    const ids = []
    for (const row of [...(await this.rows)]) {
      const testId = await row.getAttribute('data-testid')
      ids.push(testId.slice(ROW_TEST_ID_PREFIX.length))
    }
    return ids
  }

  // The visible text of each filter's selected option.
  async selectedFilterText(select) {
    return select.$('option:checked').getText()
  }

  // The visible text of each of a filter's options, placeholder first.
  async filterOptionTexts(select) {
    return textsOf(await select.$$('option'))
  }

  async statusTexts() {
    return textsOf(await this.statusTags)
  }

  async typeTexts() {
    return textsOf(await this.typeCells)
  }
}

export default new ChangeRequestsPage()
