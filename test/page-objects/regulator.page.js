import { Page } from 'page-objects/page'

class Regulatorpage extends Page {
  open() {
    return super.open('/regulator')
  }

  get pageHeading() {
    return $('h1')
  }

  async navigateToWorkItems() {
    const link = await $('=Worklist Items')
    await link.waitForDisplayed()
    await link.click()
  }

  async navigateToOrgLists() {
    const link = await $('=Organisation List')
    await link.waitForDisplayed()
    await link.click()
  }
}

export default new Regulatorpage()
