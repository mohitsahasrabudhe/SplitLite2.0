import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";

const client = generateClient<Schema>();

export type ExpenseType = Schema["Expense"]["type"];
export type ExpenseParticipantType = Schema["ExpenseParticipant"]["type"];
export type UserProfileType = Schema["UserProfile"]["type"];
export type GroupType = Schema["Group"]["type"];
export type GroupMemberType = Schema["GroupMember"]["type"];

export type FlatExpense = {
  id: string;
  title: string;
  amount: number;
  splitMethod: string;
  paidBy?: string;
  groupId?: string | null;
  createdAt?: string | null;
};

export function toFlatExpense(e: any): FlatExpense {
  return {
    id: e.id ?? "",
    title: e.title ?? "",
    amount: e.amount ?? 0,
    splitMethod: e.splitMethod ?? "EQUAL",
    paidBy: e.paidBy,
    groupId: e.groupId ?? null,
    createdAt: e.createdAt ?? null,
  };
}

/* =========================
   Groups
   ========================= */

export async function createGroup(params: {
  name: string;
  memberUserIds: string[];
  createdBy: string;                    // ← NEW
  groupType?: string | null;
  reminderFrequency?: string | null;
  balanceAlertThreshold?: number | null;
}): Promise<GroupType> {
  const payload: any = {
    name: params.name,
    createdBy: params.createdBy,        // ← NEW
  };
  if (params.groupType)                     payload.groupType = params.groupType;
  if (params.reminderFrequency)             payload.reminderFrequency = params.reminderFrequency;
  if (params.balanceAlertThreshold != null) payload.balanceAlertThreshold = params.balanceAlertThreshold;

  const { data: group, errors } = await client.models.Group.create(payload);
  if (errors?.length) throw new Error(errors.map(e => e.message).join(", "));
  if (!group?.id) throw new Error("Failed to create group");

  for (const userId of params.memberUserIds) {
    const { errors } = await client.models.GroupMember.create({ groupId: group.id, userId });
    if (errors?.length) throw new Error(errors.map(e => e.message).join(", "));
  }

  return group;
}

// ── Delete group (creator only) — wipes members + expenses + participants ──
export async function deleteGroup(groupId: string): Promise<void> {
  // 1. Delete all expense participants for expenses in this group
  const { data: expenses } = await client.models.Expense.list({
    filter: { groupId: { eq: groupId } },
  });

  for (const exp of expenses ?? []) {
    if (!exp?.id) continue;
    const { data: parts } = await client.models.ExpenseParticipant.list({
      filter: { expenseId: { eq: exp.id } },
    });
    for (const p of parts ?? []) {
      if (p?.id) await client.models.ExpenseParticipant.delete({ id: p.id });
    }
    await client.models.Expense.delete({ id: exp.id });
  }

  // 2. Delete all group members
  const { data: members } = await client.models.GroupMember.list({
    filter: { groupId: { eq: groupId } },
  });
  for (const m of members ?? []) {
    if (m?.id) await client.models.GroupMember.delete({ id: m.id });
  }

  // 3. Delete the group itself
  const { errors } = await client.models.Group.delete({ id: groupId });
  if (errors?.length) throw new Error(errors.map(e => e.message).join(", "));
}

export async function listMyGroups(userId: string): Promise<GroupType[]> {
  const { data: memberships } = await client.models.GroupMember.list({
    filter: { userId: { eq: userId } },
  });
  const groupIds = [...new Set((memberships ?? []).map(m => m.groupId).filter(Boolean))] as string[];
  if (groupIds.length === 0) return [];
  const groups: GroupType[] = [];
  for (const id of groupIds) {
    const { data } = await client.models.Group.get({ id });
    if (data) groups.push(data as GroupType);
  }
  return groups;
}

export async function listGroupMembers(groupId: string): Promise<GroupMemberType[]> {
  const { data } = await client.models.GroupMember.list({
    filter: { groupId: { eq: groupId } },
  });
  return (data ?? []) as GroupMemberType[];
}

export async function addGroupMember(groupId: string, userId: string): Promise<GroupMemberType> {
  const { data, errors } = await client.models.GroupMember.create({ groupId, userId });
  if (errors?.length) throw new Error(errors.map(e => e.message).join(", "));
  if (!data) throw new Error("Failed to add group member");
  return data as GroupMemberType;
}

export async function removeGroupMember(groupMemberId: string): Promise<void> {
  const { errors } = await client.models.GroupMember.delete({ id: groupMemberId });
  if (errors?.length) throw new Error(errors.map(e => e.message).join(", "));
}

/* =========================
   Expenses
   ========================= */

