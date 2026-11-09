import { Page } from 'page-objects/page'

// "Change determination deadline": sets a new date the determination is due
// by, with a reason. Reached from the work item's "Change determination
// deadline" action; the route is still /sla/extend.
class CmChangeDeadlinePage extends Page {
  get reasonInput() {
    return $('#field-reason')
  }

  get dayInput() {
    return $('#new-deadline-day')
  }

  get monthInput() {
    return $('#new-deadline-month')
  }

  get yearInput() {
    return $('#new-deadline-year')
  }

  get submitButton() {
    return $('[data-testid="sla-extend-submit"]')
  }

  async changeDeadline(date, reason) {
    await this.reasonInput.waitForDisplayed({ timeout: 30000 })
    await this.reasonInput.setValue(reason)
    await this.dayInput.setValue(String(date.getDate()))
    await this.monthInput.setValue(String(date.getMonth() + 1))
    await this.yearInput.setValue(String(date.getFullYear()))
    await this.clickReliably(this.submitButton)
  }
}

export default new CmChangeDeadlinePage()
