import { useState, useEffect } from "react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";

import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Monitor,
  Sparkles,
  Timer,
  Zap,
} from "lucide-react";
import { SettingsPreview } from "./SettingsPreview";
import { HistoryPreview } from "./HistoryPreview";

const GITHUB_URL = "https://github.com/dicodingacademy/basetrack";

const FEATURES = [
  {
    icon: Timer,
    title: "Live Timer",
    description: "Start and stop timers instantly with optimistic UI updates across every connected client.",
  },
  {
    icon: Zap,
    title: "Auto-Stop",
    description: "Prevent runaway timers with configurable thresholds and manual approval before syncing.",
  },
  {
    icon: CheckCircle2,
    title: "Approval Workflow",
    description: "Review auto-stopped entries, adjust hours, and approve them before they hit Basecamp.",
  },
  {
    icon: Monitor,
    title: "Desktop Widget",
    description: "An always-on-top Tauri companion keeps the timer one glance away while you focus.",
  },
];

const INTEGRATIONS = [
  {
    label: "Basecamp",
    status: "Native",
    logo: "/logos/basecamp.svg",
  },
  {
    label: "Google Calendar",
    status: "Provider",
    logo: "/logos/google-calendar.svg",
  },
  {
    label: "Google Tasks",
    status: "Provider",
    logo: "/logos/google-tasks.svg",
  },
];

