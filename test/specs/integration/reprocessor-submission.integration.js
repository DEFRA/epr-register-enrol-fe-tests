import { expect } from '@wdio/globals'
import TaskListPage from 'page-objects/tasklist.page'

import { createAccessibilityAudit } from '../../helpers/accessibility.js'
import { hasSeededOrganisation } from '../../helpers/integration-organisation/index.js'
import {
  seededRegistrations,
  startFirstApplicableAccreditation
} from '../../helpers/integration-organisation/seeded-accreditation-journey.js'
import {
  completeOutstandingTasks,
  submitAndAssertConfirmation
} from '../../helpers/reex-reaccreditation.js'
import { accreditationYear } from '../../config.js'

// Test environment scenario 1: on the organisation seeded for the run, the
// operator applies for reprocessor accreditation for aluminium (or, once
// aluminium has been applied for, the next reprocessor material that has not),
// completes every task and submits.
//
// Each page is also checked for accessibility as the journey reaches it. A
// violation does not stop the journey: they are collected and reported by the
// last test.
describe(`Reprocessor accreditation ${accreditationYear} - test environment`, () => {
  const audit = createAccessibilityAudit()
  const checkPage = (pageName) => audit.check(pageName)

  before(function () {
    if (!hasSeededOrganisation()) {
      this.skip()
    }
  })

  it('Should complete every task and submit a reprocessor application', async () => {
    const { registration } = await startFirstApplicableAccreditation(
      seededRegistrations('reprocessor', ['aluminium'])
    )
    expect(registration.wasteProcessingType).toBe('reprocessor')

    const material = await completeOutstandingTasks({
      isExporter: false,
      checkPage
    })
    await TaskListPage.assertAllTasksCompleted({ isExporter: false })
    await TaskListPage.continueToSubmit()

    await submitAndAssertConfirmation(material, { checkPage })
  })

  it('Should have no accessibility violations on the pages of the journey', () => {
    expect(audit.checkedPages.length).toBeGreaterThan(0)
    audit.assertNoViolations()
  })
})
