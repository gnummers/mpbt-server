import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearLocalCollapse,
  consumeDeferredLocalCollapseOnLanding,
  markLocalCollapse,
} from './combat-transition-state.js';

test('markLocalCollapse arms downed and recovery gating immediately', () => {
  const session = {
    combatDeferredLocalCollapsePending: false,
    combatLastLocalCollapseAt: undefined as number | undefined,
    combatLocalDowned: false,
    combatRecoveryExperimentPending: false,
  };

  markLocalCollapse(session, 1234);

  assert.equal(session.combatLastLocalCollapseAt, 1234);
  assert.equal(session.combatLocalDowned, true);
  assert.equal(session.combatRecoveryExperimentPending, true);
});

test('clearLocalCollapse drops all local collapse/recovery gates', () => {
  const session = {
    combatDeferredLocalCollapsePending: true,
    combatLastLocalCollapseAt: 9000,
    combatLocalDowned: true,
    combatRecoveryExperimentPending: true,
  };

  clearLocalCollapse(session);

  assert.equal(session.combatDeferredLocalCollapsePending, false);
  assert.equal(session.combatLocalDowned, false);
  assert.equal(session.combatRecoveryExperimentPending, false);
  assert.equal(session.combatLastLocalCollapseAt, 9000);
});

test('consumeDeferredLocalCollapseOnLanding promotes deferred collapse on landing frame', () => {
  const session = {
    combatDeferredLocalCollapsePending: true,
    combatLastLocalCollapseAt: undefined as number | undefined,
    combatLocalDowned: false,
    combatRecoveryExperimentPending: false,
  };

  const consumed = consumeDeferredLocalCollapseOnLanding(session, 4321);

  assert.equal(consumed, true);
  assert.equal(session.combatDeferredLocalCollapsePending, false);
  assert.equal(session.combatLastLocalCollapseAt, 4321);
  assert.equal(session.combatLocalDowned, true);
  assert.equal(session.combatRecoveryExperimentPending, true);
});

test('consumeDeferredLocalCollapseOnLanding is a no-op when no deferred collapse exists', () => {
  const session = {
    combatDeferredLocalCollapsePending: false,
    combatLastLocalCollapseAt: 100,
    combatLocalDowned: false,
    combatRecoveryExperimentPending: false,
  };

  const consumed = consumeDeferredLocalCollapseOnLanding(session, 5555);

  assert.equal(consumed, false);
  assert.equal(session.combatDeferredLocalCollapsePending, false);
  assert.equal(session.combatLastLocalCollapseAt, 100);
  assert.equal(session.combatLocalDowned, false);
  assert.equal(session.combatRecoveryExperimentPending, false);
});
