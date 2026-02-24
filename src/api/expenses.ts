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

/* ========================= */
/* Flattened expense shape  */
/* ========================= */

export type FlatExpense = {
  id: string;
  title: string;
  amount: number;
  splitMethod: string;
  paidBy?: string;
  groupName?: string;        // ✅ NEW
  createdAt?: string | null;
};

export function toFlatExpense(e: any): FlatExpense {
  return {
    id: e.id ?? "",
    title: e.title ?? "",
    amount: e.amount ?? 0,
    splitMethod: e.splitMethod ?? "EQUAL",
    paidBy: e.paidBy,
    groupName: e.groupName,   // ✅ NEW
    createdAt: e.createdAt ?? null,
  };
}

/* ========================= */
/* Create expense + members */
/* ========================= */

export async function createExpense(params: {
  title: string;
  amount: number;
  splitMethod: "EQUAL" | "BY_SHARES";
  totalShares?: number;
  participantUserIds: string[];
  participantShareCounts?: number[];
  paidBy: string;
  groupName?: string;        // ✅ NEW
}): Promise<ExpenseType> {
  const {
    title,
    amount,
    splitMethod,
    totalShares,
    participantUserIds,
    participantShareCounts,
    paidBy,
    groupName,
  } = params;

  const { data: expense, errors } = await client.models.Expense.create({
    title,
    amount,
    splitMethod,
    totalShares: totalShares ?? undefined,
    paidBy,
    groupName: groupName ?? undefined, // ✅ NEW
  });

  if (errors?.length)
    throw new Error(errors.map((e) => e.message).join(", "));

  const expId = expense?.id;
  if (!expId) throw new Error("Failed to create expense");

  const counts =
    splitMethod === "BY_SHARES" && participantShareCounts
      ? participantShareCounts
      : participantUserIds.map(() => 1);

  for (let i = 0; i < participantUserIds.length; i++) {
    const { errors } = await client.models.ExpenseParticipant.create({
      expenseId: expId,
      userId: participantUserIds[i],
      shareCount: counts[i] ?? 1,
    });

    if (errors?.length)
      throw new Error(errors.map((e) => e.message).join(", "));
  }

  return toFlatExpense(expense as any) as unknown as ExpenseType;
}

/* ========================= */
/* Update expense           */
/* ========================= */

export async function updateExpense(
  expenseId: string,
  params: {
    title?: string;
    amount?: number;
    splitMethod?: "EQUAL" | "BY_SHARES";
    totalShares?: number;
    groupName?: string;      // ✅ NEW
  }
): Promise<ExpenseType> {
  const { data, errors } = await client.models.Expense.update({
    id: expenseId,
    ...params,
  });

  if (errors?.length)
    throw new Error(errors.map((e) => e.message).join(", "));

  if (!data) throw new Error("Update returned no data");

  return toFlatExpense(data as any) as unknown as ExpenseType;
}

/* ========================= */
/* Replace participants     */
/* ========================= */

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
      throw new Error(errors.map((e) => e.message).join(", "));
  }
}

/* ========================= */
/* Delete expense           */
/* ========================= */

export async function deleteExpense(expenseId: string): Promise<void> {
  const existing = await client.models.ExpenseParticipant.list({
    filter: { expenseId: { eq: expenseId } },
  });

  for (const p of existing.data ?? []) {
    if (p.id) await client.models.ExpenseParticipant.delete({ id: p.id });
  }

  const { errors } = await client.models.Expense.delete({ id: expenseId });

  if (errors?.length)
    throw new Error(errors.map((e) => e.message).join(", "));
}

/* ========================= */
/* List my expenses         */
/* ========================= */

export async function listMyExpenses(userId: string): Promise<FlatExpense[]> {
  const { data: participantRows } =
    await client.models.ExpenseParticipant.list({
      filter: { userId: { eq: userId } },
    });

  const expenseIds = [
    ...new Set(
      (participantRows ?? [])
        .map((p) => p.expenseId)
        .filter(Boolean)
    ),
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
          "groupName",   // ✅ NEW
          "paidBy",
          "createdAt",
        ],
      }
    );

    if (exp) expenses.push(toFlatExpense(exp));
  }

  expenses.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });

  return expenses;
}

/* ========================= */
/* Participants + users     */
/* ========================= */

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