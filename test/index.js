'use strict'

const stripAnsi = require('strip-ansi')
const $ = require('tinyspawn')
const test = require('ava')

const logLines = text =>
  stripAnsi(text)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n')

test('null is serialized as empty string', async t => {
  const { stderr } = await $('node', ['-e', "require('.')('test')({ value: null })"], {
    env: { ...process.env, DEBUG: 'test' }
  })

  t.is(stripAnsi(stderr), 'test value=null')
})

test('undefined is serialized as empty string', async t => {
  const { stderr } = await $('node', ['-e', "require('.')('test')({ value: undefined })"], {
    env: { ...process.env, DEBUG: 'test' }
  })

  t.is(stripAnsi(stderr), 'test value=undefined')
})

test('deleted falsy valuesnot passed as object', async t => {
  {
    const { stderr } = await $(
      'node',
      ['-e', "require('.')('test')({ foo:'bar'}, null, '', undefined)"],
      {
        env: { ...process.env, DEBUG: 'test' }
      }
    )
    t.is(stripAnsi(stderr), 'test foo=bar')
  }
  {
    const { stderr } = await $('node', ['-e', "require('.')('test')({ foo:'bar'}, false)"], {
      env: { ...process.env, DEBUG: 'test' }
    })
    t.is(stripAnsi(stderr), 'test foo=bar')
  }
})

test('disabled logger should not evaluate object getters', async t => {
  const { stdout } = await $(
    'node',
    [
      '-e',
      `
      const debug = require('.')('test')
      let calls = 0
      debug({ get value () { calls += 1; return 'ok' } })
      process.stdout.write(String(calls))
    `
    ],
    {
      env: { ...process.env, DEBUG: '' }
    }
  )

  t.is(stdout, '0')
})

test('duration should not create timer when logger is disabled', async t => {
  const { stdout } = await $(
    'node',
    [
      '-e',
      `
      const Module = require('module')
      const originalLoad = Module._load
      let timerCalls = 0

      Module._load = function (request, parent, isMain) {
        if (request === '@kikobeats/time-span') {
          return () => () => {
            timerCalls += 1
            return () => '0ms'
          }
        }
        return originalLoad.call(this, request, parent, isMain)
      }

      const debug = require('.')('test')
      const duration = debug.duration('query')
      duration('done')
      process.stdout.write(String(timerCalls))
    `
    ],
    {
      env: { ...process.env, DEBUG: '' }
    }
  )

  t.is(stdout, '0')
})

test('disabled duration returns true from every level without writing', async t => {
  const { stdout, stderr } = await $(
    'node',
    [
      '-e',
      `
      const duration = require('.')('test').duration('query')
      process.stdout.write([duration('done'), duration.info('done'), duration.error('fail')].join())
    `
    ],
    {
      env: { ...process.env, DEBUG: '' }
    }
  )

  t.is(stdout, 'true,true,true')
  t.is(stderr, '')
})

test('duration logs a level enabled on its own', async t => {
  const { stderr } = await $(
    'node',
    [
      '-e',
      `
      const duration = require('.')('test').duration('query')
      duration('done')
      duration.error('fail')
    `
    ],
    {
      env: { ...process.env, DEBUG: 'test:error' }
    }
  )

  t.regex(stripAnsi(stderr), /^test:error query fail duration=\S+$/)
})

test('duration follows namespaces enabled after the first call', async t => {
  const { stderr } = await $(
    'node',
    [
      '-e',
      `
      const debug = require('.')('test')
      debug.duration('query')('skipped')
      require('debug').enable('test')
      debug.duration('query')('done')
    `
    ],
    {
      env: { ...process.env, DEBUG: '' }
    }
  )

  t.regex(stripAnsi(stderr), /^test query done duration=\S+$/)
})

test('duration logs with custom levels', async t => {
  const { stdout, stderr } = await $(
    'node',
    [
      '-e',
      `
      const debug = require('.')('test', { levels: ['warn'] })
      process.stdout.write(String(debug.duration('query')('done')))
    `
    ],
    {
      env: { ...process.env, DEBUG: 'test' }
    }
  )

  t.is(stdout, 'true')
  t.regex(stripAnsi(stderr), /^test query done duration=\S+$/)
})

test('logger follows namespaces enabled and disabled after creation', async t => {
  const { stdout, stderr } = await $(
    'node',
    [
      '-e',
      `
      const debug = require('debug')
      const log = require('.')('test')
      const states = [log.enabled]
      log('skipped')
      debug.enable('test')
      states.push(log.enabled)
      log('shown')
      debug.disable()
      states.push(log.enabled)
      log('skipped')
      process.stdout.write(states.join())
    `
    ],
    {
      env: { ...process.env, DEBUG: '' }
    }
  )

  t.is(stdout, 'false,true,false')
  t.is(stripAnsi(stderr), 'test shown')
})

test('duration logs info when that level is enabled on its own', async t => {
  const { stderr } = await $(
    'node',
    [
      '-e',
      `
      const duration = require('.')('test').duration('query')
      duration('done')
      duration.info('ok')
      duration.error('fail')
    `
    ],
    {
      env: { ...process.env, DEBUG: 'test:info' }
    }
  )

  t.regex(stripAnsi(stderr), /^test:info query ok duration=\S+$/)
})

