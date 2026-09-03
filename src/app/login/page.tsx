"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Inloggen mislukt"); return; }
      router.replace(next);
      router.refresh();
    } catch {
      setError("Er ging iets mis. Probeer opnieuw.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="size-11 rounded-xl bg-slate-900 text-white flex items-center justify-center mb-5">
          <Lock className="size-5" />
        </div>
        <h1 className="font-black text-xl text-slate-900 mb-1">Rokersbenodigheden</h1>
        <p className="text-sm text-slate-500 mb-6">Voer de code in om verder te gaan.</p>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password" inputMode="numeric" autoFocus value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="Code"
            className="w-full h-12 px-4 rounded-lg border border-slate-200 text-lg tracking-widest text-center outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15"
          />
          {error && <p className="text-[13px] text-red-600 font-medium text-center">{error}</p>}
          <button type="submit" disabled={busy || !password}
            className="w-full h-11 rounded-lg bg-slate-900 hover:bg-amber-600 disabled:opacity-40 text-white text-[12px] font-bold uppercase tracking-widest transition-colors">
            {busy ? "Bezig…" : "Toegang"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[70vh]" />}>
      <LoginForm />
    </Suspense>
  );
}
