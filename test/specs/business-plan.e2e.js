import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import MaterialSelectionPage from 'page-objects/material-selection.page'
import TaskListPage from 'page-objects/task-list.page'
import PrnsTonnagePage from 'page-objects/prns-tonnage.page'
import PrnsAuthorityPage from 'page-objects/prns-authority.page'
import PrnsCyaPage from 'page-objects/prns-cya.page'
import BusinessPlanPage from 'page-objects/business-plan.page'
import BusinessPlanDetailPage from 'page-objects/business-plan-detail.page'
import BusinessPlanCyaPage from 'page-objects/business-plan-cya.page'

describe('RA-108/109/110: Business Plan journey', () => {
  before(async () => {
    await LoginPage.open()
    await LoginPage.switchToOperator()
    await LoginPage.loginAsUser()
    await OperatorPage.open()
    await OperatorPage.navigateToOperatorAccreditation()
    await MaterialSelectionPage.open()
    await MaterialSelectionPage.selectMaterial('aluminium')
    await MaterialSelectionPage.continueButton.click()
    // Complete PRNs so Business Plan task is unlocked
    await TaskListPage.prnsTaskLink.click()
    await PrnsTonnagePage.saveAndContinue('upto1000')
    await PrnsAuthorityPage.addAuthoriser(
      'Test Authoriser',
      'authoriser@example.com'
    )
    await PrnsAuthorityPage.saveAndContinue(['authoriser@example.com'])
    await PrnsCyaPage.confirmButton.click()
    // Now on task list with PRNs COMPLETED — navigate into Business Plan
    await TaskListPage.businessPlanTaskLink.click()
  })

  after(async () => {
    await LoginPage.signOut()
  })

  describe('RA-108: Business Plan page', () => {
    describe('Page renders correctly', () => {
      it('displays the page heading', async () => {
        const heading = await BusinessPlanPage.pageHeading.getText()
        await expect(heading).toContain('Business plan')
      })

      it('displays intro text', async () => {
        await expect(BusinessPlanPage.introText).toBeDisplayed()
      })

      it('back link navigates to task list', async () => {
        const href = await BusinessPlanPage.backLink.getAttribute('href')
        await expect(href).toContain('/accreditation/task-list/')
      })
    })

    describe('Validation', () => {
      it('shows error when submitted empty', async () => {
        await BusinessPlanPage.continueButton.click()
        await expect(BusinessPlanPage.errorSummary).toBeDisplayed()
      })

      it('shows error when percentages do not sum to 100', async () => {
        await BusinessPlanPage.fillPercentages({
          newInfrastructurePercent: '10',
          priceSupportPercent: '10',
          businessCollectionsPercent: '10',
          communicationsPercent: '10',
          newMarketsPercent: '10',
          newUsesPercent: '10'
        })
        await BusinessPlanPage.continueButton.click()
        await expect(BusinessPlanPage.errorSummary).toBeDisplayed()
        const errorText = await BusinessPlanPage.errorSummary.getText()
        await expect(errorText).toContain('100')
      })
    })

    describe('Save and come back later', () => {
      it('saves and returns to task list showing IN PROGRESS', async () => {
        await BusinessPlanPage.fillEvenSplit()
        await BusinessPlanPage.saveAndComeBackButton.click()
        const url = await browser.getUrl()
        await expect(url).toContain('/accreditation/task-list/')
        const statusText = await TaskListPage.businessPlanTaskStatus.getText()
        await expect(statusText).toEqual('IN PROGRESS')
      })
    })

    describe('Save and continue', () => {
      it('proceeds to business plan detail page', async () => {
        await TaskListPage.businessPlanTaskLink.click()
        await BusinessPlanPage.fillEvenSplit()
        await BusinessPlanPage.continueButton.click()
        const url = await browser.getUrl()
        await expect(url).toContain('/accreditation/business-plan-detail/')
      })
    })
  })

  describe('RA-109: Business Plan Detail page', () => {
    describe('Page renders correctly', () => {
      it('displays the page heading', async () => {
        const heading = await BusinessPlanDetailPage.pageHeading.getText()
        await expect(heading).toContain(
          "More detail about how you'll spend PRN income"
        )
      })

      it('displays intro text', async () => {
        await expect(BusinessPlanDetailPage.introText).toBeDisplayed()
      })

      it('back link navigates to business plan page', async () => {
        const href = await BusinessPlanDetailPage.backLink.getAttribute('href')
        await expect(href).toContain('/accreditation/business-plan/')
      })
    })

    describe('Save and come back later', () => {
      it('saves and returns to task list', async () => {
        await BusinessPlanDetailPage.saveAndComeBackButton.click()
        const url = await browser.getUrl()
        await expect(url).toContain('/accreditation/task-list/')
      })
    })

    describe('Save and continue', () => {
      it('proceeds to business plan check your answers page', async () => {
        await TaskListPage.businessPlanTaskLink.click()
        await BusinessPlanDetailPage.continueButton.click()
        const url = await browser.getUrl()
        await expect(url).toContain('/accreditation/business-plan-cya/')
      })
    })
  })

  describe('RA-110: Business Plan Check Your Answers page', () => {
    describe('Page renders correctly', () => {
      it('displays the check your answers heading', async () => {
        const heading = await BusinessPlanCyaPage.pageHeading.getText()
        await expect(heading).toContain('Check your answers before continuing')
      })

      it('displays the business plan sub-heading', async () => {
        const subHeading = await BusinessPlanCyaPage.subHeading.getText()
        await expect(subHeading).toContain('Business plan')
      })

      it('back link navigates to task list', async () => {
        const href = await BusinessPlanCyaPage.backLink.getAttribute('href')
        await expect(href).toContain('/accreditation/task-list/')
      })
    })

    describe('Summary list content', () => {
      it('shows percent summary list', async () => {
        await expect(BusinessPlanCyaPage.percentSummaryList).toBeDisplayed()
      })

      it('shows percentage values for all fields', async () => {
        const value = await BusinessPlanCyaPage.percentValue(
          'newInfrastructurePercent'
        ).getText()
        await expect(value).toContain('%')
      })

      it('change percent link includes fromCYA param', async () => {
        const href = await BusinessPlanCyaPage.changePercentLink(
          'newInfrastructurePercent'
        ).getAttribute('href')
        await expect(href).toContain('/accreditation/business-plan/')
        await expect(href).toContain('fromCYA=true')
      })

      it('change detail link includes fromCYA param', async () => {
        const href = await BusinessPlanCyaPage.changeDetailLink(
          'newInfrastructureDetail'
        ).getAttribute('href')
        await expect(href).toContain('/accreditation/business-plan-detail/')
        await expect(href).toContain('fromCYA=true')
      })
    })

    describe('Confirm marks Business Plan section COMPLETED', () => {
      it('navigates to task list with COMPLETED status after confirm', async () => {
        await BusinessPlanCyaPage.confirmButton.click()
        const url = await browser.getUrl()
        await expect(url).toContain('/accreditation/task-list/')
        const statusText = await TaskListPage.businessPlanTaskStatus.getText()
        await expect(statusText).toEqual('COMPLETED')
      })
    })
  })
})
