/* Hallmark · genre: playful · macrostructure: Marquee Hero · theme: warm-orange (preserved)
 * Hero: giant live timer fills viewport · Below fold: product previews (history + settings)
 * nav: N1b SaaS three-section · footer: Ft2 inline single-line
 * Hallmark · pre-emit critique: P5 H5 E5 S5 R4 V5
 */
import { useState, useEffect } from "react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { ArrowRight, ArrowUpRight, Plus } from "lucide-react";
import { SettingsPreview } from "./SettingsPreview";
import { HistoryPreview } from "./HistoryPreview";

const GITHUB_URL = "https://github.com/dicodingacademy/basetrack";

const INTEGRATIONS = [
  {
    label: "Basecamp",
    status: "Native",
    logo: "/logos/basecamp.svg",
    description: "Projects, todos, and time log sync",
  },
  {
    label: "Google Calendar",
    status: "Provider",
    logo: "/logos/google-calendar.svg",
    description: "Calendar events as trackable items",
  },
  {
    label: "Google Tasks",
    status: "Provider",
    logo: "/logos/google-tasks.svg",
    description: "Task lists pulled into your timer queue",
  },
];

type ActiveTimerProp = {
  startedAt: string | Date;
  todoTitle: string;
  projectName?: string;
} | null;

function fmtTime(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function TrackNowButton({ size = "default", className, isLoggedIn = false }: { size?: "sm" | "default" | "lg"; className?: string; isLoggedIn?: boolean }) {
  return (
    <Button render={<a href={isLoggedIn ? "/" : "/auth/basecamp"} />} size={size} className={cn("shrink-0", className)}>
      {isLoggedIn ? "Open App" : "Track Now"}
      <ArrowRight className="ml-1.5 size-4" />
    </Button>
  );
}

function StickyCtaBar({ visible, isLoggedIn }: { visible: boolean; isLoggedIn: boolean }) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 transition-transform duration-300",
        visible ? "translate-y-0" : "translate-y-full",
      )}
      aria-hidden={!visible}
    >
      <div className="border-t bg-background/90 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-3 lg:px-8">
          <p className="hidden text-sm text-muted-foreground sm:block">
            {isLoggedIn ? "Ready to track? Jump back into the app." : "Log in with Basecamp to start tracking."}
          </p>
          <TrackNowButton size="sm" className="ml-auto" isLoggedIn={isLoggedIn} />
        </div>
      </div>
    </div>
  );
}

const DEMO_ELAPSED_SEED = 1 * 3600 + 24 * 60 + 37;

