import { Page } from 'page-objects/page'
import { enterGovukDate } from 'page-objects/govuk-date-input'

// "Change valid from date" (RA-800): replaces the valid from date an add-ORS
// approval recorded, with a reason, while the work item awaits "Confirm
// applicant contact". Reached from the work item's "Change valid from date"
// link, which is gone once the applicant contact is confirmed.
class CmChangeValidFromPage extends Page {
  get link() {
    return $('[data-testid="change-valid-from-link"]')
  }

  get reasonInput() {
    return $('#reason')
  }

  get saveButton() {
    return $('[data-testid="change-valid-from-submit"]')
  }

  async startChangeValidFromDate() {
    await this.clickReliably(this.link)
  }

  // The date input has the same ids as Make determination's.
  async changeValidFromDate(date, reason) {
    await enterGovukDate('effective-date', date)
    await this.reasonInput.setValue(reason)
    await this.clickReliably(this.saveButton)
  }
}

export default new CmChangeValidFromPage()
