import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCertificateImage, newestLeaveTypesFirst } from '../src/lib/leaveFormRules';

test('medical certificate uploads accept images only, not PDF files', () => {
  assert.equal(isCertificateImage({ type: 'image/png' }), true);
  assert.equal(isCertificateImage({ type: 'image/jpeg' }), true);
  assert.equal(isCertificateImage({ type: 'application/pdf' }), false);
});

test('newly created leave types appear before older types regardless of name', () => {
  const types = [
    { name: 'Alpha', created_at: '2026-11-25T00:00:00Z' },
    { name: 'Zulu', created_at: '2026-11-26T04:57:00Z' },
  ];
  assert.deepEqual(newestLeaveTypesFirst(types).map(type => type.name), ['Zulu', 'Alpha']);
  assert.equal(types[0].name, 'Alpha');
});