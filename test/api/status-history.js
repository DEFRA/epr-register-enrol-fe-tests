import assert from 'node:assert/strict'

import { year } from './support.js'

// The status rules the accreditation API's responses follow (RA-772), shared
// by the test files: how each status's period is dated, and which status is
// current. As docs/openapi/registration-accreditation-api.v2.yaml in
// epr-register-enrol-backend describes them.

export const STATUSES = ['approved', 'suspended', 'cancelled', 'withdrawn']

export const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
export const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

// The UK date (yyyy-MM-dd) of a moment, as effectiveFromDate is written.
export const ukDate = (moment) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(
    new Date(moment)
  )
export const todayUk = ukDate(Date.now())

// The first day a status applies: the later of 1 January of the accreditation
// year and the UK date it was recorded (RA-772).
export function appliesFrom(recordedAt, accreditationYear) {
  const startOfYear = `${accreditationYear}-01-01`
  const recordedOn = ukDate(recordedAt)
  return recordedOn > startOfYear ? recordedOn : startOfYear
}

export function assertAbsent(object, fields, what) {
  for (const field of fields) {
    assert.ok(!(field in object), `${what} should not have ${field}`)
  }
}

export function assertOneOf(value, allowed, what) {
  assert.ok(
    allowed.includes(value),
    `${what} ${value} is not one of ${allowed}`
  )
}

// The day before an ISO date (yyyy-MM-dd), as effectiveToDate is written.
export function dayBefore(date) {
  const day = new Date(`${date}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() - 1)
  return day.toISOString().slice(0, 10)
}

// Each entry shows the period the status applies: from effectiveFromDate to
// effectiveToDate, which is the day before the next entry starts and null on
// the latest. effectiveToDate is always present, so a missing one is a failure.
export function assertStatusHistory(history, what, accreditationYear = year) {
  assert.ok(
    Array.isArray(history) && history.length > 0,
    `${what} has no statusHistory`
  )
  history.forEach((entry, index) => {
    assertOneOf(entry.status, STATUSES, `${what} status`)
    assert.match(
      entry.effectiveFromDate,
      DATE_ONLY,
      `${what} effectiveFromDate`
    )
    assert.ok(
      'effectiveToDate' in entry,
      `${what} entry has no effectiveToDate`
    )
    assert.match(entry.recordedAt, DATE_TIME, `${what} recordedAt`)
    assertAbsent(entry, ['effectiveDate'], `${what} status entry`)

    // Recorded before the year: 1 January. Recorded during it: the UK date.
    assert.equal(
      entry.effectiveFromDate,
      appliesFrom(entry.recordedAt, accreditationYear),
      `${what} effectiveFromDate for a status recorded at ${entry.recordedAt} in ${accreditationYear}`
    )

    // A period never ends before it starts, and the entries run in order.
    if (entry.effectiveToDate !== null) {
      assert.ok(
        entry.effectiveToDate >= entry.effectiveFromDate,
        `${what} effectiveToDate ${entry.effectiveToDate} is before effectiveFromDate ${entry.effectiveFromDate}`
      )
    }
    const next = history[index + 1]
    if (next) {
      assert.ok(
        next.effectiveFromDate >= entry.effectiveFromDate,
        `${what} effectiveFromDate goes backwards`
      )
      // The day before the next entry starts. Where the next starts the same
      // day (a tie, won by the later recordedAt), this one is kept and ends on
      // that same day.
      const expectedTo =
        next.effectiveFromDate === entry.effectiveFromDate
          ? entry.effectiveFromDate
          : dayBefore(next.effectiveFromDate)
      assert.equal(
        entry.effectiveToDate,
        expectedTo,
        `${what} effectiveToDate is the day before the next entry starts`
      )
    } else {
      assert.equal(
        entry.effectiveToDate,
        null,
        `${what} latest entry has no effectiveToDate`
      )
    }
  })
}

// The latest entry that starts on or before today; approved when none has yet,
// as the backend projects it. Where two start on the same date, the one
// recorded later takes precedence.
export function projectedStatus(history) {
  const effective = history
    .filter((entry) => entry.effectiveFromDate <= todayUk)
    .sort(
      (a, b) =>
        a.effectiveFromDate.localeCompare(b.effectiveFromDate) ||
        a.recordedAt.localeCompare(b.recordedAt)
    )
  return effective.at(-1)?.status ?? 'approved'
}
