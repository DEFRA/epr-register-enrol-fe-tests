import { Page } from 'page-objects/page'

class WithdrawApplicationPage extends Page {
  open(appId) {
    return super.open(`/accreditation/withdraw-application/${appId}`)
  }

  get pageHeading() {
    return $('h1')
  }

  get warningText() {
    return $('[data-testid="warning-text"]')
  }

  get confirmYesRadio() {
    return $('[data-testid="confirm-withdraw-yes"]')
  }

  get confirmNoRadio() {
    return $('[data-testid="confirm-withdraw-no"]')
  }

  get reasonInput() {
    return $('[data-testid="reason-input"]')
  }

  get reasonCounterMessage() {
    return $('#reason-info')
  }

  get submitButton() {
    return $('[data-testid="withdraw-submit-button"]')
  }

  get errorSummary() {
    return $('[data-testid="error-summary"]')
  }

  get confirmWithdrawError() {
    return $('[data-testid="error-summary"] a[href="#confirmWithdraw"]')
  }

  get reasonError() {
    return $('[data-testid="error-summary"] a[href="#reason"]')
  }

  get errorMessage() {
    return $('[data-testid="error-message"]')
  }

  async selectYes() {
    await this.clickReliably(this.confirmYesRadio)
  }

  async selectNo() {
    await this.clickReliably(this.confirmNoRadio)
  }

  async submit() {
    await this.clickReliably(this.submitButton)
  }

  async withdrawWithReason(reason) {
    await this.selectYes()
    await this.reasonInput.waitForDisplayed()
    await this.reasonInput.setValue(reason)
    await this.submit()
  }
}

export default new WithdrawApplicationPage()
