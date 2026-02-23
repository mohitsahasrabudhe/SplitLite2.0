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
      allow.owner(), // create/read/update/delete own profile
      allow.authenticated().to(["read"]), // any signed-in user can read all profiles (participant picker)
    ]),

  // Expense: amount, split method, and optional title (auto from participant names or manual).
  Expense: a
    .model({
      title: a.string().required(),
      amount: a.float().required(),
      splitMethod: a.enum(["EQUAL", "BY_SHARES"]),
      totalShares: a.integer(), // required when splitMethod === BY_SHARES; sum of participants' shareCount
      participants: a.hasMany("ExpenseParticipant", "expenseId"),
      paidBy: a.string(),
    })
    .authorization((allow) => [
      allow.authenticated(), // create/read/update/delete; only participants may mutate (enforced in app)
    ]),

  // Links a user to an expense with optional share count for BY_SHARES.
  ExpenseParticipant: a
    .model({
      expenseId: a.id().required(),
      expense: a.belongsTo("Expense", "expenseId"),
      userId: a.string().required(), // Cognito sub (owner id from UserProfile)
      shareCount: a.integer(), // for BY_SHARES; default 1 for EQUAL
    })
    .authorization((allow) => [
      allow.authenticated(), // participant filtering enforced in app
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
