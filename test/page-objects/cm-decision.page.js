import { browser, expect } from '@wdio/globals'
import { Page } from 'page-objects/page'

// "Make determination for this application" — the final, irreversible decision
// on a re-accreditation work item.
class CmDecisionPage extends Page {
  get approvedRadio() {
    return $('[data-testid="decision-approved"]')
  }

  get refusedRadio() {
    return $('[data-testid="decision-refused"]')
  }

  get noteInput() {
    return $('[data-testid="log-decision-note"]')
  }

  get submitButton() {
    return $('[data-testid="log-decision-submit"]')
  }

  async approve({ note } = {}) {
    await this.approvedRadio.waitForExist({ timeout: 30000 })
    await browser.execute((el) => el.click(), await this.approvedRadio)
    // The determination cannot be changed afterwards, so the radio is checked
    // rather than assumed before the form is submitted.
    await expect(this.approvedRadio).toBeSelected()

    if (note) {
      await this.noteInput.setValue(note)
    }
    await this.clickReliably(this.submitButton)
  }
}

export default new CmDecisionPage()