export async function createExpense(params: {
  title: string;
  amount: number;
  splitMethod: "EQUAL" | "BY_SHARES" | "BY_PERCENT" | "FULL" | "BY_EXACT";
  totalShares?: number;
  participantUserIds: string[];
  participantShareCounts?: number[];
  paidBy: string;
  groupId?: string;
}): Promise<ExpenseType> {
  const { title, amount, splitMethod, totalShares, participantUserIds, participantShareCounts, paidBy, groupId } = params;
  const { data: expense, errors } = await client.models.Expense.create({
    title, amount, splitMethod,
    totalShares: totalShares ?? undefined,
    paidBy,
    groupId: groupId ?? undefined,
  });
  if (errors?.length) throw new Error(errors.map(e => e.message).join(", "));
  if (!expense?.id) throw new Error("Failed to create expense");

  const counts = participantShareCounts?.length ? participantShareCounts : participantUserIds.map(() => 1);
  for (let i = 0; i < participantUserIds.length; i++) {
    const { errors } = await client.models.ExpenseParticipant.create({
      expenseId: expense.id,
      userId: participantUserIds[i],
      shareCount: counts[i] ?? 1,
    });
    if (errors?.length) throw new Error(errors.map(e => e.message).join(", "));
  }
  return expense;
}

export async function updateExpense(
  expenseId: string,
  params: {
    title?: string;
    amount?: number;
    splitMethod?: "EQUAL" | "BY_SHARES" | "BY_PERCENT" | "FULL" | "BY_EXACT";
    totalShares?: number;
    paidBy?: string;
    groupId?: string | null;
  }
): Promise<ExpenseType> {
  const { data, errors } = await client.models.Expense.update({ id: expenseId, ...params });
  if (errors?.length) throw new Error(errors.map(e => e.message).join(", "));
  if (!data) throw new Error("Update returned no data");
  return data;
}

/* =========================
   Participants
   ========================= */

export async function setExpenseParticipants(
  expenseId: string,
  participantUserIds: string[],
  shareCounts?: number[]
): Promise<void> {
  const existing = await client.models.ExpenseParticipant.list({
    filter: { expenseId: { eq: expenseId } },
  });
  for (const p of existing.data ?? []) {
    if (p.id) await client.models.ExpenseParticipant.delete({ id: p.id });
  }
  const counts = shareCounts ?? participantUserIds.map(() => 1);
  for (let i = 0; i < participantUserIds.length; i++) {
    const { errors } = await client.models.ExpenseParticipant.create({
      expenseId,
      userId: participantUserIds[i],
      shareCount: counts[i] ?? 1,
    });
    if (errors?.length) throw new Error(errors.map(e => e.message).join(", "));
  }
}

/* =========================
   Delete expense
   ========================= */

export async function deleteExpense(expenseId: string): Promise<void> {
  const existing = await client.models.ExpenseParticipant.list({
    filter: { expenseId: { eq: expenseId } },
  });
  for (const p of existing.data ?? []) {
    if (p.id) await client.models.ExpenseParticipant.delete({ id: p.id });
  }
  const { errors } = await client.models.Expense.delete({ id: expenseId });
  if (errors?.length) throw new Error(errors.map(e => e.message).join(", "));
}

/* =========================
   Delete account — wipes everything for a user
   ========================= */

export async function deleteAllUserData(userId: string): Promise<void> {
  // 1. Delete UserProfile
  try {
    await client.models.UserProfile.delete({ id: userId });
  } catch { /* may not exist */ }

  // 2. Remove from all groups
  const { data: memberships } = await client.models.GroupMember.list({
    filter: { userId: { eq: userId } },
  });
  for (const m of memberships ?? []) {
    if (m?.id) await client.models.GroupMember.delete({ id: m.id });
  }

  // 3. Delete all expenses where paidBy = userId (and their participants)
  const { data: paidExpenses } = await client.models.Expense.list({
    filter: { paidBy: { eq: userId } },
  });
  for (const exp of paidExpenses ?? []) {
    if (!exp?.id) continue;
    const { data: parts } = await client.models.ExpenseParticipant.list({
      filter: { expenseId: { eq: exp.id } },
    });
    for (const p of parts ?? []) {
      if (p?.id) await client.models.ExpenseParticipant.delete({ id: p.id });
    }
    await client.models.Expense.delete({ id: exp.id });
  }

  // 4. Remove user from all expense participants
  const { data: participations } = await client.models.ExpenseParticipant.list({
    filter: { userId: { eq: userId } },
  });
  for (const p of participations ?? []) {
    if (p?.id) await client.models.ExpenseParticipant.delete({ id: p.id });
  }
}

/* =========================
   Queries
   ========================= */

export async function listMyExpenses(userId: string): Promise<FlatExpense[]> {
  const { data: participantRows } = await client.models.ExpenseParticipant.list({
    filter: { userId: { eq: userId } },
  });
  const expenseIds = [...new Set((participantRows ?? []).map(p => p.expenseId).filter(Boolean))] as string[];
  if (expenseIds.length === 0) return [];

  const expenses: FlatExpense[] = [];
  for (const id of expenseIds) {
    const { data: exp } = await client.models.Expense.get(
      { id },
      { selectionSet: ["id", "title", "amount", "splitMethod", "totalShares", "groupId", "paidBy", "createdAt"] }
    );
    if (exp) expenses.push(toFlatExpense(exp));
  }
  return expenses.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
}

export async function listParticipantsForExpense(expenseId: string): Promise<ExpenseParticipantType[]> {
  const { data } = await client.models.ExpenseParticipant.list({
    filter: { expenseId: { eq: expenseId } },
  });
  return (data ?? []) as ExpenseParticipantType[];
}

export async function listAllUsers(): Promise<UserProfileType[]> {
  const { data } = await client.models.UserProfile.list();
  return (data ?? []) as UserProfileType[];
}