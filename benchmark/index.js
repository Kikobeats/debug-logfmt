'use strict'

const { writeFileSync } = require('node:fs')
const { join } = require('node:path')
const debug = require('debug')

const createLogger = require('..')
const encode = require('../src/encode')

const RUNS = 7
const DISABLED_OPS = 5_000_000
const ENABLED_OPS = 100_000
const ENCODE_OPS = 500_000
const DURATION_OPS = 2_000_000

const ENABLED_NAMESPACE = 'bench-on'
const DISABLED_NAMESPACE = 'bench-off'

const FIELDS = {
  method: 'GET',
  url: 'https://example.com/api/v1/items?page=2',
  status: 200,
  cache: 'HIT',
  message: 'request served from cache'
}

const ENCODED_FIELDS =
  'method=GET url="https://example.com/api/v1/items?page=2" status=200 cache=HIT message="request served from cache"'

const sink = { lines: 0, last: '' }

debug.log = line => {
  sink.lines++
  sink.last = line
}
debug.enable(ENABLED_NAMESPACE)

const enabledLog = createLogger(ENABLED_NAMESPACE)
const disabledLog = createLogger(DISABLED_NAMESPACE)

const expect = (condition, message) => {
  if (!condition) throw new Error(message)
}

const disabledCall = () => {
  const before = sink.lines
  for (let i = 0; i < DISABLED_OPS; i++) disabledLog('request', FIELDS)
  expect(!disabledLog.enabled, 'disabled logger reports enabled')
  expect(sink.lines === before, `disabled logger wrote ${sink.lines - before} lines`)
}

const enabledCall = () => {
  const before = sink.lines
  for (let i = 0; i < ENABLED_OPS; i++) enabledLog('request', FIELDS)
  expect(sink.lines - before === ENABLED_OPS, `enabled logger wrote ${sink.lines - before} lines`)
  expect(
    sink.last.endsWith(`request ${ENCODED_FIELDS}`),
    `unexpected enabled output ${JSON.stringify(sink.last)}`
  )
}

const encodeObject = () => {
  let last
  for (let i = 0; i < ENCODE_OPS; i++) last = encode(FIELDS)
  expect(last === ENCODED_FIELDS, `unexpected encode output ${JSON.stringify(last)}`)
}

const durationDisabled = () => {
  const before = sink.lines
  let done = 0
  for (let i = 0; i < DURATION_OPS; i++) {
    if (disabledLog.duration('request', FIELDS)()) done++
  }
  expect(done === DURATION_OPS, `duration returned true ${done} of ${DURATION_OPS} times`)
  expect(sink.lines === before, `disabled duration wrote ${sink.lines - before} lines`)
}

const CASES = [
  { name: 'call disabled', work: `${DISABLED_OPS} calls`, run: disabledCall },
  { name: 'call enabled to sink', work: `${ENABLED_OPS} calls`, run: enabledCall },
  { name: 'encode 5-key object', work: `${ENCODE_OPS} encodes`, run: encodeObject },
  { name: 'duration disabled', work: `${DURATION_OPS} duration()()`, run: durationDisabled }
]

const median = values => {
  const sorted = values.slice().sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

const sample = entry => {
  const walls = []
  let errors = 0
  for (let run = 0; run < RUNS; run++) {
    const started = process.hrtime.bigint()
    try {
      entry.run()
      walls.push(Number(process.hrtime.bigint() - started) / 1e6)
    } catch (error) {
      errors++
      console.error(`${entry.name} run ${run}`, error)
    }
  }
  return walls.length
    ? { med: median(walls), min: Math.min(...walls), max: Math.max(...walls), errors }
    : { med: Number.NaN, min: Number.NaN, max: Number.NaN, errors }
}

const report = (entry, result) => {
  const min = result.min.toFixed(1)
  const max = result.max.toFixed(1)
  const extra = `work ${entry.work}, errors ${result.errors}, runs ${RUNS}`
  console.log(`${entry.name}  median ${result.med.toFixed(1)}ms  range ${min}-${max}  ${extra}`)
  return {
    name: entry.name,
    unit: 'ms',
    value: Number(result.med.toFixed(1)),
    range: `${min}-${max}`,
    extra
  }
}

const main = () => {
  const results = []
  let errors = 0
  for (const entry of CASES) {
    try {
      entry.run()
    } catch (error) {
      errors++
      console.error(`${entry.name} warmup`, error)
    }
    const result = sample(entry)
    errors += result.errors
    results.push(report(entry, result))
  }
  writeFileSync(
    join(__dirname, '..', 'benchmark-output.json'),
    JSON.stringify(results, null, 2) + '\n'
  )
  if (errors > 0 || results.some(result => !Number.isFinite(result.value))) {
    process.exitCode = 1
  }
}

main()
