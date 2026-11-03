import { browser, expect } from '@wdio/globals'
import { Page } from 'page-objects/page'

// "Confirm applicant contact" — the second step of the two-step determination
// (RA-527). Making the determination leaves the work item Approved, pending
// contact; ticking the box here once the applicant has been told applies it,
// and the work item moves to Granted.
class CmConfirmContactPage extends Page {
  get form() {
    return $('[data-testid="confirm-contact-form"]')
  }

  get contactedCheckbox() {
    return $('[data-testid="confirm-contact-checkbox"]')
  }

  get submitButton() {
    return $('[data-testid="confirm-contact-submit"]')
  }

  async confirmContacted() {
    await this.form.waitForDisplayed({ timeout: 30000 })
    await browser.execute((el) => el.click(), await this.contactedCheckbox)
    // Confirming applies the decision, which cannot be undone, so the box is
    // checked rather than assumed before the form is submitted.
    await expect(this.contactedCheckbox).toBeSelected()
    await this.clickReliably(this.submitButton)
  }
}

export default new CmConfirmContactPage()
