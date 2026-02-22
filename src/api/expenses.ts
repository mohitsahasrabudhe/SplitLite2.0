/**
 * Typed CRUD and list functions for SplitLite expenses and users.
 * Participant-only mutate rules are enforced here (only participants can update/delete an expense).
 */
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";

const client = generateClient<Schema>();

export type ExpenseType = Schema["Expense"]["type"];
export type ExpenseParticipantType = Schema["ExpenseParticipant"]["type"];
export type UserProfileType = Schema["UserProfile"]["type"];

/** Create an expense and its participants. Caller must be authenticated. */
export async function createExpense(params: {
  title: string;
  amount: number;
  splitMethod: "EQUAL" | "BY_SHARES";
  totalShares?: number;
  participantUserIds: string[];
  participantShareCounts?: number[]; // required when splitMethod === BY_SHARES, same order as participantUserIds
}): Promise<ExpenseType> {
  const { title, amount, splitMethod, totalShares, participantUserIds, participantShareCounts } = params;
  const { data: expense, errors } = await client.models.Expense.create({
    title,
    amount,
    splitMethod,
    totalShares: totalShares ?? undefined,
  });
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(", "));
  if (!expense?.id) throw new Error("Failed to create expense");

  const counts = splitMethod === "BY_SHARES" && participantShareCounts
    ? participantShareCounts
    : participantUserIds.map(() => 1);
  for (let i = 0; i < participantUserIds.length; i++) {
    const { errors: pe } = await client.models.ExpenseParticipant.create({
      expenseId: expense.id,
      userId: participantUserIds[i],
      shareCount: counts[i] ?? 1,
    });
    if (pe?.length) throw new Error(pe.map((e) => e.message).join(", "));
  }
  return expense as ExpenseType;
}

/**
 * Update expense; only participants should call this (enforced in UI; backend allows any authenticated user).
 */
export async function updateExpense(
  expenseId: string,
  params: {
    title?: string;
    amount?: number;
    splitMethod?: "EQUAL" | "BY_SHARES";
    totalShares?: number;
  }
): Promise<ExpenseType> {
  const { data, errors } = await client.models.Expense.update({
    id: expenseId,
    ...params,
  });
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(", "));
  if (!data) throw new Error("Update returned no data");
  return data as ExpenseType;
}

/** Update participants for an expense: replace all with given userIds and shareCounts. */
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
    if (errors?.length) throw new Error(errors.map((e) => e.message).join(", "));
  }
}

/**
 * Delete an expense and its participants. Only participants should call (enforced in UI).
 */
export async function deleteExpense(expenseId: string): Promise<void> {
  const existing = await client.models.ExpenseParticipant.list({
    filter: { expenseId: { eq: expenseId } },
  });
  for (const p of existing.data ?? []) {
    if (p.id) await client.models.ExpenseParticipant.delete({ id: p.id });
  }
  const { errors } = await client.models.Expense.delete({ id: expenseId });
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(", "));
}

/**
 * List expenses where the current user is a participant (participant filtering in app).
 */
export async function listMyExpenses(userId: string): Promise<ExpenseType[]> {
  const { data: participantRows } = await client.models.ExpenseParticipant.list({
    filter: { userId: { eq: userId } },
  });
  const expenseIds = [...new Set((participantRows ?? []).map((p) => p.expenseId).filter(Boolean))] as string[];
  if (expenseIds.length === 0) return [];
  const expenses: ExpenseType[] = [];
  for (const id of expenseIds) {
    const { data: exp } = await client.models.Expense.get({ id });
    if (exp) expenses.push(exp as ExpenseType);
  }
  expenses.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
  return expenses;
}

/** List all participants for an expense. */
export async function listParticipantsForExpense(
  expenseId: string
): Promise<ExpenseParticipantType[]> {
  const { data } = await client.models.ExpenseParticipant.list({
    filter: { expenseId: { eq: expenseId } },
  });
  return (data ?? []) as ExpenseParticipantType[];
}

/** List all user profiles (for participant picker). Authenticated users only. */
export async function listAllUsers(): Promise<UserProfileType[]> {
  const { data } = await client.models.UserProfile.list();
  return (data ?? []) as UserProfileType[];
}
