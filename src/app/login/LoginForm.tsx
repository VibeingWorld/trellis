"use client";

import { useState, type FormEvent } from "react";
import { appPath } from "@/lib/app-path";

function LoginStory() {
  return <section className="login-story"><div className="login-brand"><span className="login-mark">c</span><strong>cove<span>.</span></strong></div><div className="login-story-copy"><span className="login-kicker">YOUR WORK, IN CALMER WATERS</span><h1>Make room for<br/><em>what matters.</em></h1><p>A private place for plans, projects, and the small steps that move everything forward.</p><div className="login-board-art"><div><span/><span/><span/></div><div><span/><span/></div><div><span/><span/><span/></div></div></div><small>Private by design · Thoughtfully organized</small></section>;
}

export default function LoginForm({ setupRequired }: { setupRequired: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch(appPath("/api/auth/login"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to continue.");
      window.location.assign(appPath("/"));
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to continue."); }
    finally { setBusy(false); }
  }

  return <main className="login-page"><LoginStory/><section className="login-panel">{setupRequired ? <div className="login-server-setup"><div className="login-heading"><span>SERVER SETUP REQUIRED</span><h2>Create the first admin on your VPS</h2><p>For security, the first administrator cannot be created from this page.</p></div><div className="server-setup-steps"><span>1</span><p>Open a root terminal on the server and run:</p><code>runuser -u trellis -- npm --prefix /opt/trellis run admin:create -- --email you@example.com --name &quot;Your Name&quot;</code><span>2</span><p>The command securely prompts for the password, then this page will allow sign-in.</p></div><button type="button" className="login-submit" onClick={() => window.location.reload()}>Check again <span>↻</span></button><p className="login-security">Administrator setup is restricted to direct server access.</p></div> : <form onSubmit={submit} autoComplete="on"><div className="login-heading"><span>WELCOME BACK</span><h2>Sign in to your space</h2><p>Your boards are right where you left them.</p></div><label>Email address<input autoFocus required type="email" inputMode="email" autoCapitalize="none" autoComplete="username" maxLength={255} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com"/></label><label>Password<input required type="password" autoComplete="current-password" maxLength={200} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password"/></label>{error && <div className="login-error" role="alert">{error}</div>}<button className="login-submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}<span>→</span></button><p className="login-security">Protected with secure, HTTP-only sessions and rate-limited sign-in.</p></form>}</section></main>;
}
