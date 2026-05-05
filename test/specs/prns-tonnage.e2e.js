import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import MaterialSelectionPage from 'page-objects/material-selection.page'
import TaskListPage from 'page-objects/task-list.page'
import PrnsTonnagePage from 'page-objects/prns-tonnage.page'
import { browser } from '@wdio/globals'

describe('PRNs Tonnage Page (RA-105 / Acc0003)', () => {
  before(async () => {
    await LoginPage.open()
    await LoginPage.switchToOperator()
    await LoginPage.loginAsUser()
    await OperatorPage.open()
    await OperatorPage.navigateToOperatorAccreditation()
    await MaterialSelectionPage.open()
    await MaterialSelectionPage.selectMaterial('aluminium')
    await MaterialSelectionPage.continueButton.click()
    // After material selection, server redirects to task list hub
  })

  after(async () => {
    await LoginPage.signOut()
  })

  async function getApplicationIdFromUrl() {
    const url = await browser.getUrl()
    const match = url.match(/task-list\/([^/]+)/)
    return match ? match[1] : null
  }

  describe('Task List Hub links to PRNs tonnage page', () => {
    it('PRNs task row renders a clickable link to the PRNs tonnage page', async () => {
      await expect(TaskListPage.prnsTaskLink).toBeDisplayed()
      const href = await TaskListPage.prnsTaskLink.getAttribute('href')
      await expect(href).toContain('/accreditation/prns-tonnage/')
    })

    it('PRNs task row shows NOT STARTED status initially', async () => {
      const statusText = await TaskListPage.prnsTaskStatus.getText()
      await expect(statusText).toEqual('NOT STARTED')
    })
  })

  describe('PRNs tonnage page', () => {
    before(async () => {
      await TaskListPage.prnsTaskLink.click()
    })

    it('displays the page heading with material type', async () => {
      const heading = await PrnsTonnagePage.pageHeading.getText()
      await expect(heading).toContain('PRNs do you plan to issue?')
    })

    it('back link navigates to the task list hub', async () => {
      const href = await PrnsTonnagePage.backLink.getAttribute('href')
      await expect(href).toContain('/accreditation/task-list/')
    })

    it('renders all four tonnage radio options', async () => {
      await expect(PrnsTonnagePage.radioOption('upto500')).toBeDisplayed()
      await expect(PrnsTonnagePage.radioOption('upto1000')).toBeDisplayed()
      await expect(PrnsTonnagePage.radioOption('upto10000')).toBeDisplayed()
      await expect(PrnsTonnagePage.radioOption('over10000')).toBeDisplayed()
    })

    it('shows validation error when no selection is made', async () => {
      await PrnsTonnagePage.continueButton.click()
      await expect(PrnsTonnagePage.errorSummary).toBeDisplayed()
      const errorText = await PrnsTonnagePage.errorSummary.getText()
      await expect(errorText).toContain('Select how many PRNs you plan to issue')
    })
  })

  describe('Save and come back later sets PRNs task to IN PROGRESS', () => {
    it('saves selection and returns to task list showing IN PROGRESS', async () => {
      await PrnsTonnagePage.saveAndComeLater('upto500')
      const statusText = await TaskListPage.prnsTaskStatus.getText()
      await expect(statusText).toEqual('IN PROGRESS')
    })
  })

  describe('Pre-population on return', () => {
    it('pre-selects the previously saved tonnage band on revisit', async () => {
      await TaskListPage.prnsTaskLink.click()
      const radio = PrnsTonnagePage.radioOption('upto500')
      const checked = await radio.getAttribute('checked')
      await expect(checked).not.toBeNull()
    })
  })

  describe('Save and continue navigates to next page', () => {
    it('valid selection proceeds to the authority to issue PRNs page (Acc0004)', async () => {
      await PrnsTonnagePage.saveAndContinue('upto1000')
      const url = await browser.getUrl()
      await expect(url).toContain('/accreditation/prns-authority/')
    })
  })
})
