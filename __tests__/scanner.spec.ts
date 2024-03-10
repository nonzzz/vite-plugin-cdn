import test from 'ava'
import { createScanner } from '../dist/scanner'

test('scanner dependencies', (t) => {
  const scanner = createScanner(['vue'])
  scanner.scanAllDependencies()
  t.is(scanner.dependencies.has('vue'), true)
})  

test('scanner failed', (t) => {
  const scanner = createScanner(['vue', 'react'])
  scanner.scanAllDependencies()
  t.is(scanner.failedMessages[0], '[scanner error]: can\'t find any iife file from package \'react\',please check it.')
  t.is(scanner.dependencies.has('vue'), true)
})

test('scanner with aliases', (t) => {
  const scanner = createScanner([{ name: 'vue', aliases: ['dist'] }])
  scanner.scanAllDependencies()
  t.is(scanner.dependencies.get('vue').aliases.some(v => v === 'vue/dist'), true)
})
