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

  get queryNote() {
    return $('[data-testid="query-note"]')
  }

  get saveAndContinueButton() {
    return $('button=Save and continue')
  }

  async selectRandomOption() {
    const labels = await this.radioLabels
    const randomIndex = Math.floor(Math.random() * labels.length)
    await labels[randomIndex].waitForDisplayed()
    await labels[randomIndex].scrollIntoView()
    await labels[randomIndex].click()
    return labels[randomIndex].getText()
  }

  async saveAndContinue() {
    await this.saveAndContinueButton.scrollIntoView()
    await this.saveAndContinueButton.click()
  }
}

export default new PrnTonnagePage()
