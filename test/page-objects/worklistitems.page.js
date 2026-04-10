import { Page } from 'page-objects/page'

class WorklistItemsPage extends Page {
  open() {
    return super.open('/worklist-items')
  }

  async getWorkItemsLists() {
    return $$('[data-testid="app-page-body"] ul li')
  }

  async getWorkItemDetails(workItem) {
    const children = await workItem.$$('*')
    let output = ''
    for (const child of children) {
      const tag = await child.getTagName()
      const text = await child.getText()
      output = tag + '\n' + text
    }
    return output
  }

  async getWorkItemsList(index) {
    return this.getWorkItemsLists().get(index).get()
  }
}

export default new WorklistItemsPage()
