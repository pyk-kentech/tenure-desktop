#!/usr/bin/env node
/**
 * tenure (DESIGN.md 36.26): fills out/orcad-prebuilds from an official Orca build's orcad
 * template, so `build-orcad-template.mjs` can build the fork's template on one Windows PC.
 *
 * Upstream compiles each node-pty slot on a runner of that platform/libc (build-orcad-prebuilds.mjs).
 * Those binaries are N-API 8 builds of the same patched node-pty@1.1.0, independent of the Node
 * pin, so the official template's copies serve the fork's JS. Only the compiled slot files come
 * from it (Windows takes the rest from node-pty's package, as upstream does); every JS file, the
 * watcher packages and ripgrep are built from this tree as usual.
 *
 *   node config/scripts/tenure-seed-orcad-prebuilds.mjs <official orcad-template dir>
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import {
  ORCAD_NODE_PTY_DIR,
  ORCAD_WINDOWS_PROCESS_TREE_FILENAME,
  ORCAD_WINDOWS_SECURITY_FILENAME,
  orcadNodePtySlotFiles
} from '../../src/shared/orcad-artifacts.ts'
import {
  COMPAT_SERVER_TARGETS,
  NODE_RUNTIME_PIN,
  ORCAD_TEMPLATE_TARGETS
} from '../../src/shared/node-runtime-pin.ts'
import {
  COMPAT_SLOT_ADDONS,
  findSlotProblems,
  MANIFEST_SCHEMA_VERSION,
  SLOT_NAPI_VERSION,
  sha256Of,
  slotSourceFiles
} from './orcad-prebuild-slot-contents.mjs'

const root = resolve(import.meta.dirname, '../..')
const prebuildsDir = join(root, 'out', 'orcad-prebuilds')
const require = createRequire(import.meta.url)

function seedSlot(templateDir, slot) {
  const targetDir = join(templateDir, 'targets', slot)
  if (!existsSync(targetDir)) {
    throw new Error(`[tenure-seed] the official template has no ${slot} target at ${targetDir}`)
  }
  const compiledDir = join(targetDir, ...ORCAD_NODE_PTY_DIR.split('/'), 'build', 'Release')
  // Why the package for Windows: upstream compiles only conpty.node there and takes the rest from
  // node-pty's own prebuilds and ConPTY payload (slotSourceFiles); the installed official
  // template also lacks some of them for win32-arm64.
  const packageFiles = slot.startsWith('win32-')
    ? new Map(
        slotSourceFiles({
          platform: 'win32',
          arch: slot.split('-')[1],
          buildDir: compiledDir,
          nodePtyDir: dirname(require.resolve('node-pty/package.json'))
        })
      )
    : new Map()
  const sources = orcadNodePtySlotFiles(slot).map((file) => [
    file,
    packageFiles.get(file) ?? join(compiledDir, ...file.split('/'))
  ])
  if (COMPAT_SERVER_TARGETS.includes(slot)) {
    for (const [file, shipped] of Object.entries(COMPAT_SLOT_ADDONS)) {
      sources.push([file, join(targetDir, ...shipped.split('/'))])
    }
  }
  const files = {}
  for (const [file, source] of sources) {
    const destination = join(prebuildsDir, slot, ...file.split('/'))
    mkdirSync(dirname(destination), { recursive: true })
    copyFileSync(source, destination)
    files[file] = sha256Of(destination)
  }
  return { files }
}

/**
 * The Windows slots' process-reader and ACL addons, where build-orcad stages them from
 * (`.build/windows-process-tree/<arch>`, `.build/windows-security/<arch>`). Upstream compiles
 * them per arch from patched sources; the official template carries those builds.
 */
function seedWindowsAddons(templateDir) {
  for (const target of ORCAD_TEMPLATE_TARGETS.filter((name) => name.startsWith('win32-'))) {
    const arch = target.slice('win32-'.length)
    for (const [dir, file] of [
      ['windows-process-tree', ORCAD_WINDOWS_PROCESS_TREE_FILENAME],
      ['windows-security', ORCAD_WINDOWS_SECURITY_FILENAME]
    ]) {
      const destination = join(root, '.build', dir, arch, file)
      mkdirSync(dirname(destination), { recursive: true })
      copyFileSync(join(templateDir, 'targets', target, file), destination)
    }
  }
}

function main() {
  const templateDir = resolve(process.argv[2] ?? '')
  if (!process.argv[2] || !existsSync(join(templateDir, 'orcad-template.json'))) {
    throw new Error('usage: tenure-seed-orcad-prebuilds.mjs <official orcad-template dir>')
  }
  const slots = [...ORCAD_TEMPLATE_TARGETS, ...COMPAT_SERVER_TARGETS]
  rmSync(prebuildsDir, { recursive: true, force: true })
  const manifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    module: 'node-pty',
    version: require('node-pty/package.json').version,
    napi: SLOT_NAPI_VERSION,
    nodeHeaders: NODE_RUNTIME_PIN.version,
    // Why recorded: these slots were not compiled here; the template build reads only the files.
    seededFrom: JSON.parse(readFileSync(join(templateDir, 'orcad-template.json'), 'utf8'))
      .schemaVersion,
    slots: Object.fromEntries(slots.map((slot) => [slot, seedSlot(templateDir, slot)]))
  }
  writeFileSync(join(prebuildsDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  const problems = findSlotProblems(manifest, prebuildsDir, slots)
  if (problems.length > 0) {
    throw new Error(`[tenure-seed] ${problems.join('; ')}`)
  }
  seedWindowsAddons(templateDir)
  process.stdout.write(`[tenure-seed] ${slots.length} node-pty slots from ${templateDir}\n`)
}

main()
