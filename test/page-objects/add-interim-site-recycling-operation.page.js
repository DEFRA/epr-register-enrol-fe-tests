import { Page } from 'page-objects/page'

// RA-486: new step in the add-interim-site wizard, slotted between
// site-contact-details and check-your-answers. Modelled directly on
// add-ors-recycling-operation.page.js (same njk structure, same testids/id
// pattern) but with mandatory/optional inverted — here R12/R13 is the
// mandatory "core" pair and R3/R4/R5 is optional. The material itself is
// inherited from the parent ORS, not asked again on this page.
class AddInterimSiteRecyclingOperationPage extends Page {
  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get errorSummary() {
    return $('[data-testid="error-summary"]')
  }

  get backLink() {
    return $('[data-testid="back-link"]')
  }

  get cancelLink() {
    return $('[data-testid="cancel-link"]')
  }

  get continueButton() {
    return $('[data-testid="continue-button"]')
  }

  async selectOperationCode(code) {
    const operationInput = $(`#recycling-operation-code-${code.toLowerCase()}`)
    const operationLabel = $(
      `label[for="recycling-operation-code-${code.toLowerCase()}"]`
    )
    await operationLabel.waitForDisplayed()
    if (await operationInput.isSelected()) {
      return
    }
    await operationLabel.click()
  }

  async selectOperationCodes(codes) {
    for (const code of codes) {
      await this.selectOperationCode(code)
    }
  }

  async continue() {
    await this.continueButton.waitForDisplayed()
    await this.continueButton.click()
  }
}

export default new AddInterimSiteRecyclingOperationPage()
