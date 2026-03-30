import { readFileSync } from 'node:fs'
import { resolve as pathResolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const pkg = JSON.parse(
  readFileSync(pathResolve(__dirname, 'package.json'), 'utf8')
)
const aliases = pkg.aliases || {}

export function resolve(specifier, context, nextResolve) {
  for (const [alias, target] of Object.entries(aliases)) {
    if (specifier === alias || specifier.startsWith(alias + '/')) {
      const relative = specifier.slice(alias.length).replace(/^\//, '')
      const resolved = pathToFileURL(
        pathResolve(__dirname, target, relative)
      ).href
      return nextResolve(resolved, context)
    }
  }
  return nextResolve(specifier, context)
}
