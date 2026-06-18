"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? "")
      })
    });

    if (!response.ok) {
      setLoading(false);
      setMessage("Credenciales incorrectas.");
      return;
    }

    const next = new URLSearchParams(window.location.search).get("next");
    router.push(next ?? "/admin");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
      <label className="grid gap-2 text-sm font-black">
        Correo
        <input name="email" type="email" required className="admin-input" />
      </label>
      <label className="grid gap-2 text-sm font-black">
        Contraseña
        <input name="password" type="password" required className="admin-input" />
      </label>
      <button
        disabled={loading}
        className="min-h-11 bg-coal-950 px-5 text-sm font-black uppercase tracking-[0.14em] text-white hover:bg-copper disabled:opacity-60"
      >
        {loading ? "Entrando" : "Entrar"}
      </button>
      {message ? <p className="text-sm font-bold text-red-700">{message}</p> : null}
    </form>
  );
}
