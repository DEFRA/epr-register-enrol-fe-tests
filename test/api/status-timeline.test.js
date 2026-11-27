import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  statusOnFromHistory,
  statusOnFromTimeline,
  timelineFromHistory
} from './status-history.js'

// RA-809: the statusTimeline rules the API tests hold the API to
// (timelineFromHistory, and the status on a date), checked on the ticket's
// worked example and its edge cases. Needs no API: the contract tests compare
// each statusTimeline served with timelineFromHistory of its statusHistory,
// so these make sure that comparison is the ticket's algorithm.

// recordedAt is a date, recorded at 10:00 UTC that day, or a full timestamp.
const entry = (status, recordedAt, effectiveFromDate) => ({
  status,
  recordedAt: recordedAt.includes('T') ? recordedAt : `${recordedAt}T10:00:00Z`,
  effectiveFromDate
})

// The ticket's worked example: a 2027 accreditation's status history, as the
// API returns it (effectiveToDate as served, which the algorithm ignores).
const WORKED_EXAMPLE_HISTORY = [
  {
    ...entry('approved', '2026-11-10', '2027-01-01'),
    effectiveToDate: '2027-01-01'
  },
  {
    ...entry('suspended', '2026-12-15', '2027-01-01'),
    effectiveToDate: '2027-03-31'
  },
  {
    ...entry('approved', '2027-04-01', '2027-04-01'),
    effectiveToDate: '2027-06-09'
  },
  {
    ...entry('approved', '2027-06-10', '2027-06-10'),
    effectiveToDate: '2027-08-31'
  },
  { ...entry('cancelled', '2027-09-01', '2027-09-01'), effectiveToDate: null }
]

const WORKED_EXAMPLE_TIMELINE = [
  {
    status: 'suspended',
    effectiveFromDate: '2027-01-01',
    effectiveToDate: '2027-03-31'
  },
  {
    status: 'approved',
    effectiveFromDate: '2027-04-01',
    effectiveToDate: '2027-08-31'
  },
  {
    status: 'cancelled',
    effectiveFromDate: '2027-09-01',
    effectiveToDate: null
  }
]

