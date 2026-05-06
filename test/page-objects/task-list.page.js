import { $ } from '@wdio/globals'
import { Page } from 'page-objects/page'

class TaskListPage extends Page {
  open(applicationId) {
    return super.open(`/accreditation/task-list/${applicationId}`)
  }

  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get backLink() {
    return $('[data-testid="back-link"]')
  }

  get taskList() {
    return $('[data-testid="task-list"]')
  }

  get prnsTaskLink() {
    return $('[data-testid="task-prns-link"]')
  }

  get prnsTaskStatus() {
    return $('[data-testid="task-prns-tag"]')
  }

  get businessPlanTaskLink() {
    return $('[data-testid="task-business-plan-link"]')
  }

  get businessPlanTaskStatus() {
    return $('[data-testid="task-business-plan-tag"]')
  }

  get samplingPlanTaskStatus() {
    return $('[data-testid="task-sampling-plan-tag"]')
  }
}

export default new TaskListPage()
