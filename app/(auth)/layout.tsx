// This layout affects only /login and /forgot-password, not the store catalog.
import type { ReactNode } from "react";

// Show an isolated auth card over a responsive, dark farm-themed backdrop.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    // Full viewport height works across mobile browser chrome with min-h-dvh.
    <main dir="rtl" className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-neutral-950 p-4 text-white sm:p-8">
      {/* Replace this optional URL with an actual photo in public/images/. */}
      <div aria-hidden="true" className="absolute inset-0 bg-cover bg-center opacity-50" style={{ backgroundImage: "linear-gradient(90deg, #0a0a0a, #20202077), url('/images/auth-poultry-house.webp')" }} />
      {/* Overlay keeps white text legible even on a bright farm photograph. */}
      <div aria-hidden="true" className="absolute inset-0 bg-black/45" />
      {/* The backdrop is presentational; actual account security is entirely server-side. */}
      <section className="relative z-10 w-full max-w-md rounded-[2rem] border border-white/25 bg-neutral-900/80 p-6 shadow-2xl backdrop-blur-xl sm:p-10">
        {/* Replace the plain text logo with your brand component when ready. */}
        <p className="mb-7 text-center text-3xl font-bold text-amber-400">تکنوفارم</p>
        {/* Child page decides whether to show phone login or reset password. */}
        {children}
      </section>
    </main>
  );
}
