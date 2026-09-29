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

  async submitResubmission({ fullName, role } = {}) {
    const name = fullName ?? this.randomFullName()
    const jobRole = role ?? 'Compliance Officer'

    await this.fullNameInput.waitForDisplayed()
    await this.fullNameInput.setValue(name)
    await this.roleInput.setValue(jobRole)
    await this.clickReliably(this.resubmitButton)
  }

  async clickResubmit() {
    await this.clickReliably(this.resubmitButton)
  }
}

export default new QueryDeclarationPage()
