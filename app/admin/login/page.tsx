import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "Acceso al CMS",
  description: "Acceso privado al CMS de Planta 14."
};

export default function LoginPage() {
  return (
    <div className="container-p14 flex min-h-[70vh] items-center justify-center py-10">
      <section className="w-full max-w-md border-t-4 border-coal-950 bg-white/75 p-6">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-copper">CMS</p>
        <h1 className="mt-2 font-serif text-4xl font-black leading-none text-coal-950">Acceso editorial</h1>
        <p className="mt-3 text-sm leading-6 text-coal-800">
          Entra con una cuenta de administrador o redactor.
        </p>
        <LoginForm />
      </section>
    </div>
  );
}
