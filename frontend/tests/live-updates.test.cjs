/* CommonJS harness compiles the TypeScript module in an isolated VM. */
/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const compiled = ts.transpileModule(readFileSync(join(__dirname, '../lib/live-updates.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const context = { exports: {}, setTimeout, clearTimeout };
vm.runInNewContext(compiled, context);
const { subscribeLiveUpdates } = context.exports;
const pause = () => new Promise(resolve => setTimeout(resolve, 150));

test('settlement burst refreshes customers and analytics once without unrelated menu queries', async () => {
  const socket = new EventEmitter();
  const calls = [];
  const stop = subscribeLiveUpdates(socket, { invalidateQueries: filter => { calls.push(filter); return Promise.resolve(); } });
  socket.emit('order:updated', { order: { status: 'closed' } });
  socket.emit('dining:changed', {});
  socket.emit('order:updated', { order: { status: 'closed' } });
  await pause();
  assert.equal(calls.length, 1);
  for (const key of ['customers', 'customer', 'dashboard-summary', 'invoice-history', 'invoice-detail']) {
    assert.equal(calls[0].predicate({ queryKey: [key] }), true, key);
  }
  assert.equal(calls[0].predicate({ queryKey: ['menuItems'] }), false);
  stop();
});

test('stock changes and kitchen submissions refresh stock coverage without waiting for polling', async () => {
  const socket = new EventEmitter();
  const calls = [];
  const stop = subscribeLiveUpdates(socket, { invalidateQueries: filter => { calls.push(filter); return Promise.resolve(); } });
  socket.emit('inventory:changed', {});
  socket.emit('kitchen:new-ticket', {});
  await pause();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].predicate({ queryKey: ['inventory-items'] }), true);
  assert.equal(calls[0].predicate({ queryKey: ['production-plan', 'today'] }), true);
  stop();
});

test('reconnection recovers active data and unmount removes listeners and pending work', async () => {
  const socket = new EventEmitter();
  const calls = [];
  const stop = subscribeLiveUpdates(socket, { invalidateQueries: filter => { calls.push(filter); return Promise.resolve(); } });
  socket.emit('connect');
  await pause();
  assert.equal(calls[0].predicate({ queryKey: ['kitchenTickets'] }), true);
  socket.emit('inventory:changed');
  stop();
  await pause();
  assert.equal(calls.length, 1);
  assert.equal(socket.eventNames().length, 0);
});
