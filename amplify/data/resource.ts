import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

/**
 * SplitLite data schema.
 * Auth: userPool (Cognito).
 *
 * Design:
 * - Expenses can be direct (no groupId)
 * - OR belong to a Group (explicit)
 * - Groups have real membership join table
 * - UserProfile stores displayName + email (for safe search)
 */

const schema = a.schema({
  /* =========================
     User profile
     ========================= */
  UserProfile: a
    .model({
      displayName: a.string().required(),
      email: a.string().required(), // ✅ REQUIRED for search & identity
    })
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(["read"]),
    ]),

  /* =========================
     Group
     ========================= */
  Group: a
    .model({
      name: a.string().required(),
      members: a.hasMany("GroupMember", "groupId"),
    })
    .authorization((allow) => [
      allow.authenticated(),
    ]),

  /* =========================
     Group membership (JOIN TABLE)
     ========================= */
  GroupMember: a
    .model({
      groupId: a.id().required(),
      group: a.belongsTo("Group", "groupId"),

      userId: a.string().required(),
    })
    .authorization((allow) => [
      allow.authenticated(),
    ]),

  /* =========================
     Expense
     ========================= */
  Expense: a
    .model({
      title: a.string().required(),
      amount: a.float().required(),
      splitMethod: a.enum(["EQUAL", "BY_SHARES", "BY_PERCENT", "FULL"]),
      totalShares: a.integer(),

      // null = direct expense
      groupId: a.id(),

      participants: a.hasMany("ExpenseParticipant", "expenseId"),
      paidBy: a.string(),
    })
    .authorization((allow) => [
      allow.authenticated(),
    ]),

  /* =========================
     Expense participants
     ========================= */
  ExpenseParticipant: a
    .model({
      expenseId: a.id().required(),
      expense: a.belongsTo("Expense", "expenseId"),

      userId: a.string().required(),
      shareCount: a.integer(),
    })
    .authorization((allow) => [
      allow.authenticated(),
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});