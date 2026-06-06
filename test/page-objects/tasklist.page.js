import { Page } from 'page-objects/page'

class TaskListPage extends Page {
  open(appId) {
    return super.open(`/accreditation/task-list/${appId}`)
  }

  get forYear() {
    return $('[data-testid="metadata-year"]')
  }

  get forProcessingSite() {
    return $('[data-testid="metadata-site"]')
  }

  get PRNTagStatus() {
    return $('[data-testid="task-prns-tag"]')
  }

  get businessPlanStatus() {
    return $('[data-testid="task-business-plan-tag"]')
  }

  get SIPlanStatus() {
    return $('[data-testid="task-sampling-plan-tag"]')
  }

  get PRNTonnageLink() {
    return $('[data-testid="task-prns-link"]')
  }

  get businessPlanLink() {
    return $('[data-testid="task-business-plan-link"]')
  }

  get SIPlanLink() {
    return $('[data-testid="task-sampling-plan-link"]')
  }

  get continueButton() {
    return $('[data-testid="continue-button"]')
  }

  async assertAllTasksCompleted() {
    await expect(this.PRNTagStatus).toHaveText('COMPLETED')
    await expect(this.businessPlanStatus).toHaveText('COMPLETED')
    await expect(this.SIPlanStatus).toHaveText('COMPLETED')
  }

  async continueToSubmit() {
    await this.continueButton.waitForDisplayed()
    await this.continueButton.scrollIntoView()
    await this.continueButton.click()
  }
}

export default new TaskListPage()
