import { browser, expect } from '@wdio/globals'
import { Page } from 'page-objects/page'

// Today's UK calendar date as yyyy-MM-dd: never before a request submitted today.
export function ukToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(
    new Date()
  )
}

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

  // effectiveDate (yyyy-MM-dd) is entered when the page asks for one; today's
  // UK date when not given.
  async approve({ note, effectiveDate = ukToday() } = {}) {
    await this.decide(this.approvedRadio, { note, effectiveDate })
  }

  // RA-495: refusing, as an add-ORS application can be.
  async refuse({ note } = {}) {
    await this.decide(this.refusedRadio, { note })
  }

  async decide(radio, { note, effectiveDate } = {}) {
    await radio.waitForExist({ timeout: 30000 })
    await browser.execute((el) => el.click(), await radio)
    // The determination cannot be changed afterwards, so the radio is checked
    // rather than assumed before the form is submitted.
    await expect(radio).toBeSelected()

    if (effectiveDate && (await this.effectiveDateGroup.isExisting())) {
      await this.setEffectiveDate(effectiveDate)
    }
    if (note) {
      await this.noteInput.setValue(note)
    }
    await this.clickReliably(this.submitButton)
  }

  async setEffectiveDate(isoDate) {
    const [year, month, day] = isoDate.split('-').map(Number)
    await $('#effective-date-day').setValue(String(day))
    await $('#effective-date-month').setValue(String(month))
    await $('#effective-date-year').setValue(String(year))
  }
}

export default new CmDecisionPage()