function fmtTime(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function LiveTimerPreview() {
  const [elapsed, setElapsed] = useState(1 * 3600 + 24 * 60 + 37); // start at 01:24:37

  useEffect(() => {
    const tick = () => setElapsed(prev => prev + 1);
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-2 text-2xl font-mono font-semibold">
      <span className="size-2 animate-live-pulse rounded-full bg-primary" />
      {fmtTime(elapsed)}
    </div>
  );
}

function TrackNowButton({ size = "default", className }: { size?: "sm" | "default" | "lg"; className?: string }) {
  return (
    <Button render={<a href="/auth/basecamp" />} size={size} className={className}>
      Track Now!
      <ArrowRight className="ml-1.5 size-4" />
    </Button>
  );
}

export function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground">
      {/* ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] overflow-hidden"
      >
        <div className="absolute -top-[20%] left-1/2 aspect-square w-[120vw] -translate-x-1/2 rounded-full bg-primary/[0.07] blur-3xl" />
        <div className="absolute top-[10%] right-0 aspect-square w-[60vw] rounded-full bg-chart-2/[0.05] blur-3xl" />
      </div>

      {/* header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-14 items-center justify-between px-4 lg:px-8">
          <a href="/" className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm tracking-tight">
              BT
            </div>
            <span className="text-base font-semibold tracking-tight">Basetrack</span>
          </a>

          <div className="flex items-center gap-3">
            <TrackNowButton />
          </div>
        </div>
      </header>

      <main className="relative flex-1">
        {/* hero */}
        <section className="container mx-auto px-4 pt-20 pb-24 lg:px-8 lg:pt-28 lg:pb-32">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-5 font-normal">
              <Sparkles className="mr-1 size-3" />
              Time tracking, re-imagined for Basecamp
            </Badge>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              Seamless time tracking{" "}
              <span className="text-primary">for Basecamp</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Never lose track of your hours. Start timers from your Basecamp tasks, approve auto-stopped entries, and sync them back without switching tabs.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <TrackNowButton size="lg" className="w-full sm:w-auto" />
              <Button
                render={<a href={GITHUB_URL} />}
                variant="outline"
                size="lg"
                className="w-full sm:w-auto"
              >
                View on GitHub
              </Button>
            </div>
          </div>

          {/* preview: dashboard */}
          <div className="mx-auto mt-16 max-w-5xl">
            <Card className="relative overflow-hidden border shadow-2xl p-0">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-chart-2 to-chart-3" />
              <CardContent className="p-0">
                <div className="grid divide-y lg:grid-cols-12 lg:divide-x lg:divide-y-0">
                  <div className="col-span-1 hidden items-start border-r bg-sidebar p-4 lg:flex lg:flex-col lg:gap-3">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">BT</div>
                    <div className="mt-4 flex flex-col gap-2.5">
                      <div className="size-4 rounded bg-sidebar-primary/20" />
                      <div className="size-4 rounded bg-muted" />
                      <div className="size-4 rounded bg-muted" />
                    </div>
                  </div>
                  <div className="col-span-8 p-5 lg:p-6">
                    <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Source /</span>
                      <span className="font-semibold text-foreground">Basecamp</span>
                      <span className="ml-auto font-mono">Today</span>
                    </div>
                    <p className="mb-1 text-sm font-semibold">Your Projects</p>
                    <p className="mb-5 text-xs text-muted-foreground">Click a project to see your assigned tasks.</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {[
                        { name: "Marketing Landing Page", tasks: 8 },
                        { name: "Billing & Subscription", tasks: 12 },
                        { name: "Mobile App Redesign", tasks: 5 },
                        { name: "Internal Wiki", tasks: 3 },
                      ].map((project) => (
                        <div
                          key={project.name}
                          className="flex items-center gap-2.5 rounded-xl border bg-card p-3.5 text-sm font-medium"
                        >
                          <Briefcase className="size-3.5 text-muted-foreground" />
                          <span className="flex-1 truncate">{project.name}</span>
                          <Badge variant="secondary" className="font-mono text-[10px]">{project.tasks}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="col-span-3 flex flex-col gap-4 border-t bg-muted/30 p-5 lg:border-t-0">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Timer</p>
                      <div className="mt-2">
                        <LiveTimerPreview />
                      </div>
                    </div>
                    <div className="rounded-lg border bg-card p-3 text-xs">
                      <p className="font-medium">Marketing Landing Page</p>
                      <p className="mt-0.5 text-muted-foreground">Design review &amp; copy</p>
                    </div>
                    <Button className="mt-auto w-full">Stop Timer</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

        </section>

        {/* product previews */}
        <section className="container mx-auto px-4 pb-24 lg:px-8 lg:pb-32">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="outline" className="mb-4">Product Preview</Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Built for your daily workflow
            </h2>
            <p className="mt-4 text-muted-foreground">
              From configurable tracking rules to a clean history log, every screen is designed to save you time.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-2">
            <SettingsPreview />
            <HistoryPreview />
          </div>
        </section>

        {/* features */}
        <section className="border-t bg-muted/30 py-16 lg:py-20">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Everything you need to track time
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Built for teams that live in Basecamp but need a smarter, faster way to log hours.
              </p>
            </div>

            <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <Card key={title} className="border bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg">
                  <CardContent className="flex items-start gap-4 p-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">{title}</CardTitle>
                      <CardDescription className="text-xs leading-relaxed mt-1">{description}</CardDescription>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* integrations */}
        <section className="container mx-auto px-4 py-16 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Bring your work together
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Connect Basecamp and Google providers to turn calendar events and tasks into trackable items.
            </p>
          </div>

          <div className="mx-auto mt-8 flex max-w-xl flex-wrap items-center justify-center gap-3">
            {INTEGRATIONS.map(({ label, status, logo }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-card p-1.5 shadow-sm ring-1 ring-border">
                  <img src={logo} alt={label} className="size-full object-contain" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold">{label}</p>
                  <Badge variant="secondary" className="text-[10px]">{status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* cta */}
        <section className="container mx-auto px-4 pb-20 lg:px-8 lg:pb-24">
          <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border bg-card text-center shadow-xl">
            <div className="bg-gradient-to-r from-primary via-chart-2 to-chart-3 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground">
              Start tracking smarter today
            </div>
            <div className="px-6 py-10 sm:px-10">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Ready to stop guessing your hours?
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
                Log in with your Basecamp account and start tracking time the way it should have worked all along.
              </p>
              <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <TrackNowButton size="lg" className="w-full sm:w-auto" />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* footer */}
      <footer className="border-t bg-muted/30">
        <div className="container mx-auto px-4 py-10 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-xs">
                BT
              </div>
              <span className="text-sm font-semibold">Basetrack</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Built with React Router, Tauri, Prisma & PostgreSQL.
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <a href={`${GITHUB_URL}/issues`} className="hover:text-foreground">Report Bug</a>
              <Separator orientation="vertical" className="h-3" />
              <a href={`${GITHUB_URL}/issues`} className="hover:text-foreground">Request Feature</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
