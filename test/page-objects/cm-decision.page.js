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

  // RA-495 AC6: an add-ORS approval names its effective date (re-accreditation's
  // page has no such field).
  get effectiveDateGroup() {
    return $('[data-testid="log-decision-effective-date-group"]')
  }

  async approve({ note } = {}) {
    await this.decide(this.approvedRadio, { note, withEffectiveDate: true })
  }

  // RA-495: refusing, as an add-ORS application can be.
  async refuse({ note } = {}) {
    await this.decide(this.refusedRadio, { note })
  }

  async decide(radio, { note, withEffectiveDate = false } = {}) {
    await radio.waitForExist({ timeout: 30000 })
    await browser.execute((el) => el.click(), await radio)
    // The determination cannot be changed afterwards, so the radio is checked
    // rather than assumed before the form is submitted.
    await expect(radio).toBeSelected()

    if (withEffectiveDate && (await this.effectiveDateGroup.isExisting())) {
      await this.setEffectiveDateToToday()
    }
    if (note) {
      await this.noteInput.setValue(note)
    }
    await this.clickReliably(this.submitButton)
  }

  // Today's UK date: never before the request's submission date.
  async setEffectiveDateToToday() {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        day: 'numeric',
        month: 'numeric',
        year: 'numeric'
      })
        .formatToParts(new Date())
        .map((part) => [part.type, part.value])
    )
    await $('#effective-date-day').setValue(parts.day)
    await $('#effective-date-month').setValue(parts.month)
    await $('#effective-date-year').setValue(parts.year)
  }
}

export default new CmDecisionPage()
