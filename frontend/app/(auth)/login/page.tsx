import { LoginCard } from "@/components/auth/login-card";

export default function LoginPage() {
  return (
    <main className="ambient-shell relative flex min-h-screen items-center justify-center overflow-hidden bg-transparent px-4 py-10">
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(229,62,21,.16),transparent_32rem),radial-gradient(circle_at_85%_80%,rgba(31,122,140,.12),transparent_28rem)]" />
      <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1fr_28rem]">
        <section className="hidden max-w-xl lg:block">
          <span className="inline-flex rounded-full border border-white/80 bg-white/55 px-4 py-2 text-small font-semibold text-primary shadow-sm backdrop-blur-xl">Live restaurant operations</span>
          <h1 className="mt-6 font-heading text-5xl font-semibold leading-[1.08] tracking-[-0.04em] text-text">Every table, ticket and team member in sync.</h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-text-muted">Run service with real-time kitchen updates, smart seating, precise inventory and clear guest communication.</p>
        </section>
        <LoginCard />
      </div>
    </main>
  );
}
