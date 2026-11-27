import { browser } from '@wdio/globals'
import { uniqueFixtureCopy } from './unique-fixture-file.js'

// A unique copy of the fixture, sent to the browser's side when the session is
// remote (browser.uploadFile), or the local path when it is not supported.
export async function uploadableFixture(filename, options) {
  const filePath = uniqueFixtureCopy(filename, options)
  try {
    return await browser.uploadFile(filePath)
  } catch {
    return filePath
  }
}
