const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

function required(env, name) {
  const value = env[name];
  if (!value || !value.trim() || value !== value.trim()) throw new Error(name + " is required and must be trimmed");
  return value;
}

function configuredUrl(env, name) {
  let url;
  const value = required(env, name);
  try {
    url = new URL(value);
  } catch {
    throw new Error(name + " must be an absolute URL");
  }
  if (url.username || url.password || url.search || url.hash || /[?#]/.test(value)) {
    throw new Error(name + " must omit credentials, query and fragment");
  }
  return url;
}

export function readOperatorOrigin(env = process.env) {
  const url = configuredUrl(env, "OPERATOR_WEB_ORIGIN");
  if (url.pathname !== "/") throw new Error("OPERATOR_WEB_ORIGIN must be an origin");
  if (url.protocol !== "https:" && !(isLoopbackHttp(url) && env.OIDC_LOCAL_HTTP === "true")) {
    throw new Error("Operator origin requires HTTPS");
  }
  return url;
}

function isLoopbackHttp(url) {
  return url.protocol === "http:" && loopbackHosts.has(url.hostname);
}

export function readOidcConfig(env = process.env) {
  const origin = readOperatorOrigin(env);
  const issuer = configuredUrl(env, "OIDC_ISSUER");
  const local = env.OIDC_LOCAL_HTTP === "true" && isLoopbackHttp(origin) && isLoopbackHttp(issuer);
  if (issuer.protocol !== "https:" && !local) throw new Error("OIDC issuer requires HTTPS");
  if (issuer.pathname.includes("/.well-known/")) throw new Error("OIDC_ISSUER must be an issuer identifier");
  if (env.OIDC_LOCAL_HTTP === "true" && !local) throw new Error("OIDC_LOCAL_HTTP requires a loopback HTTP origin and issuer");
  if (env.OPERATOR_LOCAL_WRITES === "true" && !local) throw new Error("OPERATOR_LOCAL_WRITES requires loopback fixture mode");
  if (env.NEXT_PUBLIC_AUTH_DISABLED === "true") throw new Error("Operator authentication cannot be disabled");
  const id = required(env, "OIDC_CLIENT_ID");
  const secret = required(env, "OIDC_CLIENT_SECRET");
  const audience = required(env, "OIDC_AUDIENCE");
  if (audience === id) throw new Error("OIDC_AUDIENCE must differ from OIDC_CLIENT_ID");
  return { issuer, id, secret, audience, local };
}
