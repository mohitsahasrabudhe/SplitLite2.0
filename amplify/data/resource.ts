import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

/**
 * SplitLite data schema.
 * Auth: userPool (Cognito). Only authenticated users can access; participant
 * checks for expense mutate are enforced in the app layer.
 */
const schema = a.schema({
  // One profile per user; stores displayName for expense titles and participant lists.
  UserProfile: a
    .model({
      displayName: a.string().required(),
    })
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(["read"]),
    ]),

  // Expense: core accounting entity
  Expense: a
    .model({
      title: a.string().required(),
      amount: a.float().required(),
      splitMethod: a.enum(["EQUAL", "BY_SHARES"]),
      totalShares: a.integer(),

      // ✅ NEW — optional human grouping (Miami Trip, Apartment, etc)
      groupName: a.string(),

      participants: a.hasMany("ExpenseParticipant", "expenseId"),
      paidBy: a.string(),
    })
    .authorization((allow) => [
      allow.authenticated(),
    ]),

  // Links a user to an expense with optional share count for BY_SHARES.
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