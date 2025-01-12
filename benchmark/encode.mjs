'use strict'

import { Bench } from 'tinybench'

const obj = {
  foo: 'bar',
  baz: 'qux',
  beep: 'boop',
  'a b': 'c d',
  'e=f': 'g=h',
  'i\\j': 'k"l',
  'm\nn': 'o p'
}

function stringify (string) {
  if (string === '') {
    return '""'
  }

  let encoded = string.split(/\n/g).join(' ')
  if (/["\\]/.test(encoded)) encoded = encoded.replace(/["\\]/g, '\\$&')

  if (/[\s=]/.test(encoded)) {
    encoded = `"${encoded}"`
  }

  return encoded
}

const implementations = {
  'v0 (forin)': obj => {
    let result = ''
    let i = 0
    for (const key in obj) result += (i++ ? ' ' : '') + `${key}=${stringify(obj[key])}`
    return result
  },
  'v1 (reduce)': obj => {
    return Object.entries(obj)
      .reduce(
        (acc, [key, value]) =>
          acc + `${key}=${value == null ? '' : stringify(String(value))} `,
        ''
      )
      .trim()
  },
  'v2 (reduce object keys)': obj => {
    return Object.keys(obj)
      .reduce(
        (acc, key) =>
          acc +
          `${key}=${obj[key] == null ? '' : stringify(String(obj[key]))} `,
        ''
      )
      .trim()
  }
}

const cases = Object.entries(implementations)

// Verify all implementations produce the same result
const reference = JSON.stringify(
  implementations[Object.keys(implementations)[0]](obj)
)
cases.slice(1).forEach(([name, implementation]) => {
  const result = JSON.stringify(implementation(obj))
  if (result !== reference) {
    throw new Error(`Different output for ${name}: ${result}`)
  }
})

const bench = new Bench({ time: 1000 })

for (const [name, implementation] of cases) {
  bench.add(name, () => implementation(obj))
}

await bench.run()

const results = bench.tasks.map(task => ({
  name: task.name,
  value: task.result.latency.mean
}))

const fastest = results.reduce((prev, current) =>
  prev.value < current.value ? prev : current
)

console.table(bench.table())
console.log(`Fastest implementation: ${fastest.name}`)
