import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

const schema = a.schema({
  UserProfile: a
    .model({
      displayName:     a.string().required(),
      email:           a.string().required(),
      defaultCurrency: a.string(),   // e.g. "USD", "EUR", "SOL" — free text label
    })
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(["read"]),
    ]),

  Group: a
    .model({
      name:                  a.string().required(),
      createdBy:             a.string(),
      members:               a.hasMany("GroupMember", "groupId"),
      groupType:             a.enum(["PARTNER", "TRIP", "HOUSEHOLD", "GROUP"]),
      reminderFrequency:     a.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]),
      balanceAlertThreshold: a.float(),
    })
    .authorization((allow) => [allow.authenticated()]),

  GroupMember: a
    .model({
      groupId: a.id().required(),
      group:   a.belongsTo("Group", "groupId"),
      userId:  a.string().required(),
    })
    .authorization((allow) => [allow.authenticated()]),

  Expense: a
    .model({
      title:        a.string().required(),
      amount:       a.float().required(),
      currency:     a.string(),   // "USD", "EUR", "SOL", etc. — free text, no conversion
      splitMethod:  a.enum(["EQUAL", "BY_SHARES", "BY_PERCENT", "FULL", "BY_EXACT"]),
      totalShares:  a.integer(),
      groupId:      a.id(),
      participants: a.hasMany("ExpenseParticipant", "expenseId"),
      paidBy:       a.string(),
    })
    .authorization((allow) => [allow.authenticated()]),

  ExpenseParticipant: a
    .model({
      expenseId:  a.id().required(),
      expense:    a.belongsTo("Expense", "expenseId"),
      userId:     a.string().required(),
      shareCount: a.integer(),
    })
    .authorization((allow) => [allow.authenticated()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
    apiKeyAuthorizationMode: { expiresInDays: 30 },
  },
});