// Every day from one ISO date to another, inclusive.
function* days(from, to) {
  for (
    let day = new Date(`${from}T00:00:00Z`);
    day <= new Date(`${to}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    yield day.toISOString().slice(0, 10)
  }
}

function assertMethodsAgree(history, from, to) {
  const timeline = timelineFromHistory(history)
  for (const date of days(from, to)) {
    assert.equal(
      statusOnFromTimeline(timeline, date),
      statusOnFromHistory(history, date),
      `status on ${date}, from the timeline and from the history`
    )
  }
}

describe('Accreditation API: statusTimeline rules (RA-809)', () => {
  describe("the ticket's worked example", () => {
    it('flattens the history into the timeline the ticket gives', () => {
      assert.deepStrictEqual(
        timelineFromHistory(WORKED_EXAMPLE_HISTORY),
        WORKED_EXAMPLE_TIMELINE
      )
    })

    it('gives the status on each date the ticket implies', () => {
      const timeline = timelineFromHistory(WORKED_EXAMPLE_HISTORY)
      for (const [date, status] of [
        ['2026-12-31', null],
        ['2027-01-01', 'suspended'],
        ['2027-03-31', 'suspended'],
        ['2027-04-01', 'approved'],
        ['2027-06-10', 'approved'],
        ['2027-08-31', 'approved'],
        ['2027-09-01', 'cancelled'],
        ['2028-06-30', 'cancelled']
      ]) {
        assert.equal(statusOnFromTimeline(timeline, date), status, date)
      }
    })

    it('gives the same status on every date from the timeline and from the history', () => {
      assertMethodsAgree(WORKED_EXAMPLE_HISTORY, '2026-12-01', '2028-01-31')
    })

    it('does not depend on the order the history is given in', () => {
      assert.deepStrictEqual(
        timelineFromHistory([...WORKED_EXAMPLE_HISTORY].reverse()),
        WORKED_EXAMPLE_TIMELINE
      )
    })
  })

  describe('edge cases', () => {
    it('an empty history has an empty timeline, and no status on any date', () => {
      assert.deepStrictEqual(timelineFromHistory([]), [])
      assert.equal(statusOnFromTimeline([], '2027-01-01'), null)
      assert.equal(statusOnFromHistory([], '2027-01-01'), null)
    })

    it('one entry is one open-ended period', () => {
      assert.deepStrictEqual(
        timelineFromHistory([entry('approved', '2026-11-10', '2027-01-01')]),
        [
          {
            status: 'approved',
            effectiveFromDate: '2027-01-01',
            effectiveToDate: null
          }
        ]
      )
    })

    it('of two entries starting the same day, the one recorded later wins and the other never applies', () => {
      const history = [
        entry('approved', '2026-11-10', '2027-01-01'),
        entry('withdrawn', '2026-11-20', '2027-01-01'),
        entry('approved', '2026-12-01', '2027-01-01')
      ]
      assert.deepStrictEqual(timelineFromHistory(history), [
        {
          status: 'approved',
          effectiveFromDate: '2027-01-01',
          effectiveToDate: null
        }
      ])
      assertMethodsAgree(history, '2026-12-30', '2027-01-05')
    })

    it('recordedAt is compared as a time, not as text', () => {
      // As text, 10:00:00Z sorts after 10:00:00.5Z.
      const history = [
        {
          status: 'suspended',
          recordedAt: '2026-12-01T10:00:00.5Z',
          effectiveFromDate: '2027-01-01'
        },
        {
          status: 'approved',
          recordedAt: '2026-12-01T10:00:00Z',
          effectiveFromDate: '2027-01-01'
        }
      ]
      assert.deepStrictEqual(timelineFromHistory(history), [
        {
          status: 'suspended',
          effectiveFromDate: '2027-01-01',
          effectiveToDate: null
        }
      ])
    })

    it('merges any run of adjacent periods of one status into one', () => {
      const history = [
        entry('approved', '2027-01-01', '2027-01-01'),
        entry('approved', '2027-02-01', '2027-02-01'),
        entry('approved', '2027-03-01', '2027-03-01'),
        entry('suspended', '2027-04-01', '2027-04-01'),
        entry('approved', '2027-05-01', '2027-05-01')
      ]
      assert.deepStrictEqual(timelineFromHistory(history), [
        {
          status: 'approved',
          effectiveFromDate: '2027-01-01',
          effectiveToDate: '2027-03-31'
        },
        {
          status: 'suspended',
          effectiveFromDate: '2027-04-01',
          effectiveToDate: '2027-04-30'
        },
        {
          status: 'approved',
          effectiveFromDate: '2027-05-01',
          effectiveToDate: null
        }
      ])
      assertMethodsAgree(history, '2026-12-31', '2027-06-01')
    })

    it('ends a period the day before the next starts, across a month and a leap day', () => {
      const history = [
        entry('approved', '2027-01-01', '2028-01-01'),
        entry('suspended', '2028-02-01', '2028-03-01')
      ]
      assert.deepStrictEqual(timelineFromHistory(history), [
        {
          status: 'approved',
          effectiveFromDate: '2028-01-01',
          effectiveToDate: '2028-02-29'
        },
        {
          status: 'suspended',
          effectiveFromDate: '2028-03-01',
          effectiveToDate: null
        }
      ])
    })

    it('a status overruled on its first day leaves no period, even when it is the only change that day', () => {
      // The withdrawal and the restore are recorded the same UK day, so both
      // take effect that day: the restore, recorded later, wins, so the site
      // is never withdrawn and the approved periods either side merge.
      const history = [
        entry('approved', '2026-11-10', '2027-01-01'),
        entry('withdrawn', '2027-03-01T10:00:00Z', '2027-03-01'),
        entry('approved', '2027-03-01T11:00:00Z', '2027-03-01')
      ]
      assert.deepStrictEqual(timelineFromHistory(history), [
        {
          status: 'approved',
          effectiveFromDate: '2027-01-01',
          effectiveToDate: null
        }
      ])
      assertMethodsAgree(history, '2026-12-31', '2027-03-05')
    })
  })
})
