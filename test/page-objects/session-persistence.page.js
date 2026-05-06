import { $ } from '@wdio/globals'
import { Page } from 'page-objects/page'

class SessionPersistencePage extends Page {
  openMaterialSelection() {
    return super.open('/accreditation/material-selection')
  }

  openTaskList(applicationId) {
    return super.open(`/accreditation/task-list/${applicationId}`)
  }

  openBusinessPlan(applicationId) {
    return super.open(`/accreditation/business-plan/${applicationId}`)
  }

  get pageHeading() {
    return $('h1')
  }

  get errorSummary() {
    return $('.govuk-error-summary')
  }

  get steelRadio() {
    return $('input[value="Steel"]')
  }

  get continueButton() {
    return $('[data-testid="continue-button"]')
  }

  get saveAndComeLaterButton() {
    return $('[data-testid="save-and-come-back-button"]')
  }

  get newInfrastructureInput() {
    return $('#newInfrastructurePercent')
  }

  get priceSupportInput() {
    return $('#priceSupportPercent')
  }

  get businessCollectionsInput() {
    return $('#businessCollectionsPercent')
  }

  get communicationsInput() {
    return $('#communicationsPercent')
  }

  get newMarketsInput() {
    return $('#newMarketsPercent')
  }

  get newUsesInput() {
    return $('#newUsesPercent')
  }

  async fillBusinessPlanPercentages(values = {}) {
    const defaults = {
      newInfrastructure: '20',
      priceSupport: '20',
      businessCollections: '20',
      communications: '20',
      newMarkets: '10',
      newUses: '10'
    }
    const v = { ...defaults, ...values }
    await this.newInfrastructureInput.setValue(v.newInfrastructure)
    await this.priceSupportInput.setValue(v.priceSupport)
    await this.businessCollectionsInput.setValue(v.businessCollections)
    await this.communicationsInput.setValue(v.communications)
    await this.newMarketsInput.setValue(v.newMarkets)
    await this.newUsesInput.setValue(v.newUses)
  }
}

export default new SessionPersistencePage()
