import { Page } from 'page-objects/page'

class WorklistItemsPage extends Page {
  open() {
    return super.open('/worklist-items')
  }
}

export default new WorklistItemsPage()
