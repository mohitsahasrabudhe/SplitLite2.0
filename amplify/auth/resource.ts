import { defineAuth } from '@aws-amplify/backend';

/**
 * Define and configure your auth resource (email + password).
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 */
export const auth = defineAuth({
  loginWith: {
    email: true, // email/password signup and login
  },
});
