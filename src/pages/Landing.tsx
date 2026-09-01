import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Line, LineChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/Theme/ThemeToggle';
import { ParticleBackground } from '@/components/Landing/ParticleBackground';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import {
  ArrowRight, Bell, Check, Menu, X,
  KanbanSquare, TimerReset, Megaphone, Stamp, CalendarClock, BarChart3, KeyRound, Building2,
} from 'lucide-react';

const LOGO_URL =
  'https://res.cloudinary.com/dkk7zqgnz/image/upload/v1785424794/Loopix_final_ibeklc.png';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Comparison', href: '#comparison' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

const WEEKLY_OUTPUT_TREND = [
  { day: 'Mon', tasks: 24 },
  { day: 'Tue', tasks: 31 },
  { day: 'Wed', tasks: 28 },
  { day: 'Thu', tasks: 40 },
  { day: 'Fri', tasks: 46 },
  { day: 'Sat', tasks: 38 },
  { day: 'Sun', tasks: 52 },
];

const PAIN_POINTS = [
  {
    title: 'Tasks live in one app',
    body: 'Chat lives in another. Nobody remembers where the actual decision was made.',
  },
  {
    title: 'Time gets tracked in spreadsheets',
    body: 'Or worse — estimated from memory at invoice time. Billable hours quietly leak away.',
  },
  {
    title: 'Approvals get buried in email',
    body: '"Approved, I think?" is not an audit trail your clients or finance team should have to accept.',
  },
  {
    title: 'Content calendars live in Sheets',
    body: 'Disconnected from the tasks, assets, and people actually producing the work.',
  },
];

const FEATURES = [
  {
    icon: KanbanSquare,
    title: 'Projects & Kanban boards',
    body: 'Drag-and-drop boards, sprints, custom statuses and priorities — organized the way your team actually plans work.',
  },
  {
    icon: TimerReset,
    title: 'Honest time tracking',
    body: 'One-click timers with automatic idle detection — Kaam quietly checks in before logging hours nobody actually worked.',
  },
  {
    icon: Megaphone,
    title: 'Team-wide Announcements',
    body: 'A built-in channel for the whole org — @mentions, images, video, instant notifications. Skip the separate chat subscription.',
  },
  {
    icon: Stamp,
    title: 'Approvals, built in',
    body: 'Client and manager sign-off happens directly on the task — no more "approved somewhere in an email thread, probably."',
  },
  {
    icon: CalendarClock,
    title: 'Content Calendar & Media Library',
    body: 'Plan campaigns, attach assets, and keep every deliverable connected to the task that produced it — including Nepali (BS) calendar support.',
  },
  {
    icon: BarChart3,
    title: 'Reports & analytics',
    body: 'Team hours, sprint velocity, completion rates — know exactly where your team’s time actually goes.',
  },
  {
    icon: KeyRound,
    title: 'Roles & permissions',
    body: 'Admin, manager, and employee roles with project-level access — the right people get the right visibility, automatically.',
  },
  {
    icon: Building2,
    title: 'Dedicated team workspaces',
    body: 'Every organization gets its own workspace with a unique invite code — your projects, people, and data, never mixed with anyone else’s.',
  },
];

type ComparisonValue = boolean | 'partial';
interface ComparisonRow {
  label: string;
  kaam: ComparisonValue;
  pm: ComparisonValue;
  chat: ComparisonValue;
  tracker: ComparisonValue;
}

const COMPARISON_ROWS: ComparisonRow[] = [
  { label: 'Task & sprint boards', kaam: true, pm: true, chat: false, tracker: false },
  { label: 'Time tracking with idle detection', kaam: true, pm: false, chat: false, tracker: 'partial' },
  { label: 'Org-wide team chat', kaam: true, pm: false, chat: true, tracker: false },
  { label: 'Built-in client/manager approvals', kaam: true, pm: 'partial', chat: false, tracker: false },
  { label: 'Content calendar & media library', kaam: true, pm: false, chat: false, tracker: false },
  { label: 'Team-hours reporting', kaam: true, pm: 'partial', chat: false, tracker: true },
  { label: 'One monthly bill', kaam: true, pm: true, chat: true, tracker: true },
];

