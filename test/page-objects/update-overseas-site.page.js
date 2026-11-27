import {
  enterAutocompleteValue,
  waitForAutocomplete
} from 'page-objects/accessible-autocomplete'
import { Page } from 'page-objects/page'

// RA-682: changing an accredited ORS's details, at
// .../manage-overseas-sites/{applicationId}/update/{siteId}: its details page
// (Figma screens 3 and 5), the steps behind its Change links, and the interim
// site form. Locked fields have no Change link, and on the location step are
// read-only inputs.
class UpdateOverseasSitePage extends Page {
  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get statusTag() {
    return $('[data-testid="site-status-tag"]')
  }

  get successBanner() {
    return $('[data-testid="success-banner"]')
  }

  get pendingInset() {
    return $('[data-testid="pending-inset"]')
  }

  // AC06: the confirmation after a request with nothing to pay, at
  // .../manage-overseas-sites/{applicationId}/submitted.
  get submittedPanel() {
    return $('[data-testid="submitted-panel"]')
  }

  get submittedReferences() {
    return $$('[data-testid="submitted-reference"]')
  }

  get submittedReference() {
    return $('[data-testid="submitted-reference"]')
  }

  get submittedNext() {
    return $('[data-testid="submitted-next"]')
  }

  get interimRows() {
    return $('[data-testid="interim-sites"]').$$('.govuk-summary-list__row')
  }

  rowValue(id) {
    return $(`[data-testid="row-${id}-value"]`)
  }

  rowAction(id) {
    return $(`[data-testid="row-${id}-action"]`)
  }

  interimLine(key) {
    return $(`[data-testid="${key}-line"]`)
  }

  interimState(key) {
    return $(`[data-testid="${key}-state"]`)
  }

  input(name) {
    return $(`[data-testid="${name}-input"]`)
  }

  async openRowAction(id) {
    await this.clickAndWaitForNextPage(this.rowAction(id))
  }

  async fill(values) {
    for (const [name, value] of Object.entries(values)) {
      const input = this.input(name)
      await input.waitForDisplayed()
      await input.setValue(value)
    }
  }

  async continue() {
    await this.clickAndWaitForNextPage($('[data-testid="continue-button"]'))
  }

  async changeInterim(key) {
    await this.clickAndWaitForNextPage($(`[data-testid="${key}-change"]`))
  }

  async removeInterim(key) {
    await this.clickAndWaitForNextPage($(`[data-testid="${key}-remove"]`))
  }

  async undoInterim(key) {
    await this.clickAndWaitForNextPage($(`[data-testid="${key}-undo"]`))
  }

  async newInterimSite({ siteName, country, codes }) {
    await this.clickAndWaitForNextPage($('[data-testid="add-interim-site"]'))
    await this.fill({
      siteName,
      addressLine1: '7 Depot Road',
      townOrCity: 'Port',
      contactName: 'Sam Lee',
      contactEmail: 'sam.lee@example.com',
      contactPhone: '0123456789'
    })
    const countryInput = $('#country')
    await waitForAutocomplete(countryInput, { label: 'Country field' })
    await enterAutocompleteValue(countryInput, country)
    for (const code of codes) {
      // GOV.UK checkbox inputs are visually hidden behind their label.
      await this.clickReliably($(`label[for="operation-${code}"]`))
    }
    await this.continue()
  }

  async saveAndContinue() {
    await this.clickAndWaitForNextPage($('[data-testid="save-and-continue"]'))
  }
}

export default new UpdateOverseasSitePage()
