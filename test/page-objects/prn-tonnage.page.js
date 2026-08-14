import { Page } from 'page-objects/page'

class PrnTonnagePage extends Page {
  open(appId) {
    return super.open(`/accreditation/tonnage/${appId}`)
  }

  get pageHeading() {
    return $('h1')
  }

  get radioLabels() {
    return $$('.govuk-radios__label')
  }

  get radioInputs() {
    return $$('.govuk-radios__input')
  }

  get queryNote() {
    return $('[data-testid="query-note"]')
  }

  get saveAndContinueButton() {
    return $('button=Save and continue')
  }

  async selectRandomOption() {
    const labels = await this.radioLabels
    const inputs = await this.radioInputs
    const randomIndex = Math.floor(Math.random() * labels.length)
    const label = labels[randomIndex]
    const input = inputs[randomIndex]

    await label.waitForDisplayed()
    await label.scrollIntoView()
    await label.click()

    // The label click occasionally doesn't register in headless Chrome
    // (WebDriver "move target out of bounds" retries can land off-target),
    // leaving no band selected and the subsequent submit failing server-side
    // validation silently. Force the underlying radio if the click missed.
    if (!(await input.isSelected())) {
      await browser.execute((el) => {
        el.checked = true
        el.dispatchEvent(new Event('change', { bubbles: true }))
      }, input)
    }

    return label.getText()
  }

  async saveAndContinue() {
    await this.saveAndContinueButton.scrollIntoView()
    await this.saveAndContinueButton.click()
  }
}

export default new PrnTonnagePage()
