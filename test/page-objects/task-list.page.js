import { $, $$ } from '@wdio/globals'
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

  get saveAndComeBackLink() {
    return $('[data-testid="save-come-back-link"]')
  }

  get continueButton() {
    return $('[data-testid="continue-button"]')
  }

  get taskList() {
    return $('[data-testid="task-list"]')
  }

  get metadataYear() {
    return $('[data-testid="metadata-year"]')
  }

  get metadataSite() {
    return $('[data-testid="metadata-site"]')
  }

  get prnsTask() {
    return $('[data-testid="task-prns"]')
  }

  get prnsLink() {
    return $('[data-testid="task-prns-link"]')
  }

  get prnsTag() {
    return $('[data-testid="task-prns-tag"]')
  }

  get businessPlanTask() {
    return $('[data-testid="task-business-plan"]')
  }

  get businessPlanLink() {
    return $('[data-testid="task-business-plan-link"]')
  }

  get businessPlanTag() {
    return $('[data-testid="task-business-plan-tag"]')
  }

  get samplingPlanTask() {
    return $('[data-testid="task-sampling-plan"]')
  }

  get samplingPlanLink() {
    return $('[data-testid="task-sampling-plan-link"]')
  }

  get samplingPlanTag() {
    return $('[data-testid="task-sampling-plan-tag"]')
  }

  get errorSummary() {
    return $('[data-testid="error-summary"]')
  }
}

export default new TaskListPage()
