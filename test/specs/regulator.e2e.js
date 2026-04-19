import { browser, expect } from '@wdio/globals'

import HomePage from 'page-objects/home.page'
import LoginPage from 'page-objects/login.page'
import RegulatorPage from 'page-objects/regulator.page'
import WorkListItemsPage from 'page-objects/worklistitems.page'
import OrgListPage from 'page-objects/orglist.page'
import OrgDetailsPage from 'page-objects/orgdetails.page'
import {
  expectedWorkListItems,
  expectedOrgSummary
} from '../data/regulator.data.js'

describe('Regulator Journey', () => {
  beforeEach(async () => {
    await LoginPage.open()
    await expect(LoginPage.pageHeading).toHaveText('Select a regulator user')
    await LoginPage.loginAsUser()
  })

  afterEach(async () => {
    await LoginPage.signOut()
  })

  it('Should be able to action a work item', async () => {
    await HomePage.regulatorLink.click()
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
    await HomePage.regulatorLink.click()
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
    await expect(OrgListPage.pageBody).toExist()
    const links = await OrgListPage.orgLinks
    await expect(links[0]).toBeDisplayed()
    await links[0].click()

    await expect(OrgDetailsPage.pageHeading).toBeDisplayed()
    await expect(OrgDetailsPage.pageBody).toExist()
    const orgDetails = await OrgDetailsPage.orgDetailsList
    for (const item of orgDetails) {
      await expect(item).toBeDisplayed()
    }

    const actualSummary = await OrgDetailsPage.getSummaryItems()
    await expect(actualSummary).toEqual(expectedOrgSummary)
  })
})
