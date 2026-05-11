import type { ClientSession } from '../state/players.js';

type CombatTransitionStateSession = Pick<
  ClientSession,
  'combatDeferredLocalCollapsePending' | 'combatLastLocalCollapseAt' | 'combatLocalDowned' | 'combatRecoveryExperimentPending'
>;

export function markLocalCollapse(
  session: CombatTransitionStateSession,
  nowMs = Date.now(),
): void {
  session.combatLastLocalCollapseAt = nowMs;
  session.combatLocalDowned = true;
  session.combatRecoveryExperimentPending = true;
}

export function clearLocalCollapse(session: CombatTransitionStateSession): void {
  session.combatLocalDowned = false;
  session.combatDeferredLocalCollapsePending = false;
  session.combatRecoveryExperimentPending = false;
}

export function consumeDeferredLocalCollapseOnLanding(
  session: CombatTransitionStateSession,
  nowMs = Date.now(),
): boolean {
  if (!session.combatDeferredLocalCollapsePending) {
    return false;
  }
  session.combatDeferredLocalCollapsePending = false;
  markLocalCollapse(session, nowMs);
  return true;
}
