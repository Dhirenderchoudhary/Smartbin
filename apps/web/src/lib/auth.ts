// The only file that knows how sign-in works. Pages call these functions.
//
// Cognito mode (NEXT_PUBLIC_AUTH_MODE=cognito, API has AUTH_MODE=cognito): Amplify v6 against the
// SmartBin user pool. New accounts get a 6-digit code by email before they can sign in.
//
// Local mode (NEXT_PUBLIC_AUTH_MODE=dev, API has AUTH_MODE=dev): no Cognito; the
// token is the email and any password is accepted. Admins = DEV_ADMIN_EMAILS on the API.

import { Amplify } from "aws-amplify";
import {
  confirmSignUp as amplifyConfirmSignUp,
  fetchAuthSession,
  resendSignUpCode,
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  signUp as amplifySignUp,
} from "aws-amplify/auth";

export const LOCAL_AUTH = (process.env.NEXT_PUBLIC_AUTH_MODE ?? "dev") === "dev";

const KEY = "smartbin.session";

// One-click test accounts for local mode (the API's DEV_ADMIN_EMAILS makes the admin one an admin)
export const DEMO_ACCOUNTS = { user: "demo@smartbin.local", admin: "admin@smartbin.local" };

// Cognito's password policy for this pool; shown on the sign-up form
export const PASSWORD_HINT = LOCAL_AUTH
  ? "At least 8 characters."
  : "At least 8 characters, with upper and lower case letters, a number and a symbol.";

// Thrown when the account exists but its email code hasn't been entered yet
export class ConfirmationRequiredError extends Error {
  constructor(public email: string) {
    super("Enter the code we emailed you to finish creating your account.");
  }
}

let configured = false;
function ensureConfigured() {
  if (configured || LOCAL_AUTH) return;
  const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  const userPoolClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  if (!userPoolId || !userPoolClientId) {
    throw new Error("Sign-in isn't configured: set NEXT_PUBLIC_COGNITO_USER_POOL_ID and NEXT_PUBLIC_COGNITO_CLIENT_ID.");
  }
  Amplify.configure({ Auth: { Cognito: { userPoolId, userPoolClientId } } });
  configured = true;
}

// Cognito error names -> messages people can act on
const FRIENDLY: Record<string, string> = {
  NotAuthorizedException: "Incorrect email or password.",
  UserNotFoundException: "Incorrect email or password.",
  UsernameExistsException: "An account with this email already exists. Sign in instead.",
  InvalidPasswordException: `Password too weak. ${PASSWORD_HINT}`,
  CodeMismatchException: "That code isn't right. Check the email and try again.",
  ExpiredCodeException: "That code has expired. Send a new one.",
  LimitExceededException: "Too many attempts. Wait a few minutes and try again.",
  TooManyRequestsException: "Too many attempts. Wait a few minutes and try again.",
  TooManyFailedAttemptsException: "Too many attempts. Wait a few minutes and try again.",
  NetworkError: "Can't reach the sign-in service. Check your connection.",
};

function friendly(err: unknown): Error {
  if (err instanceof ConfirmationRequiredError) return err;
  const name = (err as { name?: string })?.name ?? "";
  if (FRIENDLY[name]) return new Error(FRIENDLY[name]);
  return err instanceof Error ? err : new Error("Something went wrong, try again.");
}

export async function signIn(email: string, password: string): Promise<void> {
  const username = email.trim().toLowerCase();
  if (LOCAL_AUTH) {
    localStorage.setItem(KEY, username);
    return;
  }
  ensureConfigured();
  try {
    // A leftover session (another account in the same browser) would make signIn fail
    await amplifySignOut().catch(() => undefined);
    const { nextStep } = await amplifySignIn({ username, password });
    if (nextStep.signInStep === "DONE") return;
    if (nextStep.signInStep === "CONFIRM_SIGN_UP") throw new ConfirmationRequiredError(username);
    if (nextStep.signInStep === "RESET_PASSWORD") throw new Error("This account needs a password reset. Contact the SmartBin team.");
    throw new Error("This account needs an extra sign-in step the app doesn't support yet. Contact the SmartBin team.");
  } catch (err) {
    if ((err as { name?: string })?.name === "UserNotConfirmedException") throw new ConfirmationRequiredError(username);
    throw friendly(err);
  }
}

// Cognito: creates the account and throws ConfirmationRequiredError so the form asks for the email code
export async function signUp(email: string, password: string): Promise<void> {
  const username = email.trim().toLowerCase();
  if (LOCAL_AUTH) return signIn(username, password);
  ensureConfigured();
  try {
    const { nextStep } = await amplifySignUp({ username, password, options: { userAttributes: { email: username } } });
    if (nextStep.signUpStep === "CONFIRM_SIGN_UP") throw new ConfirmationRequiredError(username);
  } catch (err) {
    throw friendly(err);
  }
  await signIn(username, password);
}

// Enter the emailed code. Already-confirmed accounts count as success, so a second try
// (e.g. after a failed step that came after the code) doesn't show a confusing "expired" error.
export async function confirmSignUp(email: string, code: string): Promise<void> {
  ensureConfigured();
  const username = email.trim().toLowerCase();
  try {
    await amplifyConfirmSignUp({ username, confirmationCode: code.trim() });
  } catch (err) {
    const message = (err as { message?: string })?.message ?? "";
    if (/current status is confirmed/i.test(message)) return;
    throw friendly(err);
  }
}

export async function resendCode(email: string): Promise<void> {
  ensureConfigured();
  try {
    await resendSignUpCode({ username: email.trim().toLowerCase() });
  } catch (err) {
    throw friendly(err);
  }
}

export async function signOut(): Promise<void> {
  if (LOCAL_AUTH) {
    localStorage.removeItem(KEY);
    return;
  }
  ensureConfigured();
  await amplifySignOut().catch(() => undefined);
}

// Access token for the API (not the ID token). Amplify refreshes it when it expires.
export async function getToken(): Promise<string | null> {
  try {
    if (LOCAL_AUTH) return localStorage.getItem(KEY);
    ensureConfigured();
    const session = await fetchAuthSession();
    return session.tokens?.accessToken?.toString() ?? null;
  } catch {
    return null;
  }
}
