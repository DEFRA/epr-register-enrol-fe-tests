import assert from 'node:assert/strict'

import { year } from './support.js'

// The status rules the accreditation API's responses follow, shared by the
// test files: how each status's period is dated (RA-772), and the latest
// status (latestStatus, RA-773). As
// docs/openapi/registration-accreditation-api.v2.yaml in
// epr-register-enrol-backend describes them.

export const STATUSES = ['approved', 'suspended', 'cancelled', 'withdrawn']

export const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
export const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

// The UK date (yyyy-MM-dd) of a moment, as effectiveFromDate is written.
export const ukDate = (moment) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(
    new Date(moment)
  )

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

// The shape of one status entry, in a statusHistory or as latestStatus.
export function assertStatusEntry(entry, what) {
  assertOneOf(entry.status, STATUSES, `${what} status`)
  assert.match(entry.effectiveFromDate, DATE_ONLY, `${what} effectiveFromDate`)
  assert.ok('effectiveToDate' in entry, `${what} entry has no effectiveToDate`)
  assert.match(entry.recordedAt, DATE_TIME, `${what} recordedAt`)
  assertAbsent(entry, ['effectiveDate'], `${what} status entry`)
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
    assertStatusEntry(entry, what)

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

// RA-773 (latestStatus in place of the status string) is first in backend
// 0.203.0, which is not on test yet. The tests that check it are todo with
// this reason: they run every time, show in the report as a known gap while
// test serves the old status string, and pass once it serves latestStatus,
// when the report says to drop the todo.
export const LATEST_STATUS_TODO =
  'RA-773 latestStatus is in epr-register-enrol-backend 0.203.0, not yet deployed to test'

// latestStatus replaces the status string (RA-773). It has the shape of a
// status history entry, and it is the latest one whether or not its
// effectiveFromDate has arrived, so it can be in the future.
export function assertLatestStatus(record, what) {
  assertAbsent(record, ['status'], what)
  const latest = record.latestStatus
  assert.equal(typeof latest, 'object', `${what} has no latestStatus`)
  assert.notEqual(latest, null, `${what} has no latestStatus`)
  assertStatusEntry(latest, `${what} latestStatus`)
  // No later entry closes the latest one.
  assert.equal(
    latest.effectiveToDate,
    null,
    `${what} latestStatus has an effectiveToDate`
  )
}

// latestStatus is the same entry as the latest one in the history: the latest
// effectiveFromDate, and the later recordedAt where two share one. The sorted
// check is the only one that applies the recordedAt tie-break; assertStatusHistory
// already checks that the entries are in order, so the last-entry check below it
// guards the order the API returns them in.
export function assertLatestStatusMatchesHistory(record, what) {
  const latest = [...record.statusHistory]
    .sort(
      (a, b) =>
        a.effectiveFromDate.localeCompare(b.effectiveFromDate) ||
        a.recordedAt.localeCompare(b.recordedAt)
    )
    .at(-1)
  assert.deepStrictEqual(
    record.latestStatus,
    latest,
    `${what} latestStatus is the latest entry of its statusHistory`
  )
  assert.deepStrictEqual(
    record.latestStatus,
    record.statusHistory.at(-1),
    `${what} latestStatus is the last entry of its statusHistory`
  )
}

// An accreditation's status to filter on: latestStatus's since RA-773, the
// status string before it. Only for checking what a status filter returns;
// the shape (latestStatus, and no status string) is the RA-773 tests' to check.
export const statusOf = (record) => record.latestStatus?.status ?? record.status
