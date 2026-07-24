import { Page } from 'page-objects/page'

class QueryTaskListPage extends Page {
  open(appId) {
    return super.open(`/accreditation/query-task-list/${appId}`)
  }

  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get queryNote() {
    return $('[data-testid="query-note"]')
  }

  get taskList() {
    return $('[data-testid="query-task-list"]')
  }

  get taskItems() {
    return $$('[data-testid="query-task-list"] .govuk-task-list__item')
  }

  get continueButton() {
    return $('[data-testid="continue-button"]')
  }

  taskLink(testId) {
    return $(`[data-testid="${testId}-link"]`)
  }

  taskTag(testId) {
    return $(`[data-testid="${testId}-tag"]`)
  }

  async continueToDeclaration() {
    await this.continueButton.waitForDisplayed()
    await this.continueButton.scrollIntoView()
    await this.continueButton.click()
  }
}

export default new QueryTaskListPage()
