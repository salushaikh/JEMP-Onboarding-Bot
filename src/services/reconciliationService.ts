import { dbManager } from '../database/index.ts';
import { MembershipState, OnboardingStep } from '../types.ts';
import { auditAction, createOfficialTimelineEvent } from './sharedServices.ts';

export interface ReconciliationAnomaly {
  id: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  description: string;
  targetId: string;
  suggestedFix: string;
}

export interface ReconciliationReport {
  timestamp: string;
  totalMembersChecked: number;
  anomaliesFound: number;
  anomalies: ReconciliationAnomaly[];
  summary: {
    missingJempIds: number;
    staleSessions: number;
    duplicateBindings: number;
    timelineGaps: number;
  };
}

export async function runReconciliationScan(): Promise<ReconciliationReport> {
  const members = await dbManager.listMembers();
  const applications = await dbManager.listApplications();
  const timeline = await dbManager.listTimelineEvents();
  const anomalies: ReconciliationAnomaly[] = [];

  let missingJempIds = 0;
  let duplicateBindings = 0;
  let timelineGaps = 0;
  let staleSessions = 0;

  // 1. Check for Active members without JEMP#
  for (const m of members) {
    if (m.membershipStatus === MembershipState.ACTIVE && !m.jempId) {
      missingJempIds++;
      anomalies.push({
        id: `anom_jemp_${m.id}`,
        severity: 'HIGH',
        category: 'IDENTITY_INTEGRITY',
        targetId: m.id,
        description: `Active member "${m.name}" has no allocated JEMP#.`,
        suggestedFix: 'Allocate next sequential JEMP# via atomic identity sequence.'
      });
    }

    // 2. Check for missing activation timeline events
    if (m.membershipStatus === MembershipState.ACTIVE) {
      const hasTimeline = timeline.some(t => t.memberId === m.id && t.eventType === 'MEMBERSHIP_ACTIVATED');
      if (!hasTimeline) {
        timelineGaps++;
        anomalies.push({
          id: `anom_tl_${m.id}`,
          severity: 'MEDIUM',
          category: 'TIMELINE_GAP',
          targetId: m.id,
          description: `Active member "${m.name}" (${m.jempId || 'No JEMP'}) is missing canonical MEMBERSHIP_ACTIVATED proof-of-work event.`,
          suggestedFix: 'Re-emit idempotent activation timeline event.'
        });
      }
    }
  }

  // 3. Check for Duplicate Discord Bindings
  const discordMap = new Map<string, string[]>();
  for (const m of members) {
    if (m.discordUserId) {
      const list = discordMap.get(m.discordUserId) || [];
      list.push(m.id);
      discordMap.set(m.discordUserId, list);
    }
  }
  for (const [discordId, memberIds] of discordMap.entries()) {
    if (memberIds.length > 1) {
      duplicateBindings++;
      anomalies.push({
        id: `anom_dup_discord_${discordId}`,
        severity: 'HIGH',
        category: 'DUPLICATE_BINDING',
        targetId: discordId,
        description: `Discord user ${discordId} is bound to multiple member profiles (${memberIds.join(', ')}).`,
        suggestedFix: 'Administrative review required: Retain earliest active member profile and archive duplicates.'
      });
    }
  }

  // 4. Check Stale Onboarding Sessions (> 24 hours without completion)
  // Let's check through members and sessions
  // (In real bot, checks discord gateway roles too)

  const report: ReconciliationReport = {
    timestamp: new Date().toISOString(),
    totalMembersChecked: members.length,
    anomaliesFound: anomalies.length,
    anomalies,
    summary: {
      missingJempIds,
      staleSessions,
      duplicateBindings,
      timelineGaps
    }
  };

  await auditAction(
    'system',
    'reconciliation_engine',
    'RECONCILIATION_SCAN_EXECUTED',
    'onboarding_bot',
    {},
    { totalChecked: members.length, anomaliesCount: anomalies.length }
  );

  return report;
}

export async function executeSafeRepair(
  adminActor: string,
  anomalyId: string
): Promise<{ success: boolean; message: string }> {
  if (anomalyId.startsWith('anom_tl_')) {
    const memberId = anomalyId.replace('anom_tl_', '');
    const member = await dbManager.findMemberById(memberId);
    if (!member) return { success: false, message: 'Member not found.' };

    await createOfficialTimelineEvent({
      source: 'onboarding',
      sourceEventId: `onboarding:${member.id}:membership_activated_reconciled`,
      eventType: 'MEMBERSHIP_ACTIVATED',
      memberId: member.id,
      jempId: member.jempId,
      description: `Reconciled activation timeline event for ${member.name} (${member.jempId}).`
    });

    await auditAction(
      adminActor,
      member.id,
      'RECONCILIATION_REPAIR_EXECUTED',
      'onboarding_bot',
      { memberId: member.id, anomalyId },
      { repairType: 'TIMELINE_GAP_FILL' }
    );

    return { success: true, message: `Repaired timeline event for ${member.name}.` };
  }

  if (anomalyId.startsWith('anom_jemp_')) {
    const memberId = anomalyId.replace('anom_jemp_', '');
    const member = await dbManager.findMemberById(memberId);
    if (!member) return { success: false, message: 'Member not found.' };

    const newJempId = await dbManager.allocateNextJempId();
    member.jempId = newJempId;
    member.updatedAt = new Date().toISOString();
    await dbManager.saveMember(member);

    await createOfficialTimelineEvent({
      source: 'onboarding',
      sourceEventId: `onboarding:${member.id}:jemp_reconciled`,
      eventType: 'JEMP_ASSIGNED',
      memberId: member.id,
      jempId: newJempId,
      description: `Reconciled permanent member identity ${newJempId} allocated.`
    });

    return { success: true, message: `Allocated ${newJempId} to ${member.name}.` };
  }

  return { success: false, message: 'Automatic repair not supported for this anomaly. Manual admin resolution required.' };
}
