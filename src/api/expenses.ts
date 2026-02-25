import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";

const client = generateClient<Schema>();

export type ExpenseType = Schema["Expense"]["type"];
export type ExpenseParticipantType = Schema["ExpenseParticipant"]["type"];
export type UserProfileType = Schema["UserProfile"]["type"];
export type GroupType = Schema["Group"]["type"];
export type GroupMemberType = Schema["GroupMember"]["type"];

/* =========================
   Flattened expense shape
   ========================= */

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
   Groups (REAL)
   ========================= */

export async function createGroup(params: {
  name: string;
  memberUserIds: string[];
}): Promise<GroupType> {
  const { data: group, errors } = await client.models.Group.create({
    name: params.name,
  });

  if (errors?.length)
    throw new Error(errors.map(e => e.message).join(", "));
  if (!group?.id) throw new Error("Failed to create group");

  for (const userId of params.memberUserIds) {
    const { errors } = await client.models.GroupMember.create({
      groupId: group.id,
      userId,
    });

    if (errors?.length)
      throw new Error(errors.map(e => e.message).join(", "));
  }

  return group;
}

export async function listMyGroups(userId: string): Promise<GroupType[]> {
  const { data: memberships } =
    await client.models.GroupMember.list({
      filter: { userId: { eq: userId } },
    });

  const groupIds = [
    ...new Set((memberships ?? []).map(m => m.groupId).filter(Boolean)),
  ] as string[];

  if (groupIds.length === 0) return [];

  const groups: GroupType[] = [];

  for (const id of groupIds) {
    const { data } = await client.models.Group.get({ id });
    if (data) groups.push(data as GroupType);
  }

  return groups;
}

export async function listGroupMembers(
  groupId: string
): Promise<GroupMemberType[]> {
  const { data } = await client.models.GroupMember.list({
    filter: { groupId: { eq: groupId } },
  });

  return (data ?? []) as GroupMemberType[];
}

/* =========================
   Expenses
   ========================= */

export async function createExpense(params: {
  title: string;
  amount: number;
  splitMethod: "EQUAL" | "BY_SHARES" | "BY_PERCENT" | "FULL";
  totalShares?: number;
  participantUserIds: string[];
  participantShareCounts?: number[];
  paidBy: string;
  groupId?: string;
}): Promise<ExpenseType> {
  const {
    title,
    amount,
    splitMethod,
    totalShares,
    participantUserIds,
    participantShareCounts,
    paidBy,
    groupId,
  } = params;

  const { data: expense, errors } = await client.models.Expense.create({
    title,
    amount,
    splitMethod,
    totalShares: totalShares ?? undefined,
    paidBy,
    groupId: groupId ?? undefined,
  });

  if (errors?.length)
    throw new Error(errors.map(e => e.message).join(", "));
  if (!expense?.id) throw new Error("Failed to create expense");

  const counts =
  participantShareCounts && participantShareCounts.length > 0
    ? participantShareCounts
    : participantUserIds.map(() => 1);

  for (let i = 0; i < participantUserIds.length; i++) {
    const { errors } = await client.models.ExpenseParticipant.create({
      expenseId: expense.id,
      userId: participantUserIds[i],
      shareCount: counts[i] ?? 1,
    });

    if (errors?.length)
      throw new Error(errors.map(e => e.message).join(", "));
  }

  return expense;
}

export async function updateExpense(
  expenseId: string,
  params: {
    title?: string;
    amount?: number;
    splitMethod?: "EQUAL" | "BY_SHARES" | "BY_PERCENT" | "FULL";
    totalShares?: number;
    groupId?: string | null;
  }
): Promise<ExpenseType> {
  const { data, errors } = await client.models.Expense.update({
    id: expenseId,
    ...params,
  });

  if (errors?.length)
    throw new Error(errors.map(e => e.message).join(", "));
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

    if (errors?.length)
      throw new Error(errors.map(e => e.message).join(", "));
  }
}

/* =========================
   Delete
   ========================= */

export async function deleteExpense(expenseId: string): Promise<void> {
  const existing = await client.models.ExpenseParticipant.list({
    filter: { expenseId: { eq: expenseId } },
  });

  for (const p of existing.data ?? []) {
    if (p.id) await client.models.ExpenseParticipant.delete({ id: p.id });
  }

  const { errors } = await client.models.Expense.delete({ id: expenseId });

  if (errors?.length)
    throw new Error(errors.map(e => e.message).join(", "));
}

/* =========================
   Queries
   ========================= */

export async function listMyExpenses(userId: string): Promise<FlatExpense[]> {
  const { data: participantRows } =
    await client.models.ExpenseParticipant.list({
      filter: { userId: { eq: userId } },
    });

  const expenseIds = [
    ...new Set((participantRows ?? []).map(p => p.expenseId).filter(Boolean)),
  ] as string[];

  if (expenseIds.length === 0) return [];

  const expenses: FlatExpense[] = [];

  for (const id of expenseIds) {
    const { data: exp } = await client.models.Expense.get(
      { id },
      {
        selectionSet: [
          "id",
          "title",
          "amount",
          "splitMethod",
          "totalShares",
          "groupId",
          "paidBy",
          "createdAt",
        ],
      }
    );

    if (exp) expenses.push(toFlatExpense(exp));
  }

  return expenses.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
}

/* =========================
   Users
   ========================= */

export async function listParticipantsForExpense(
  expenseId: string
): Promise<ExpenseParticipantType[]> {
  const { data } = await client.models.ExpenseParticipant.list({
    filter: { expenseId: { eq: expenseId } },
  });

  return (data ?? []) as ExpenseParticipantType[];
}

export async function listAllUsers(): Promise<UserProfileType[]> {
  const { data } = await client.models.UserProfile.list();
  return (data ?? []) as UserProfileType[];
}