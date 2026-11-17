import { browser, expect } from '@wdio/globals'
import { Page } from 'page-objects/page'

// "Make determination for this application" — the final, irreversible decision
// on a re-accreditation or add-ORS work item.
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
    await this.decide(this.approvedRadio, { note })
  }

  // RA-495: refusing, as an add-ORS application can be.
  async refuse({ note } = {}) {
    await this.decide(this.refusedRadio, { note })
  }

  async decide(radio, { note } = {}) {
    await radio.waitForExist({ timeout: 30000 })
    await browser.execute((el) => el.click(), await radio)
    // The determination cannot be changed afterwards, so the radio is checked
    // rather than assumed before the form is submitted.
    await expect(radio).toBeSelected()

    if (note) {
      await this.noteInput.setValue(note)
    }
    await this.clickReliably(this.submitButton)
  }
}

export default new CmDecisionPage()
