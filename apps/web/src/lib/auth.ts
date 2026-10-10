// The only file that knows how sign-in works. Pages call these four functions.
//
// Local mode (NEXT_PUBLIC_AUTH_MODE=dev, API has AUTH_MODE=dev): no Cognito; the
// token is the email and any password is accepted. Admins = DEV_ADMIN_EMAILS on the API.
//
// ponytail: Cognito is not wired yet. For AWS, implement these with aws-amplify v6:
//   signIn  -> signIn({ username: email, password })
//   signUp  -> signUp(...) + confirmSignUp (add a code step on /signup)
//   signOut -> signOut()
//   getToken -> (await fetchAuthSession()).tokens?.accessToken?.toString()

export const LOCAL_AUTH = (process.env.NEXT_PUBLIC_AUTH_MODE ?? "dev") === "dev";

const KEY = "smartbin.session";

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Cognito will use the password
export async function signIn(email: string, _password: string): Promise<void> {
  if (!LOCAL_AUTH) throw new Error("Cognito sign-in is not set up yet.");
  localStorage.setItem(KEY, email.trim().toLowerCase());
}

export async function signUp(email: string, password: string): Promise<void> {
  await signIn(email, password);
}

export async function signOut(): Promise<void> {
  localStorage.removeItem(KEY);
}

export async function getToken(): Promise<string | null> {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