const STEPS = [
  {
    title: 'Create your workspace',
    body: 'Set up your organization in minutes — no IT ticket required.',
  },
  {
    title: 'Invite your whole team',
    body: 'Agencies, departments, client pods — bring everyone in, not just one seat.',
  },
  {
    title: 'Set up projects & boards',
    body: 'Import your existing structure or start from a template built for teams like yours.',
  },
  {
    title: 'Track, chat, approve, ship',
    body: 'Everything from here happens in one workspace — for everyone, at once.',
  },
];

const SECURITY_POINTS = [
  { title: 'Role-based access', body: 'Admins, managers, and employees each see exactly what they should — nothing more.' },
  { title: 'Encrypted by default', body: 'Data encrypted in transit and at rest, on infrastructure built for reliability.' },
  { title: 'Full audit trail', body: 'Every approval, status change, and assignment is tracked — automatically.' },
];

const PRICING_PLANS = [
  {
    name: 'Team',
    price: '$9',
    per: '/seat/mo',
    description: 'For small agencies and growing teams getting off spreadsheets and group chats.',
    cta: 'Start free',
    highlighted: false,
    features: [
      'Minimum 3 seats',
      'Unlimited projects & boards',
      'Time tracking with idle detection',
      'Team Announcements channel',
      'Basic reporting',
    ],
  },
  {
    name: 'Agency',
    price: '$19',
    per: '/seat/mo',
    description: 'For agencies and orgs running multiple clients, teams, or departments at once.',
    cta: 'Start free trial',
    highlighted: true,
    features: [
      'Everything in Team',
      'Client approval workflows',
      'Content Calendar & Media Library',
      'Advanced analytics & exports',
      'Role-based permissions',
      'Priority support',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    per: '',
    description: 'For larger organizations that need custom SLAs, security review, and rollout support.',
    cta: 'Talk to us',
    highlighted: false,
    features: [
      'Everything in Agency',
      'Custom onboarding & migration',
      'Dedicated support',
      'Custom contracts & SLAs',
      'Single sign-on (SSO)',
    ],
  },
];

const FAQS = [
  {
    q: 'Is Kaam only for software teams?',
    a: 'No. Kaam is built for any team that plans work, tracks time, and delivers to someone else — marketing and creative agencies, consulting firms, design studios, nonprofits, and internal departments all run on it today.',
  },
  {
    q: 'Can Kaam replace Slack for us?',
    a: 'For most teams, yes. The built-in Announcements channel covers org-wide updates, @mentions, images, and video. If you need dozens of specialized channels and a large app marketplace, you may still want a dedicated chat tool — but you won’t need it just to talk to your own team.',
  },
  {
    q: 'Is there a minimum team size?',
    a: 'Kaam is built and priced for teams, not individuals — plans start at a 3-seat minimum. If you’re a solo user, we’re honestly not the right tool for you, and we’d rather tell you that up front.',
  },
  {
    q: 'Can we migrate from ClickUp, Jira, or Asana?',
    a: 'Yes. Our Agency and Enterprise plans include migration support to help move existing projects, tasks, and history into Kaam without losing your team’s momentum.',
  },
  {
    q: 'How does time tracking avoid inflated hours?',
    a: 'Kaam’s timer detects prolonged mouse/keyboard inactivity and checks in before continuing to log time, and it won’t start from a phone by accident — so the hours in your reports reflect real work, not a timer someone forgot to stop.',
  },
  {
    q: 'Is our data secure?',
    a: 'Yes — role-based access control, encrypted data in transit and at rest, and a full approval/audit trail on every task. Enterprise plans include security review support.',
  },
];

const ComparisonMark = ({ value }: { value: ComparisonValue }) => {
  if (value === true) return <Check className="mx-auto h-4 w-4 text-chart-6" />;
  if (value === 'partial') return <span className="mx-auto block h-1.5 w-4 rounded-full bg-chart-4" />;
  return <X className="mx-auto h-4 w-4 text-muted-foreground/40" />;
};

const Landing = () => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 md:px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src={LOGO_URL} alt="Kaam logo" className="h-8 w-8 rounded-lg object-contain" />
            <span className="text-xl font-bold">Kaam</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <ThemeToggle compact />
            <Button variant="ghost" asChild>
              <Link to="/auth">Log in</Link>
            </Button>
            <Button asChild>
              <Link to="/auth?tab=signup">
                Get started free
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <button
            className="md:hidden"
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileNavOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileNavOpen && (
          <div className="border-t border-border/60 px-4 pb-4 pt-2 md:hidden">
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-lg px-2 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-2 flex items-center gap-2 border-t border-border/60 pt-3">
                <Button variant="outline" className="flex-1" asChild>
                  <Link to="/auth">Log in</Link>
                </Button>
                <Button className="flex-1" asChild>
                  <Link to="/auth?tab=signup">Get started</Link>
                </Button>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 animate-orb-float-slow rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 top-40 h-96 w-96 animate-orb-float rounded-full bg-brand-orange/20 blur-3xl" />
        <ParticleBackground />

        <div className="relative z-10 mx-auto max-w-[1400px] px-4 pb-20 pt-16 md:px-6 md:pt-24 lg:pb-28 lg:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Where agencies plan,{' '}
              <span className="bg-gradient-brand bg-clip-text text-transparent">track, and deliver</span> —
              together.
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Kaam replaces the scattered stack of task boards, time trackers, chat apps, and approval
              emails with one connected workspace — built from day one for agencies, organizations, and
              teams. If it's just you, we're not the right tool.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" className="w-full sm:w-auto" asChild>
                <Link to="/auth?tab=signup">
                  Start free — set up your team
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
                <a href="#features">See how it works</a>
              </Button>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              No credit card required · Built for teams of 3+ · Live in minutes
            </p>
          </div>

          {/* Product preview mock */}
          <div className="relative mx-auto mt-16 max-w-5xl">
            <div className="overflow-hidden rounded-2xl border bg-card shadow-stat">
              <div className="flex items-center gap-1.5 border-b bg-muted/40 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-chart-4/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-chart-6/60" />
                <span className="ml-3 text-xs font-medium text-muted-foreground">app.kaam.work/projects/agency-launch</span>
              </div>
              <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3 sm:p-6">
                {[
                  { title: 'To Do', dot: 'bg-muted-foreground', cards: [{ t: 'Client onboarding deck', p: 'high' }, { t: 'Brand asset audit', p: 'medium' }] },
                  { title: 'In Progress', dot: 'bg-chart-1', cards: [{ t: 'Homepage redesign', p: 'high' }, { t: 'Q3 content calendar', p: 'medium' }] },
                  { title: 'Done', dot: 'bg-chart-6', cards: [{ t: 'Social campaign brief', p: 'low' }, { t: 'Sprint retro notes', p: 'low' }] },
                ].map((col) => (
                  <div key={col.title} className="rounded-xl border bg-background/60 p-3">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <span className={cn('h-2 w-2 rounded-full', col.dot)} />
                      {col.title}
                    </div>
                    <div className="space-y-2">
                      {col.cards.map((c) => (
                        <div key={c.t} className="rounded-lg border bg-card p-2.5 shadow-sm">
                          <p className="text-sm font-semibold leading-tight">{c.t}</p>
                          <div className="mt-2 flex items-center justify-between">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[0.65rem] capitalize',
                                c.p === 'high' && 'border-destructive/30 bg-destructive/10 text-destructive',
                                c.p === 'medium' && 'border-chart-4/30 bg-chart-4/10 text-chart-4',
                                c.p === 'low' && 'border-chart-6/30 bg-chart-6/10 text-chart-6',
                              )}
                            >
                              {c.p}
                            </Badge>
                            <div className="flex -space-x-1.5">
                              <span className="h-5 w-5 rounded-full border-2 border-card bg-gradient-brand" />
                              <span className="h-5 w-5 rounded-full border-2 border-card bg-chart-5" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Floating stat cards */}
            <div className="absolute -left-6 -top-6 hidden w-52 rounded-xl border bg-card p-3 shadow-stat animate-fade-in sm:block">
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Tasks completed this week</p>
              <div className="h-16 cursor-crosshair">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={WEEKLY_OUTPUT_TREND} margin={{ top: 4, right: 6, left: 6, bottom: 0 }}>
                    <Tooltip
                      cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 11,
                        padding: '4px 8px',
                      }}
                      labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                      formatter={(value: number) => [`${value} tasks`, '']}
                    />
                    <Line
                      type="linear"
                      dataKey="tasks"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 2.5, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="absolute -bottom-6 -right-6 hidden rounded-xl border bg-card p-3 shadow-stat animate-fade-in sm:block">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">New announcement</p>
                  <p className="text-sm font-bold">Sprint kickoff at 10am</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-[1400px] px-4 py-20 md:px-6 lg:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Your team shouldn't need six tabs open just to get through Monday.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Most teams don't choose tool sprawl on purpose — it just accumulates, one "quick fix" app at a
            time.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2">
          {PAIN_POINTS.map((p) => (
            <div key={p.title} className="border-l-2 border-border pl-5">
              <h3 className="font-semibold">{p.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-lg font-semibold">
          Kaam brings it together — one login, one workspace, one source of truth.
        </p>
      </section>

      {/* Features */}
      <section id="features" className="border-t bg-muted/20 py-20 lg:py-28">
        <div className="mx-auto max-w-[1400px] px-4 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything your team needs to plan, work, and ship
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Kaam isn't a single-purpose tool with ten integrations bolted on. It's built end-to-end, so
              every part of it already knows about the others.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-x-10 gap-y-7 md:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="group border-t border-border pt-5">
                <div className="flex items-center gap-2.5">
                  <f.icon className="h-5 w-5 shrink-0 text-muted-foreground transition-colors duration-300 group-hover:text-primary" strokeWidth={1.75} />
                  <h3 className="text-lg font-bold tracking-tight">{f.title}</h3>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section id="comparison" className="mx-auto max-w-[1400px] px-4 py-20 md:px-6 lg:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Stop stitching tools together</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Most teams patch together a project-management tool, a chat app, and a separate time tracker
            to do what Kaam does natively — each one billed separately, none of them talking to each
            other.
          </p>
        </div>

        <div className="mt-12 overflow-x-auto">
          <table className="mx-auto w-full max-w-4xl border-collapse overflow-hidden rounded-2xl border bg-card text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="p-4 text-left font-semibold">Capability</th>
                <th className="p-4 text-center font-bold text-primary">Kaam</th>
                <th className="p-4 text-center font-semibold text-muted-foreground">Project & task tools</th>
                <th className="p-4 text-center font-semibold text-muted-foreground">Team chat apps</th>
                <th className="p-4 text-center font-semibold text-muted-foreground">Time trackers</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row, i) => (
                <tr key={row.label} className={cn('border-b last:border-b-0', i % 2 === 1 && 'bg-muted/20')}>
                  <td className="p-4 font-medium">{row.label}</td>
                  <td className="p-4 text-center"><ComparisonMark value={row.kaam} /></td>
                  <td className="p-4 text-center"><ComparisonMark value={row.pm} /></td>
                  <td className="p-4 text-center"><ComparisonMark value={row.chat} /></td>
                  <td className="p-4 text-center"><ComparisonMark value={row.tracker} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Built for teams */}
      <section className="border-y bg-muted/20 py-20 lg:py-28">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-12 px-4 md:px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Kaam is built for teams. Full stop.</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              No solo-plan loopholes, no per-feature paywalls that punish you for growing. Kaam is priced
              and designed around organizations — agencies with clients, departments with headcount,
              groups that ship work together.
            </p>
            <p className="mt-4 text-base text-muted-foreground">
              That means a multi-project structure across your whole organization, roles that are set once
              and apply everywhere, team-hours reporting your finance team can actually use, and group
              approvals instead of one-off email chains.
            </p>
          </div>

          <div className="relative">
            <div className="rounded-2xl border bg-card p-6 shadow-stat">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-bold">Team status</h3>
                <Badge variant="outline" className="border-chart-6/40 bg-chart-6/10 text-chart-6">Live</Badge>
              </div>
              <div className="space-y-3">
                {[
                  { name: 'Sagar Gurung', role: 'Design Lead', hours: '6.2h', working: true, avatar: '/team/sagar-gurung.png' },
                  { name: 'Puskar Simkhada', role: 'Project Manager', hours: '4.8h', working: true, avatar: '/team/puskar-simkhada.png' },
                  { name: 'Sandesh Gadal', role: 'Developer', hours: '2.1h', working: false, avatar: '/team/sandesh-gadal.png' },
                ].map((m) => (
                  <div key={m.name} className="flex items-center gap-3">
                    <span className="relative inline-flex h-9 w-9 shrink-0">
                      <img
                        src={m.avatar}
                        alt=""
                        className="h-9 w-9 rounded-full object-cover"
                      />
                      {m.working && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-chart-6" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{m.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.role}</p>
                    </div>
                    <span className="font-mono text-xs font-bold">{m.hours}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-[1400px] px-4 py-20 md:px-6 lg:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            From signup to shipping in under 10 minutes
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">No consultants, no six-week rollout plan.</p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <div key={step.title}>
              <p className="font-mono text-4xl font-extrabold text-muted-foreground/25">
                {String(i + 1).padStart(2, '0')}
              </p>
              <h3 className="mt-2 font-bold">{step.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Security */}
      <section className="border-y bg-muted/20 py-16">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-8 px-4 sm:grid-cols-3 md:px-6">
          {SECURITY_POINTS.map((item) => (
            <div key={item.title}>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-[1400px] px-4 py-20 md:px-6 lg:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Simple, team-based pricing</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Priced per seat, built for teams — the more your organization grows, the more it pays off.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {PRICING_PLANS.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                'relative flex flex-col rounded-2xl border bg-card p-6',
                plan.highlighted && 'border-primary shadow-stat lg:-translate-y-2',
              )}
            >
              {plan.highlighted && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                  Most teams choose this
                </Badge>
              )}
              <h3 className="text-lg font-bold">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold">{plan.price}</span>
                {plan.per && <span className="text-sm text-muted-foreground">{plan.per}</span>}
              </div>
              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-chart-6" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button className="mt-6" variant={plan.highlighted ? 'default' : 'outline'} asChild>
                <Link to="/auth?tab=signup">{plan.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Pricing shown is illustrative and subject to change. All plans require a minimum of 3 seats —
          Kaam is built for teams, not individuals.
        </p>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t bg-muted/20 py-20 lg:py-28">
        <div className="mx-auto max-w-3xl px-4 md:px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Frequently asked questions</h2>
          </div>
          <Accordion type="single" collapsible className="mt-10">
            {FAQS.map((faq) => (
              <AccordionItem key={faq.q} value={faq.q}>
                <AccordionTrigger className="text-left text-base font-semibold">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-[1400px] px-4 py-20 md:px-6 lg:py-28">
        <div className="relative overflow-hidden rounded-3xl bg-primary p-10 text-center text-primary-foreground sm:p-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to bring your team into one workspace?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg opacity-90">
            Set up your organization, invite your team, and see everything connect — free to start, built
            to scale with you.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" variant="secondary" className="w-full sm:w-auto" asChild>
              <Link to="/auth?tab=signup">
                Create your workspace
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 sm:w-auto" asChild>
              <Link to="/auth">Talk to us</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="mx-auto max-w-[1400px] px-4 md:px-6">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-5">
            <div className="col-span-2 sm:col-span-1">
              <Link to="/" className="flex items-center gap-2">
                <img src={LOGO_URL} alt="Kaam logo" className="h-7 w-7 rounded-lg object-contain" />
                <span className="text-lg font-bold">Kaam</span>
              </Link>
              <p className="mt-3 text-sm text-muted-foreground">
                One workspace for how agencies and teams actually work.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-bold">Product</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground">Features</a></li>
                <li><a href="#comparison" className="hover:text-foreground">Comparison</a></li>
                <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
                <li><a href="#faq" className="hover:text-foreground">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold">Company</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><Link to="/auth" className="hover:text-foreground">Log in</Link></li>
                <li><Link to="/auth?tab=signup" className="hover:text-foreground">Get started</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold">Support</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><Link to="/recover-workspace" className="hover:text-foreground">Recover a deleted workspace</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold">Legal</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>Privacy Policy</li>
                <li>Terms of Service</li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t pt-6 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Kaam by{' '}
            <a
              href="https://loopixcreations.com.np"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground hover:underline"
            >
              Loopix Creations
            </a>
            . All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