test('duration created while disabled logs after it is enabled', async t => {
  const { stderr } = await $(
    'node',
    [
      '-e',
      `
      const debug = require('debug')
      const duration = require('.')('test').duration('query')
      const error = duration.error
      duration('early')
      error('early')
      duration.info('early')
      debug.enable('test,test:error,test:info')
      duration('root')
      error('err')
      duration.info('inf')
    `
    ],
    {
      env: { ...process.env, DEBUG: '' }
    }
  )

  t.regex(
    logLines(stderr),
    /^test query root duration=\S+\ntest:error query err duration=\S+\ntest:info query inf duration=\S+$/
  )
})

test('duration created while enabled stays quiet after it is disabled', async t => {
  const { stderr } = await $(
    'node',
    [
      '-e',
      `
      const debug = require('debug')
      debug.enable('test,test:error')
      const duration = require('.')('test').duration('query')
      debug.disable()
      duration('hidden')
      duration.error('hidden')
      debug.enable('test')
      duration('shown')
    `
    ],
    {
      env: { ...process.env, DEBUG: '' }
    }
  )

  t.regex(logLines(stderr), /^test query shown duration=\S+$/)
})

test('disabled duration with custom levels returns true', async t => {
  const { stdout, stderr } = await $(
    'node',
    [
      '-e',
      `
      const warn = require('.')('test', { levels: ['warn'] }).duration('query')
      const info = require('.')('test', { levels: ['info'] }).duration('query')
      process.stdout.write([warn('done'), info('done'), info.info('done')].join())
    `
    ],
    {
      env: { ...process.env, DEBUG: '' }
    }
  )

  t.is(stdout, 'true,true,true')
  t.is(stderr, '')
})

test('logger follows enable when debug has no namespaces property', async t => {
  const { stdout, stderr } = await $(
    'node',
    [
      '-e',
      `
      const Module = require('module')
      const originalLoad = Module._load

      Module._load = function (request, parent, isMain) {
        const loaded = originalLoad.call(this, request, parent, isMain)
        if (request !== 'debug') return loaded
        return new Proxy(loaded, {
          has (target, prop) {
            return prop === 'namespaces' ? false : prop in target
          },
          get (target, prop, receiver) {
            if (prop === 'namespaces') return undefined
            return Reflect.get(target, prop, receiver)
          }
        })
      }

      const debug = require('debug')
      const log = require('.')('test')
      const states = [log.enabled, 'namespaces' in debug]
      log('skipped')
      debug.enable('test')
      states.push(log.enabled)
      log('shown')
      debug.disable()
      states.push(log.enabled)
      log('skipped')
      const duration = log.duration('query')
      debug.enable('test')
      duration('done')
      process.stdout.write(states.join())
    `
    ],
    {
      env: { ...process.env, DEBUG: '' }
    }
  )

  t.is(stdout, 'false,false,true,false')
  t.regex(logLines(stderr), /^test shown\ntest query done duration=\S+$/)
})

test('disabled logger reads the debug enabled getter once', async t => {
  const { stdout } = await $(
    'node',
    [
      '-e',
      `
      const Module = require('module')
      const originalLoad = Module._load
      let reads = 0

      Module._load = function (request, parent, isMain) {
        const loaded = originalLoad.call(this, request, parent, isMain)
        if (request !== 'debug') return loaded
        return new Proxy(loaded, {
          apply (target, thisArg, args) {
            const instance = Reflect.apply(target, thisArg, args)
            return new Proxy(instance, {
              get (inner, prop, receiver) {
                if (prop === 'enabled') reads += 1
                return Reflect.get(inner, prop, receiver)
              }
            })
          }
        })
      }

      const log = require('.')('test')
      for (let i = 0; i < 20; i++) {
        log.enabled
        log('skipped')
      }
      process.stdout.write(String(reads))
    `
    ],
    {
      env: { ...process.env, DEBUG: '' }
    }
  )

  t.is(stdout, '1')
})

test('enabled cache retries when the debug getter throws', async t => {
  const { stdout } = await $(
    'node',
    [
      '-e',
      `
      const Module = require('module')
      const originalLoad = Module._load
      let reads = 0

      Module._load = function (request, parent, isMain) {
        const loaded = originalLoad.call(this, request, parent, isMain)
        if (request !== 'debug') return loaded
        return new Proxy(loaded, {
          apply (target, thisArg, args) {
            const instance = Reflect.apply(target, thisArg, args)
            return new Proxy(instance, {
              get (inner, prop, receiver) {
                if (prop !== 'enabled') return Reflect.get(inner, prop, receiver)
                reads += 1
                if (reads === 1) throw new Error('boom')
                return Reflect.get(inner, prop, receiver)
              }
            })
          }
        })
      }

      const log = require('.')('test')
      let threw = false
      try {
        log.enabled
      } catch (error) {
        threw = error.message === 'boom'
      }
      process.stdout.write([threw, log.enabled].join())
    `
    ],
    {
      env: { ...process.env, DEBUG: '' }
    }
  )

  t.is(stdout, 'true,false')
})
