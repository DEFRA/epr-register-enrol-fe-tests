import { Page } from 'page-objects/page'

class SubmitApplicationPage extends Page {
  get pageHeading() {
    return $('h1')
  }

  get eligiblePersonBullet() {
    return $('[data-testid="declaration-bullet-0"]')
  }

  get fullNameInput() {
    return $('[name="fullName"]')
  }

  get jobTitleInput() {
    return $('[name="jobTitle"]')
  }

  get submitApplicationButton() {
    return $('[data-testid="submit-button"]')
  }

  get saveAndComeBackLaterButton() {
    return $('[data-testid="save-come-back-button"]')
  }

  get errorSummary() {
    return $('[data-testid="error-summary"]')
  }

  get fullNameError() {
    return $('[data-testid="full-name-error"]')
  }

  get jobTitleError() {
    return $('[data-testid="job-title-error"]')
  }

  randomFullName() {
    const names = [
      'Alice Johnson',
      'Bob Williams',
      'Carol Davies',
      'David Evans',
      'Eve Thompson',
      'Frank Harris',
      'Grace Martin',
      'Henry Clarke'
    ]
    return names[Math.floor(Math.random() * names.length)]
  }

  randomJobTitle() {
    const titles = [
      'Environmental Manager',
      'Compliance Officer',
      'Operations Director',
      'Sustainability Lead',
      'Waste Management Specialist',
      'Site Manager'
    ]
    return titles[Math.floor(Math.random() * titles.length)]
  }

  // Submits whatever is in the form, without filling it in first.
  async confirmAndSubmit() {
    await this.clickAndWaitForNextPage(this.submitApplicationButton)
  }

  async saveAndComeBackLater() {
    await this.clickAndWaitForNextPage(this.saveAndComeBackLaterButton)
  }

  async submitApplication() {
    const name = this.randomFullName()
    const title = this.randomJobTitle()
    await this.fullNameInput.waitForDisplayed()
    await this.fullNameInput.setValue(name)
    await this.jobTitleInput.setValue(title)
    await this.clickReliably(this.submitApplicationButton)
  }
}

export default new SubmitApplicationPage()