export function LandingPage({ activeTimer, isLoggedIn = false }: { activeTimer?: ActiveTimerProp; isLoggedIn?: boolean }) {
  const isLive = !!activeTimer;

  const [elapsed, setElapsed] = useState(() => {
    if (!activeTimer) return DEMO_ELAPSED_SEED;
    return Math.floor((Date.now() - new Date(activeTimer.startedAt).getTime()) / 1000);
  });
  const [stickyVisible, setStickyVisible] = useState(false);

  useEffect(() => {
    if (!activeTimer) {
      const id = setInterval(() => setElapsed(prev => prev + 1), 1000);
      return () => clearInterval(id);
    }
    const start = new Date(activeTimer.startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeTimer?.startedAt]);

  useEffect(() => {
    const check = () => {
      const footerEl = document.querySelector("footer");
      const footerTop = footerEl?.getBoundingClientRect().top ?? Infinity;
      setStickyVisible(window.scrollY > 400 && footerTop > window.innerHeight);
    };
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground overflow-x-clip">

      {/* N1b SaaS three-section nav */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-14 items-center px-4 lg:px-8">
          <a href="/" className="flex items-center gap-2 mr-auto">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary font-bold text-[10px] text-primary-foreground">BT</div>
            <span className="text-sm font-semibold tracking-tight">Basetrack</span>
          </a>
          <a
            href={GITHUB_URL}
            className="mx-auto hidden items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
          >
            GitHub
            <ArrowUpRight className="size-3.5" />
          </a>
          <div className="ml-auto">
            <TrackNowButton size="sm" isLoggedIn={isLoggedIn} />
          </div>
        </div>
      </header>

      <main className="flex-1 pb-20">

        {/* Marquee Hero — giant ticking timer IS the hero */}
        <section className="container mx-auto flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4 text-center lg:px-8">

          <div className="mb-8 flex items-center gap-2.5">
            <span className={cn(
              "size-2 shrink-0 rounded-full",
              isLive ? "bg-primary animate-live-pulse" : "bg-muted-foreground/40",
            )} />
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">
              {isLive ? "Currently tracking" : "Demo timer"}
            </span>
            <span className="text-sm font-medium text-foreground">
              {isLive ? activeTimer.todoTitle : "Marketing Landing Page"}
            </span>
          </div>

          <div
            className="font-mono font-bold tabular-nums leading-none tracking-tighter"
            style={{ fontSize: "clamp(3.5rem, 17vw, 13rem)" }}
          >
            {fmtTime(elapsed)}
          </div>

          <h1
            className="mx-auto mt-10 max-w-md font-bold leading-[1.1] tracking-tight overflow-wrap-anywhere"
            style={{ fontSize: "clamp(1.4rem, 3.5vw, 2.25rem)" }}
          >
            Basecamp hours,{" "}
            <span className="text-primary">on autopilot.</span>
          </h1>

          <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-muted-foreground">
            Start timers from Basecamp tasks, set auto-stop rules, and sync hours back — automatically.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <TrackNowButton size="lg" isLoggedIn={isLoggedIn} />
            <a
              href={GITHUB_URL}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              View source
              <ArrowUpRight className="size-3.5" />
            </a>
          </div>

          <div className="mt-16 h-10 w-px bg-border" aria-hidden="true" />
        </section>

        {/* Product previews — the actual app, side by side */}
        <section className="border-t">
          <div className="container mx-auto px-4 py-12 lg:px-8 lg:py-16">
            <div className="mb-10 text-center">
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Built for your daily workflow</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                From configurable tracking rules to a clean history log — every screen designed to save you time.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <HistoryPreview />
              <SettingsPreview />
            </div>
          </div>
        </section>

        {/* Integrations — provider model story */}
        <section className="border-t">
          <div className="container mx-auto px-4 py-12 lg:px-8 lg:py-16">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">

              {/* Left: the pitch */}
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground mb-3">Extensible by design</p>
                <h2 className="text-xl font-bold tracking-tight sm:text-2xl overflow-wrap-anywhere">
                  New integrations take{" "}
                  <span className="text-primary">one file.</span>
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  Every data source — calendar events, task lists, project todos — is a self-contained provider.
                  Drop in a TypeScript file that implements the provider interface and your source
                  shows up everywhere: the timer queue, history, filters, and auto-stop rules. No core changes required.
                </p>
                <a
                  href={`${GITHUB_URL}/tree/main/apps/tracker/app/lib/providers`}
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:underline"
                >
                  Browse the provider API
                  <ArrowUpRight className="size-3.5" />
                </a>
              </div>

              {/* Right: integration cards grid */}
              <div className="grid grid-cols-2 gap-3">
                {INTEGRATIONS.map(({ label, status, logo, description }) => (
                  <div key={label} className="rounded-xl border bg-card p-4">
                    <div className="flex items-center gap-2.5 mb-2">
                      <img src={logo} alt={label} className="size-6 object-contain shrink-0" />
                      <span className="text-sm font-semibold leading-tight">{label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
                    <div className="mt-3">
                      <span className={cn(
                        "inline-block rounded-full px-2 py-0.5 font-mono text-[10px] font-medium",
                        status === "Native"
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}>
                        {status}
                      </span>
                    </div>
                  </div>
                ))}

                {/* "Add your own" slot */}
                <a
                  href={GITHUB_URL}
                  className="group rounded-xl border border-dashed border-border bg-card/40 p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30 transition-colors group-hover:border-primary/50">
                      <Plus className="size-3 text-muted-foreground transition-colors group-hover:text-primary" />
                    </div>
                    <span className="text-sm font-semibold text-muted-foreground transition-colors group-hover:text-foreground">
                      Add your own
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">One TypeScript file. No core changes needed.</p>
                  <div className="mt-3">
                    <span className="inline-block rounded-full bg-muted/50 px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                      Open Source
                    </span>
                  </div>
                </a>
              </div>

            </div>
          </div>
        </section>

      </main>

      {/* Ft2 inline single-line footer */}
      <footer className="border-t">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-muted-foreground lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex size-5 items-center justify-center rounded bg-primary font-bold text-[8px] text-primary-foreground">BT</div>
            <span className="font-medium text-foreground">Basetrack</span>
            <span className="text-muted-foreground/50">·</span>
            <span>React Router · Tauri · Prisma</span>
          </div>
          <div className="flex items-center gap-4">
            <a href={`${GITHUB_URL}/issues`} className="transition-colors hover:text-foreground">Report bug</a>
            <a href={`${GITHUB_URL}/issues`} className="transition-colors hover:text-foreground">Request feature</a>
          </div>
        </div>
      </footer>

      <StickyCtaBar visible={stickyVisible} isLoggedIn={isLoggedIn} />

    </div>
  );
}
