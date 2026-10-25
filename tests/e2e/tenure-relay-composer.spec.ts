/**
 * tenure relay (DESIGN.md 36.24, 36.25): the coordinator Codex starts with the picked model and
 * effort, the round cap only when one is set, and the coordinator prompt; from the new-workspace
 * dialog and from an existing workspace's new-tab menu, with or without a task. Codex is a fake
 * that only records how it was started; no real agent runs.
 */
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Locator, Page } from '@stablyai/playwright-test'
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

/** Coordinator launches only: model-list probes also start the fake Codex. */
function coordinatorLaunches(): LedgerEntry[] {
  if (!existsSync(spawnLedgerPath)) {
    return []
  }
  return readFileSync(spawnLedgerPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LedgerEntry)
    .filter((entry) => (entry.args.at(-1) ?? '').includes('너는 tenure 지휘자다'))
}

async function useFakeCodex(page: Page): Promise<void> {
  // Why: both tests share the ledger file; each reads only its own launches.
  rmSync(spawnLedgerPath, { force: true })
  await waitForSessionReady(page)
  await waitForActiveWorktree(page)
  await page.evaluate(
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
}

async function pick(page: Page, scope: Locator, index: number, option: string): Promise<void> {
  await scope.getByRole('combobox').nth(index).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

test('new-workspace dialog: picked model and effort, optional cap, task', async ({
  orcaPage
}, testInfo) => {
  await useFakeCodex(orcaPage)
  await openSidebarWorkspaceComposer(orcaPage)
  const dialog = orcaPage.getByRole('dialog', { name: /Create (Workspace|Worktree)/i })
  await dialog.getByText('Start a coordinator + worker relay (two Codex)').click()
  const coordinator = dialog.locator('[data-tenure-relay-side="coordinator"]')
  const worker = dialog.locator('[data-tenure-relay-side="worker"]')
  await pick(orcaPage, coordinator, 0, 'GPT-5.5')
  await pick(orcaPage, coordinator, 1, 'High')
  await pick(orcaPage, worker, 0, 'GPT-5.2 Codex')
  await dialog.locator('input[type="number"]').fill('7')
  await dialog.getByPlaceholder(/^Task \(optional\)/).fill('할일 CLI 만들기')
  await orcaPage.screenshot({ path: testInfo.outputPath('relay-composer.png') })
  await dialog.getByRole('button', { name: /^Create/ }).click()

  await expect.poll(() => coordinatorLaunches().length, { timeout: 60_000 }).toBeGreaterThan(0)
  const [entry] = coordinatorLaunches()
  await testInfo.attach('codex-spawn.json', {
    body: JSON.stringify(entry, null, 2),
    contentType: 'application/json'
  })
  expect(entry.cap).toBe('7')
  expect(entry.args).toEqual(
    expect.arrayContaining(['-m', 'gpt-5.5', '-c', 'model_reasoning_effort=high'])
  )
  const prompt = entry.args.at(-1) ?? ''
  expect(prompt).toContain('과제: 할일 CLI 만들기')
  expect(prompt).toContain('skills get orchestration')
  // The whole prompt must reach Codex as one argument, worker command included.
  expect(prompt).toContain('terminal split --command <일꾼 명령>')
  expect(prompt).toContain('-m gpt-5.2-codex]')
  expect(prompt).toContain('최대 7회차')
})

test('existing workspace: new-tab menu starts a coordinator without task or cap', async ({
  orcaPage
}, testInfo) => {
  await useFakeCodex(orcaPage)
  await orcaPage.getByRole('button', { name: 'New tab' }).first().click()
  await orcaPage.getByRole('menuitem', { name: /Coordinator \+ worker \(tenure\)/ }).click()
  const dialog = orcaPage.getByRole('dialog', { name: 'Coordinator + worker' })
  await expect(dialog).toBeVisible()
  await orcaPage.screenshot({ path: testInfo.outputPath('relay-dialog.png') })
  await dialog.getByRole('button', { name: 'Start coordinator' }).click()
  await expect(dialog).toHaveCount(0)

  await expect.poll(() => coordinatorLaunches().length, { timeout: 60_000 }).toBeGreaterThan(0)
  const [entry] = coordinatorLaunches()
  await testInfo.attach('codex-spawn.json', {
    body: JSON.stringify(entry, null, 2),
    contentType: 'application/json'
  })
  expect(entry.cap).toBeNull()
  expect(entry.args).not.toContain('-m')
  const prompt = entry.args.at(-1) ?? ''
  expect(prompt).not.toContain('과제:')
  expect(prompt).toContain('기다린다')
  expect(prompt).not.toContain('tenure_relay_round_cap')
})
