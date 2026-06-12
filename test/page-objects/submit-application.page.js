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

  get emailInput() {
    return $('#email')
  }

  get submitApplicationButton() {
    return $('button=Submit application')
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

  randomEmail(name) {
    const slug = name.toLowerCase().replace(/\s+/g, '.')
    return `${slug}.${Date.now()}@stub.example`
  }

  async submitApplication() {
    const name = this.randomFullName()
    const title = this.randomJobTitle()
    const email = this.randomEmail(name)
    await this.fullNameInput.waitForDisplayed()
    await this.fullNameInput.setValue(name)
    await this.jobTitleInput.setValue(title)
    await this.emailInput.setValue(email)
    await this.submitApplicationButton.scrollIntoView()
    await this.submitApplicationButton.click()
  }
}

export default new SubmitApplicationPage()
