import { Page } from 'page-objects/page'

class QueryDeclarationPage extends Page {
  open(appId) {
    return super.open(`/accreditation/query-declaration/${appId}`)
  }

  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get fullNameInput() {
    return $('[data-testid="full-name-input"]')
  }

  get emailInput() {
    return $('[data-testid="email-input"]')
  }

  get roleInput() {
    return $('[data-testid="role-input"]')
  }

  get resubmitButton() {
    return $('[data-testid="resubmit-button"]')
  }

  get errorSummary() {
    return $('[data-testid="error-summary"]')
  }

  get fullNameError() {
    return $('[data-testid="full-name-error"]')
  }

  get emailError() {
    return $('[data-testid="email-error"]')
  }

  get roleError() {
    return $('[data-testid="role-error"]')
  }

  randomFullName() {
    const names = [
      'Priya Sharma',
      'Tom Baker',
      'Fatima Khan',
      'Liam Connor',
      'Sofia Rossi'
    ]
    return names[Math.floor(Math.random() * names.length)]
  }

  randomEmail(name) {
    const slug = name.toLowerCase().replace(/\s+/g, '.')
    return `${slug}.${Date.now()}@stub.example`
  }

  async submitResubmission({ fullName, email, role } = {}) {
    const name = fullName ?? this.randomFullName()
    const emailAddress = email ?? this.randomEmail(name)
    const jobRole = role ?? 'Compliance Officer'

    await this.fullNameInput.waitForDisplayed()
    await this.fullNameInput.setValue(name)
    await this.emailInput.setValue(emailAddress)
    await this.roleInput.setValue(jobRole)
    await this.resubmitButton.scrollIntoView()
    await this.resubmitButton.click()
  }

  async clickResubmit() {
    await this.resubmitButton.waitForDisplayed()
    await this.resubmitButton.scrollIntoView()
    await this.resubmitButton.click()
  }
}

export default new QueryDeclarationPage()
