import { browser, expect } from '@wdio/globals'

import RegulatorPage from 'page-objects/regulator.page'
import WorkListItemsPage from 'page-objects/worklistitems.page'
import OrgListPage from 'page-objects/orglist.page'

describe('Regulator Page', () => {
  it('Should be able to action a work item', async () => {
    await RegulatorPage.open()
    let headerText = await RegulatorPage.pageHeading.getText()
    let bodyText = await RegulatorPage.pageText.getText()
    await expect(browser).toHaveTitle('Regulator | epr-register-enrol-frontend')
    await expect(headerText).toEqual('Regulator')
    await expect(bodyText).toEqual('Regulator lanidng page')
    await RegulatorPage.navigateToWorkItems()

    headerText = await WorkListItemsPage.pageHeading.getText()
    bodyText = await WorkListItemsPage.pageText.getText()
    await expect(browser).toHaveTitle(
      'Worklist Items | epr-register-enrol-frontend'
    )
    await expect(headerText).toEqual('Worklist Items')
    await expect(bodyText).toEqual('Regulator Work Item List')
  })

  it('Should be able to search and select an organisation', async () => {
    await RegulatorPage.open()
    let headerText = await RegulatorPage.pageHeading.getText()
    let bodyText = await RegulatorPage.pageText.getText()
    await expect(browser).toHaveTitle('Regulator | epr-register-enrol-frontend')
    await expect(headerText).toEqual('Regulator')
    await expect(bodyText).toEqual('Regulator landing page')
    await RegulatorPage.navigateToOrgLists()

    headerText = await OrgListPage.pageHeading.getText()
    bodyText = await OrgListPage.pageText.getText()
    await expect(browser).toHaveTitle(
      'Organisation List | epr-register-enrol-frontend'
    )
    await expect(headerText).toEqual('Organisation List')
    await expect(bodyText).toEqual('regulator organisation list')
  })
})
