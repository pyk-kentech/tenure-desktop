/**
 * tenure relay (DESIGN.md 36.24): the new-workspace composer's "coordinator + worker" mode launches
 * the coordinator Codex with its model/effort flags, the round-cap env and the coordinator prompt.
 * Codex is a fake that only records how it was started; no real agent runs.
 */
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test, expect } from './helpers/orca-app'
import { openSidebarWorkspaceComposer } from './helpers/sidebar-project-dialog'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import {
  buildFakeAgentCommandOverride,
  FAKE_AGENT_WINDOWS_SHELL
} from './helpers/fake-agent-command-override'
import { FAKE_CODEX_LAUNCH_PROBES_SOURCE } from './helpers/fake-codex-launch-probes'

const fakeCliDir = mkdtempSync(path.join(os.tmpdir(), 'tenure-relay-cli-'))
const spawnLedgerPath = path.join(fakeCliDir, 'codex-spawn.jsonl')
const fakeCodexSource = `
const { appendFileSync } = require('node:fs')
const args = process.argv.slice(2)
${FAKE_CODEX_LAUNCH_PROBES_SOURCE}
appendFileSync(process.env.TENURE_E2E_CODEX_LEDGER, JSON.stringify({ args, cap: process.env.TENURE_RELAY_MAX_ROUNDS ?? null }) + '\\n')
process.stdout.write('FAKE_CODEX_READY\\n')
process.stdin.resume()
setInterval(() => {}, 60_000)
`

if (process.platform === 'win32') {
  writeFileSync(path.join(fakeCliDir, 'fake-codex.js'), fakeCodexSource)
  writeFileSync(
    path.join(fakeCliDir, 'codex.cmd'),
    '@echo off\r\nnode "%~dp0\\fake-codex.js" %*\r\n'
  )
} else {
  const executable = path.join(fakeCliDir, 'codex')
  writeFileSync(executable, `#!/usr/bin/env node\n${fakeCodexSource}`)
  chmodSync(executable, 0o755)
}

const fakeCodexCommand = buildFakeAgentCommandOverride(
  path.join(fakeCliDir, process.platform === 'win32' ? 'codex.cmd' : 'codex')
)

test.use({ orcaAppExtraEnv: { TENURE_E2E_CODEX_LEDGER: spawnLedgerPath } })

type LedgerEntry = { args: string[]; cap: string | null }

function readLedger(): LedgerEntry[] {
  if (!existsSync(spawnLedgerPath)) {
    return []
  }
  return readFileSync(spawnLedgerPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LedgerEntry)
}

test('coordinator + worker mode starts the coordinator Codex with flags, cap and prompt', async ({
  orcaPage
}, testInfo) => {
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  await orcaPage.evaluate(
    async ({ command, windowsShell }) => {
      await window.__store!.getState().updateSettings({
        // Why English: the tenure build defaults to Korean; this spec matches English labels.
        uiLanguage: 'en',
        agentCmdOverrides: { codex: command },
        terminalWindowsShell: windowsShell,
        disabledTuiAgents: []
      })
    },
    { command: fakeCodexCommand, windowsShell: FAKE_AGENT_WINDOWS_SHELL }
  )

  await openSidebarWorkspaceComposer(orcaPage)
  const dialog = orcaPage.getByRole('dialog', { name: /Create (Workspace|Worktree)/i })
  await dialog.getByText('Start a coordinator + worker relay (two Codex)').click()
  const models = dialog.getByPlaceholder('Model (empty = Codex setting)')
  await models.first().fill('gpt-5.5')
  await models.nth(1).fill('gpt-5.2-codex')
  await dialog.locator('input[type="number"]').fill('3')
  await dialog
    .getByPlaceholder(
      'What should be built or fixed? The coordinator splits it into rounds for the worker.'
    )
    .fill('할일 CLI 만들기')
  await orcaPage.screenshot({ path: testInfo.outputPath('relay-composer.png') })
  await dialog.getByRole('button', { name: /^Create/ }).click()

  await expect.poll(() => readLedger().length, { timeout: 60_000 }).toBeGreaterThan(0)
  const [entry] = readLedger()
  await testInfo.attach('codex-spawn.json', {
    body: JSON.stringify(entry, null, 2),
    contentType: 'application/json'
  })
  expect(entry.cap).toBe('3')
  expect(entry.args).toEqual(
    expect.arrayContaining(['-m', 'gpt-5.5', '-c', 'model_reasoning_effort=high'])
  )
  const prompt = entry.args.at(-1) ?? ''
  expect(prompt).toContain('너는 tenure 지휘자다')
  expect(prompt).toContain('과제: 할일 CLI 만들기')
  expect(prompt).toContain('skills get orchestration')
  // The whole prompt must reach Codex as one argument, worker command included.
  expect(prompt).toContain('terminal split --command <일꾼 명령>')
  expect(prompt).toContain('-m gpt-5.2-codex]')
  expect(prompt).toContain('최대 3회차')
})
