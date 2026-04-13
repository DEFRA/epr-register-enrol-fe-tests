import { browser, expect } from '@wdio/globals'

import LoginPage from 'page-objects/login.page'
import RegulatorPage from 'page-objects/regulator.page'
import WorkListItemsPage from 'page-objects/worklistitems.page'
import OrgListPage from 'page-objects/orglist.page'

const expectedWorkListItems = [
  {
    taskWithRegId: 'Re-Accreditation for Registration ID:EN2712300000001',
    orgDetails: 'Glass Recycling Export Import Company : 087654321',
    status: 'Status: New',
    dateOfApplication: 'Date of Application: 2026-04-01Z15:00:00',
    material: 'Material: Glass',
    risk: 'Risk: low',
    role: 'Role: Exporter',
    assignedTo: 'Assigned To: Reginald Regulator'
  },
  {
    taskWithRegId: 'Re-Accreditation for Registration ID:EN2712300000002',
    orgDetails: 'Metal and Metal (UK) Ltd : 023456789',
    status: 'Status: In-progress',
    dateOfApplication: 'Date of Application: 2026-03-04Z11:03:12',
    material: 'Material: Metal',
    risk: 'Risk: medium',
    role: 'Role: Reprocessor',
    assignedTo: 'Assigned To: Ironman'
  }
]

describe('Regulator Page', () => {
  beforeEach(async () => {
    await LoginPage.open()
    await expect(LoginPage.pageHeading).toHaveText('Select a regulator user')
    await LoginPage.loginAsUser()
  })

  afterEach(async () => {
    await LoginPage.signOut()
  })

  it('Should be able to action a work item', async () => {
    await RegulatorPage.open()
    let headerText = await RegulatorPage.pageHeading.getText()
    let bodyText = await RegulatorPage.pageText.getText()
    await RegulatorPage.navigateToWorkItems()

    headerText = await WorkListItemsPage.pageHeading.getText()
    bodyText = await WorkListItemsPage.pageText.getText()
    await expect(browser).toHaveTitle(
      'Worklist Items | epr-register-enrol-frontend'
    )
    await expect(headerText).toEqual('Worklist Items')
    await expect(bodyText).toEqual('Worklist Items')
    const workListItems = await WorkListItemsPage.getWorkItemsLists()

    await expect(workListItems).toHaveLength(expectedWorkListItems.length)
    for (const [index, workItem] of workListItems.entries()) {
      const children = await workItem.$$('*')
      const texts = (
        await Promise.all([...children].map((child) => child.getText()))
      )
        .filter((text) => typeof text === 'string' && text.trim() !== '')
        .flatMap((text) => text.split('\n'))

      const actual = {
        taskWithRegId: texts[0],
        orgDetails: texts[1],
        status: texts[2],
        dateOfApplication: texts[3],
        material: texts[4],
        risk: texts[5],
        role: texts[6],
        assignedTo: texts[7]
      }
      await expect(actual).toEqual(expectedWorkListItems[index])
    }
  })

  it('Should be able to search and select an organisation', async () => {
    await RegulatorPage.open()
    let headerText = await RegulatorPage.pageHeading.getText()
    let bodyText = await RegulatorPage.pageText.getText()
    await expect(browser).toHaveTitle('Regulator | epr-register-enrol-frontend')
    await expect(headerText).toEqual('Regulator Landing Page')
    await expect(bodyText).toEqual('Regulator')
    await RegulatorPage.navigateToOrgLists()

    headerText = await OrgListPage.pageHeading.getText()
    bodyText = await OrgListPage.pageText.getText()
    await expect(browser).toHaveTitle(
      'Organisation List | epr-register-enrol-frontend'
    )
    await expect(headerText).toEqual('Organisation List')
    await expect(bodyText).toEqual('Organisation List')
  })
})
