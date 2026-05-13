import { Page } from 'page-objects/page'

class PrnAuthorityPage extends Page {
  open(appId) {
    return super.open(`/accreditation/prns-authority/${appId}`)
  }

  get pageHeading() {
    return $('h1')
  }

  get selectedTonnage() {
    return $('[data-testid="selected-tonnage"]')
  }

  get addNewAuthoriserLink() {
    return $('[data-testid="add-authoriser-toggle"]')
  }

  get authoriserNameInput() {
    return $('[data-testid="new-full-name-input"]')
  }

  get authoriserEmailInput() {
    return $('[data-testid="new-email-input"]')
  }

  get addAuthoriserSubmitButton() {
    return $('[data-testid="add-authoriser-button"]')
  }

  get saveAndContinueButton() {
    return $('button=Save and continue')
  }

  randomName() {
    const names = [
      'Alice Smith',
      'Bob Jones',
      'Carol White',
      'David Brown',
      'Eve Taylor'
    ]
    return names[Math.floor(Math.random() * names.length)]
  }

  randomEmail(name) {
    const slug = name.toLowerCase().replace(' ', '.')
    return `${slug}.${Date.now()}@stub.example`
  }

  async addAuthoriser() {
    await this.addNewAuthoriserLink.scrollIntoView()
    await this.addNewAuthoriserLink.click()

    const name = this.randomName()
    const email = this.randomEmail(name)

    await this.authoriserNameInput.waitForDisplayed()
    await this.authoriserNameInput.setValue(name)
    await this.authoriserEmailInput.setValue(email)
    await this.addAuthoriserSubmitButton.scrollIntoView()
    await this.addAuthoriserSubmitButton.click()
  }

  async saveAndContinue() {
    await this.saveAndContinueButton.scrollIntoView()
    await this.saveAndContinueButton.click()
  }
}

export default new PrnAuthorityPage()
