/**
 * tenure: "coordinator + worker" relay (DESIGN.md 36.24, 36.25). A coordinator Codex drives a
 * worker Codex in a split pane through Orca orchestration; the coordinator never edits files
 * itself. Everything here is pure so the prompt, argv and env are testable.
 */

export const TENURE_RELAY_MAX_ROUNDS_ENV = 'TENURE_RELAY_MAX_ROUNDS'
export const TENURE_RELAY_DONE_MARKER = 'TENURE-RELAY-DONE'
export const TENURE_RELAY_MAX_ROUNDS_LIMIT = 1000

/**
 * Model and effort are Codex's own values: '' keeps the user's Codex config. Efforts differ per
 * model (low…ultra), so they are not a fixed list here; the picker offers what the model lists.
 */
export type TenureRelayOptions = {
  coordinatorModel: string
  coordinatorEffort: string
  workerModel: string
  workerEffort: string
  /** null: no cap (the default). The coordinator is stopped by the user instead. */
  maxRounds: number | null
}

export const DEFAULT_TENURE_RELAY_OPTIONS: TenureRelayOptions = {
  coordinatorModel: '',
  coordinatorEffort: '',
  workerModel: '',
  workerEffort: '',
  maxRounds: null
}

const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,79}$/
const EFFORT = /^[a-z]{1,16}$/

/** Trims and validates user input; a malformed value is dropped rather than put in argv. */
export function normalizeTenureRelayOptions(input: TenureRelayOptions): TenureRelayOptions {
  const pick = (value: string, shape: RegExp): string => {
    const trimmed = value.trim()
    return shape.test(trimmed) ? trimmed : ''
  }
  const rounds =
    input.maxRounds !== null && Number.isFinite(input.maxRounds) ? Math.trunc(input.maxRounds) : 0
  return {
    coordinatorModel: pick(input.coordinatorModel, MODEL_ID),
    coordinatorEffort: pick(input.coordinatorEffort, EFFORT),
    workerModel: pick(input.workerModel, MODEL_ID),
    workerEffort: pick(input.workerEffort, EFFORT),
    maxRounds: rounds < 1 ? null : Math.min(rounds, TENURE_RELAY_MAX_ROUNDS_LIMIT)
  }
}

/** Codex launch flags for one side; empty values add nothing so Codex's own config applies. */
export function tenureRelayCodexArgs(model: string, effort: string): string[] {
  return [
    ...(model ? ['-m', model] : []),
    ...(effort ? ['-c', `model_reasoning_effort=${effort}`] : [])
  ]
}

const PLAIN_ARGS = /^[A-Za-z0-9\s_=.:/-]*$/

/**
 * The worker's launch command. `baseArgs` are the user's Codex default args (the coordinator gets
 * them through the normal launch path, the split pane does not); args needing quotes are dropped
 * because the command is itself quoted inside the prompt.
 */
export function tenureRelayWorkerCommand(options: TenureRelayOptions, baseArgs = ''): string {
  const plain = PLAIN_ARGS.test(baseArgs) ? baseArgs.trim() : ''
  return ['codex', plain, ...tenureRelayCodexArgs(options.workerModel, options.workerEffort)]
    .filter(Boolean)
    .join(' ')
}

/**
 * The coordinator's first prompt. It carries no double quotes at all: Windows PowerShell 5.1 splits
 * a native argument at embedded double quotes, so the worker command is bracketed instead and the
 * coordinator quotes it itself. Without a task the coordinator waits for the user's material.
 */
export function buildTenureRelayCoordinatorPrompt(args: {
  task: string
  options: TenureRelayOptions
  cliCommand: string
  /** The user's Codex default args, repeated for the worker's split pane. */
  workerBaseArgs?: string
}): string {
  const { options, cliCommand: orca } = args
  const task = args.task.trim().replace(/"/g, "'")
  const worker = tenureRelayWorkerCommand(options, args.workerBaseArgs)
  return [
    '너는 tenure 지휘자다. 직접 파일을 고치지 말고, 옆 창의 일꾼 Codex 에게 일을 맡기고 결과를 검토해 다음 지시를 내린다.',
    task
      ? `과제: ${task}`
      : '아직 과제가 없다. 사용자가 이 창에 과제와 참고 자료(링크·첨부 파일·대화 내용)를 줄 때까지 아무 명령도 실행하지 말고 기다린다. 받으면 그 자료를 읽고 아래 순서로 진행한다.',
    `순서: (1) ${orca} skills get orchestration 으로 지침을 읽고 그대로 따른다(명령 이름은 ${orca}).`,
    `(2) ${orca} status --json, ${orca} orchestration run-create --objective <과제 한 줄> --json.`,
    `(3) 일꾼 띄우기: ${orca} terminal split --command <일꾼 명령> --json 을 실행한다. 일꾼 명령은 [${worker}] 이고 대괄호 안 전체를 따옴표로 감싸 한 인자로 넘긴다. 결과의 handle 을 일꾼으로 쓰고, ${orca} terminal wait --terminal <handle> --for tui-idle --timeout-ms 120000 --json.`,
    `(4) 회차마다: ${orca} orchestration task-create --spec <명세: 대상·변경·제약·소유·완료 확인> --json → ${orca} orchestration worker-start --task <task id> --terminal <일꾼 handle> --json → check --wait 로 worker_done 기다리기 → worker-read 와 git diff 로 직접 확인 → 부족하면 다음 회차, 충분하면 끝. 사용자가 이 창에 새 지시를 주면 그것을 먼저 반영한다.`,
    ...(options.maxRounds !== null
      ? [
          `최대 ${options.maxRounds}회차. 그 이상은 tenure 가 거부한다(tenure_relay_round_cap). 거부되면 더 시도하지 말고 보고한다.`
        ]
      : []),
    `(5) 끝: 일꾼을 worker-release 하고, 사용자에게 한국어로 회차별 결과·남은 문제를 보고한 뒤 마지막 줄에 ${TENURE_RELAY_DONE_MARKER}: <한 줄 요약> 을 쓴다.`,
    `${orca} 명령이 runtime_access_denied 로 막히면 권한을 올려 다시 실행한다.`
    // Why one line: the startup command is typed into a ready shell, where a newline would submit it early.
  ].join(' ')
}

/** Everything a coordinator launch adds to a plain Codex launch, for both entry points. */
export function tenureRelayLaunch(args: {
  task: string
  options: TenureRelayOptions
  cliCommand: string
  /** The user's Codex default args and env, which the coordinator keeps. */
  baseArgs: string
  baseEnv: Record<string, string>
}): { prompt: string; agentArgs: string; agentEnv: Record<string, string> } {
  const options = normalizeTenureRelayOptions(args.options)
  return {
    prompt: buildTenureRelayCoordinatorPrompt({
      task: args.task,
      options,
      cliCommand: args.cliCommand,
      workerBaseArgs: args.baseArgs
    }),
    agentArgs: [
      args.baseArgs,
      ...tenureRelayCodexArgs(options.coordinatorModel, options.coordinatorEffort)
    ]
      .filter(Boolean)
      .join(' '),
    agentEnv:
      options.maxRounds === null
        ? { ...args.baseEnv }
        : { ...args.baseEnv, [TENURE_RELAY_MAX_ROUNDS_ENV]: String(options.maxRounds) }
  }
}
