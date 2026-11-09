import { Page } from 'page-objects/page'
import { enterGovukDate } from 'page-objects/govuk-date-input'

// "Change determination deadline": sets a new date the determination is due
// by, with a reason. Reached from the work item's "Change determination
// deadline" action; the route is still /sla/extend.
class CmChangeDeadlinePage extends Page {
  get reasonInput() {
    return $('#field-reason')
  }

  get submitButton() {
    return $('[data-testid="sla-extend-submit"]')
  }

  async changeDeadline(date, reason) {
    await this.reasonInput.waitForDisplayed({ timeout: 30000 })
    await this.reasonInput.setValue(reason)
    await enterGovukDate('new-deadline', date)
    await this.clickReliably(this.submitButton)
  }
}

export default new CmChangeDeadlinePage()
