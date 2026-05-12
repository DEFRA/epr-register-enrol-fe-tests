import { Page } from 'page-objects/page'

class SubmitApplicationPage extends Page {
  get pageHeading() {
    return $('h1')
  }

  get fullNameInput() {
    return $('[name="fullName"]')
  }

  get jobTitleInput() {
    return $('[name="jobTitle"]')
  }

  get submitApplicationButton() {
    return $('button=Submit application')
  }

  async submitApplication(fullName, jobTitle) {
    await this.fullNameInput.waitForDisplayed()
    await this.fullNameInput.setValue(fullName)
    await this.jobTitleInput.setValue(jobTitle)
    await this.submitApplicationButton.scrollIntoView()
    await this.submitApplicationButton.click()
  }
}

export default new SubmitApplicationPage()
