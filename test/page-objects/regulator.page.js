import { Page } from 'page-objects/page'

class Regulatorpage extends Page {
  open() {
    return super.open('/regulator')
  }

  async getHeaderText() {
    return $('#main-content h1.govuk-heading-xl').getText()
  }

  async navigateToWorkItems() {
    await $('=Worklist Items').click()
  }

  async navigateToOrgLists() {
    await $('=Organisation List').click()
  }
}

export default new Regulatorpage()
