import { randomUUID } from 'node:crypto'

import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import {
  pushStatusChanged,
  waitForWorkItemId
} from '../helpers/case-management.js'
import { skipDockerOnlyOnDeployedEnvironment } from '../helpers/docker-only.js'
import { disposableYear } from '../helpers/disposable-year.js'
import { submitApplicationForYear } from '../helpers/accreditation-journey.js'
import {
  expectProblem,
  getCaseManagementStatusMapping,
  getLegacyApplicationStatuses
} from '../helpers/admin-api.js'
import {
  deleteApplication,
  insertApplicationWithoutStatus
} from '../helpers/sandbox-mongo.js'
import { nonAdminApiClient } from '../config.js'

/**
 * RA-751: Search Case management information (epic RA-639).
 *
 * The Admin UI's case management work item search shows, on each row, the
 * current status of the Legacy accreditation application the work item is
 * linked to, and flags when it differs from the status case management pushed.
 * It reads those statuses from the operator backend in one batch, through
 * GET /admin/accreditation-application-statuses, behind the admin-only service
 * client policy.
 *
 * What this proves end to end that the backend's unit tests do not: that the
 * work item id the backend stores when an operator submits through the real
 * frontend is the one the batch finds the application by, that the status it
 * answers is the live one (it follows a status case management pushes), and
 * that the route answers the signed admin client this stack registers
 * (docker/config/operator-be.env, docker/config/journey-tests.env) and refuses any other, and
 * that a linked application stored with no status fails the whole batch with a
 * 500 rather than being given one.
 *
 * Its application is a run-unique disposable year on org 50003 (Delta Green
 * Ltd, Plastic), as status-push.e2e.js uses, so no other spec sees it.
 */
