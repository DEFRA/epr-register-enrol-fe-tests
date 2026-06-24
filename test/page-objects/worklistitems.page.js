import { Page } from 'page-objects/page'

class WorklistItemsPage extends Page {
  open() {
    return super.open('/worklist-items')
  }

  get pageHeading() {
    return $('h1')
  }

  get workItems() {
    return $$('[data-testid="app-page-body"] ul li')
  }

  async getWorkItemsCount() {
    const items = await this.workItems
    return items.length
  }
}

export default new WorklistItemsPage()
