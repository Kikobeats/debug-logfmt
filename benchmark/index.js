#!/usr/bin/env node
'use strict'

const { performance } = require('perf_hooks')

// Test specific implementation or all
const testOnly = process.argv[2]

// Simple benchmark function
const benchmark = (name, fn, iterations = 10000) => {
  // Warm up
  for (let i = 0; i < 100; i++) fn()

  // Force GC if available
  if (global.gc) global.gc()

  const startTime = performance.now()
  const startMemory = process.memoryUsage()

  for (let i = 0; i < iterations; i++) {
    fn()
  }

  const endTime = performance.now()
  const endMemory = process.memoryUsage()

  const duration = endTime - startTime
  const memoryDelta = endMemory.heapUsed - startMemory.heapUsed
  const avgTime = duration / iterations

  console.log(`  ${name}:`)
  console.log(`    ${(avgTime * 1000000).toFixed(2)} ns/iter`)
  console.log(`    ${(iterations / (duration / 1000)).toLocaleString()} ops/sec`)
  console.log(`    ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`)
  console.log()

  return { duration, avgTime, memoryDelta }
}

// Expensive computation for testing
const expensiveComputation = id => {
  let result = ''
  for (let i = 0; i < 3000; i++) {
    result += `computation-${id}-${i}-${Math.random()}`
  }
  return result.substring(0, 100)
}

// Available implementations
const implementations = [
  { name: 'debug', factory: () => require('debug') },
  { name: 'debug-fabulous', factory: () => require('debug-fabulous')(require('debug')) },
  { name: 'debug-logfmt', factory: () => require('../src/index.js') }
]

// Filter if specific implementation requested
const toTest = testOnly ? implementations.filter(impl => impl.name === testOnly) : implementations

if (toTest.length === 0) {
  console.error(`❌ Unknown: ${testOnly}`)
  console.log('Available: debug, debug-fabulous, debug-logfmt')
  process.exit(1)
}

// Run benchmarks
toTest.forEach((impl, index) => {
  if (index > 0) console.log('\n' + '='.repeat(70))

  console.log(`\n🔬 ${impl.name.toUpperCase()}`)
  console.log('-'.repeat(30))

  let createDebug
  try {
    createDebug = impl.factory()
  } catch (error) {
    console.log(`❌ Not available (npm install ${impl.name})`)
    return
  }

  // =============================================================================
  // DEBUG DISABLED (Production scenario)
  // =============================================================================
  console.log('🔴 DEBUG DISABLED (Production):')

  delete process.env.DEBUG
  const debugDisabled = createDebug('test-disabled')

  benchmark(
    `${impl.name} - string`,
    () => {
      debugDisabled('Simple message')
    },
    30000
  )

  let lazyResult, immediateResult

  if (impl.name === 'debug') {
    immediateResult = benchmark(
      `${impl.name} - immediate only`,
      () => {
        const result = 'Expensive: ' + expensiveComputation(Math.random())
        debugDisabled(result)
      },
      500
    )
    console.log('   💡 No lazy evaluation support')
  } else {
    lazyResult = benchmark(
      `${impl.name} - lazy`,
      () => {
        debugDisabled(() => 'Expensive: ' + expensiveComputation(Math.random()))
      },
      5000
    )

    immediateResult = benchmark(
      `${impl.name} - immediate`,
      () => {
        const result = 'Expensive: ' + expensiveComputation(Math.random())
        debugDisabled(result)
      },
      500
    )
  }

  // =============================================================================
  // DEBUG ENABLED (Development scenario)
  // =============================================================================
  console.log('🟢 DEBUG ENABLED (Development):')

  process.env.DEBUG = 'test-enabled'
  const debugEnabled = createDebug('test-enabled')

  // Suppress output for clean benchmark
  const originalStderr = process.stderr.write
  process.stderr.write = () => true

  benchmark(
    `${impl.name} - string enabled`,
    () => {
      debugEnabled('Simple message')
    },
    5000
  )

  if (impl.name !== 'debug') {
    benchmark(
      `${impl.name} - lazy enabled`,
      () => {
        debugEnabled(() => 'Expensive: ' + expensiveComputation(Math.random()))
      },
      200
    )
  }

  benchmark(
    `${impl.name} - immediate enabled`,
    () => {
      const result = 'Expensive: ' + expensiveComputation(Math.random())
      debugEnabled(result)
    },
    200
  )

  // Restore output
  process.stderr.write = originalStderr

  // Show comparison for this implementation
  if (lazyResult && immediateResult) {
    const speedup = immediateResult.avgTime / lazyResult.avgTime
    console.log(`🚀 ${impl.name} lazy vs immediate: ${speedup.toFixed(0)}x faster`)
    console.log(`   Lazy: ${(lazyResult.avgTime * 1000000).toFixed(2)} ns/iter`)
    console.log(`   Immediate: ${(immediateResult.avgTime * 1000000).toFixed(0)} ns/iter`)
  }
})