describe('RA-751: Legacy application statuses for case management work items @docker-only', () => {
  before(function () {
    skipDockerOnlyOnDeployedEnvironment(this)
  })

  const NOT_A_GUID =
    'workItemId must each be a work item id, a GUID such as 3f2b8c1e-4d5a-4b6c-9e7f-0a1b2c3d4e5f.'

  describe('for a work item an operator submitted', () => {
    let organisationId
    let applicationId
    let workItemId

    before(async () => {
      await browser.deleteCookies()
      await LoginPage.open()
      await LoginPage.openOperatorLogin()
      await LoginPage.loginAsOperator()
      await OperatorPage.open()
      await OperatorPage.navigateToReaccreditationPlastic()
      ;({ organisationId, applicationId } =
        await submitApplicationForYear(disposableYear()))
      workItemId = await waitForWorkItemId(
        organisationId,
        applicationId,
        'look up the Legacy status of'
      )
    })

    after(async () => {
      await LoginPage.signOut()
    })

    it('gives each work item its Legacy application and current status, in request order', async () => {
      const unknownWorkItemId = randomUUID()

      const submitted = await getLegacyApplicationStatuses([
        unknownWorkItemId,
        workItemId
      ])

      expect(submitted.status).toBe(200)
      expect(submitted.body).toEqual({
        items: [
          {
            workItemId: unknownWorkItemId,
            found: false,
            applicationId: null,
            applicationStatus: null
          },
          {
            workItemId,
            found: true,
            applicationId,
            applicationStatus: 'Submitted'
          }
        ]
      })
    })

    it('finds a work item by its id in any case, and answers it in lower case', async () => {
      // Upper-casing only tests the match if the stored id has letters and is
      // lower case, so check that first.
      expect(workItemId).toMatch(/^[0-9a-f-]*[a-f][0-9a-f-]*$/)

      const upperCase = await getLegacyApplicationStatuses([
        workItemId.toUpperCase()
      ])

      expect(upperCase.status).toBe(200)
      expect(upperCase.body).toEqual({
        items: [
          {
            workItemId,
            found: true,
            applicationId,
            applicationStatus: 'Submitted'
          }
        ]
      })
    })

    it('follows a status case management pushes', async () => {
      await pushStatusChanged(organisationId, applicationId, {
        toStateId: 'duly-made',
        toStateDisplayName: 'Duly made',
        actionId: 'duly-made',
        actionDisplayName: 'Duly made',
        occurredAt: new Date().toISOString()
      })

      const dulyMade = await getLegacyApplicationStatuses([workItemId])

      expect(dulyMade.status).toBe(200)
      expect(dulyMade.body).toEqual({
        items: [
          {
            workItemId,
            found: true,
            applicationId,
            applicationStatus: 'DulyMade'
          }
        ]
      })
    })
  })

  describe('the case management status mapping', () => {
    it('lists the status each status push sets, and the status a query push sets', async () => {
      const mapping = await getCaseManagementStatusMapping()

      expect(mapping.status).toBe(200)
      // docs/openapi/admin-api.yaml in epr-register-enrol-backend; it gives
      // no order, so none is asserted.
      const documented = [
        { stateId: 'submitted', applicationStatus: 'Submitted' },
        { stateId: 'duly-made', applicationStatus: 'DulyMade' },
        { stateId: 'assessment-started', applicationStatus: 'DulyMade' },
        { stateId: 'assessment-in-progress', applicationStatus: 'Updated' },
        { stateId: 'updated', applicationStatus: 'Updated' },
        { stateId: 'awaiting-decision', applicationStatus: 'AwaitingDecision' },
        { stateId: 'approved', applicationStatus: 'Approved' },
        { stateId: 'rejected', applicationStatus: 'Rejected' }
      ]
      expect(mapping.body.statusPush).toHaveLength(documented.length)
      expect(mapping.body.statusPush).toEqual(
        expect.arrayContaining(documented)
      )
      expect(mapping.body.queryPush).toEqual({ applicationStatus: 'Queried' })
    })
  })

  describe('for work item ids it cannot look up', () => {
    it('answers 400 invalid_work_item_id when no work item id is given', async () => {
      expectProblem(
        await getLegacyApplicationStatuses([]),
        400,
        'invalid_work_item_id',
        'workItemId is required: give 1 to 50 work item ids, each as its own workItemId.'
      )
    })

    it('answers 400 invalid_work_item_id for an empty work item id', async () => {
      expectProblem(
        await getLegacyApplicationStatuses(['']),
        400,
        'invalid_work_item_id',
        NOT_A_GUID
      )
    })

    it('answers 400 invalid_work_item_id for a work item id that is not a GUID', async () => {
      expectProblem(
        await getLegacyApplicationStatuses([randomUUID(), 'not-a-guid']),
        400,
        'invalid_work_item_id',
        NOT_A_GUID
      )
    })

    it('answers 400 invalid_work_item_id when a work item id is repeated, in any case', async () => {
      const workItemId = randomUUID()
      expectProblem(
        await getLegacyApplicationStatuses([
          workItemId,
          workItemId.toUpperCase()
        ]),
        400,
        'invalid_work_item_id',
        `workItemId ${workItemId} is given more than once.`
      )
    })

    it('answers every one of 50 work item ids, and 400 invalid_work_item_id for 51', async () => {
      const fifty = Array.from({ length: 50 }, () => randomUUID())

      const answered = await getLegacyApplicationStatuses(fifty)

      expect(answered.status).toBe(200)
      expect(answered.body.items.map((item) => item.workItemId)).toEqual(fifty)
      expect(answered.body.items.every((item) => item.found === false)).toBe(
        true
      )

      expectProblem(
        await getLegacyApplicationStatuses([...fifty, randomUUID()]),
        400,
        'invalid_work_item_id',
        'workItemId may be given at most 50 times.'
      )
    })
  })

  describe('for a work item whose Legacy application has no status', () => {
    const workItemId = randomUUID()
    let applicationId

    before(async () => {
      // The frontend cannot store an application without a status, so the
      // document goes straight into the sandbox's MongoDB.
      applicationId = await insertApplicationWithoutStatus(workItemId)
    })

    after(async () => {
      await deleteApplication(applicationId)
    })

    it('answers 500 invalid_stored_application rather than guess a status', async () => {
      expectProblem(
        await getLegacyApplicationStatuses([randomUUID(), workItemId]),
        500,
        'invalid_stored_application',
        'A Legacy application linked to one of the work items has no status the service can read. Quote the traceId to the delivery team.'
      )
    })
  })

  describe('for a caller that is not the admin service client', () => {
    it('answers 401 missing_header to an unsigned request', async () => {
      expectProblem(
        await getLegacyApplicationStatuses([randomUUID()], { client: null }),
        401,
        'missing_header'
      )
    })

    it('answers 403 forbidden to another known service client, on both routes', async () => {
      expectProblem(
        await getLegacyApplicationStatuses([randomUUID()], {
          client: nonAdminApiClient()
        }),
        403,
        'forbidden'
      )
      expectProblem(
        await getCaseManagementStatusMapping({ client: nonAdminApiClient() }),
        403,
        'forbidden'
      )
    })
  })
})
