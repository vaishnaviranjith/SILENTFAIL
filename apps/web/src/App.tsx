import { useEffect, useMemo, useState } from 'react';
import type { AnalysisRun, MutationResult, ProjectFile, ProjectInput } from '@silentfail/shared';

type View = 'landing' | 'dashboard' | 'analyze' | 'mutations' | 'detail' | 'suggested' | 'verify' | 'history' | 'settings' | 'about';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = (await response.json().catch(() => ({ error: 'The server returned an unreadable response.' }))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Request failed with HTTP ${response.status}`);
  return body;
}

export function scoreLabel(score: number) {
  return `${score.toFixed(1)}%`;
}

export function classForStatus(status: MutationResult['status']) {
  return status.toLowerCase().replace('_', '-');
}

function Icon({ name }: { name: 'arrow' | 'bolt' | 'check' | 'chevron' | 'clock' | 'code' | 'eye' | 'flask' | 'history' | 'info' | 'lock' | 'menu' | 'play' | 'refresh' | 'settings' | 'shield' | 'spark' | 'warning' }) {
  const paths: Record<string, string> = {
    arrow: 'M5 12h14m-6-6 6 6-6 6',
    bolt: 'M13 2 4 14h7l-1 8 9-12h-7l1-8Z',
    check: 'm5 12 4 4L19 6',
    chevron: 'm9 18 6-6-6-6',
    clock: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    code: 'm8 9-4 3 4 3m8-6 4 3-4 3m-3-9-2 12',
    eye: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    flask: 'M9 3h6m-5 0v6l-5.5 8.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-3.5L14 9V3m-5 10h6',
    history: 'M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5',
    info: 'M12 17v-5m0-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    lock: 'M6 10V7a6 6 0 0 1 12 0v3m-13 0h14v10H5V10Z',
    menu: 'M4 7h16M4 12h16M4 17h16',
    play: 'm9 6 9 6-9 6V6Z',
    refresh: 'M20 11a8 8 0 1 0 2 5m-2-5V5m0 6h-6',
    settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-3.5 1.5-1.1-1.6-2.8-1.8.6a7.8 7.8 0 0 0-1.5-.9L15.7 6h-3.2l-.3 1.8c-.5.2-1 .5-1.5.9l-1.8-.6-1.6 2.8L8.8 12a7 7 0 0 0 0 1l-1.5 1.1 1.6 2.8 1.8-.6c.5.4 1 .7 1.5.9l.3 1.8h3.2l.3-1.8c.5-.2 1-.5 1.5-.9l1.8.6 1.6-2.8-1.5-1.1a7 7 0 0 0 0-1Z',
    shield: 'M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3Z',
    spark: 'm12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4L12 3Zm6 12 .6 2.4L21 18l-2.4.6L18 21l-.6-2.4L15 18l2.4-.6L18 15Z',
    warning: 'M12 3 2.5 20h19L12 3Zm0 6v5m0 3h.01',
  };
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`brand ${compact ? 'compact' : ''}`}><span className="brand-mark"><span /></span><span>SILENT<span>FAIL</span></span></div>;
}

function StatusPill({ status }: { status: MutationResult['status'] }) {
  return <span className={`status-pill ${classForStatus(status)}`}><span className="status-dot" />{status.replace('_', ' ')}</span>;
}

function PhaseStrip({ run, currentView }: { run: AnalysisRun | null; currentView: View }) {
  const phases = [
    ['TESTS PASS', run?.baseline.ok ?? false],
    ['MUTATE', Boolean(run?.mutations.length)],
    ['SURVIVORS', Boolean(run?.score.survived || run?.score.noCoverage)],
    ['REPAIR', Boolean(run?.mutations.some((m) => m.suggestedTest))],
    ['VERIFY', currentView === 'verify' || Boolean(run?.parentRunId)],
  ] as const;
  return <div className="phase-strip" aria-label="Analysis progress">{phases.map(([label, done], index) => <div className={`phase ${done ? 'done' : ''}`} key={label}><span>{done ? <Icon name="check" /> : `0${index + 1}`}</span><b>{label}</b>{index < phases.length - 1 && <i />}</div>)}</div>;
}

function EmptyState({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) {
  return <div className="empty-state"><div className="empty-icon"><Icon name="eye" /></div><h3>{title}</h3><p>{body}</p>{action && onAction && <button className="button primary" onClick={onAction}>{action}<Icon name="arrow" /></button>}</div>;
}

export function App() {
  const [view, setView] = useState<View>('landing');
  const [project, setProject] = useState<ProjectInput | null>(null);
  const [run, setRun] = useState<AnalysisRun | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previousScore, setPreviousScore] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [history, setHistory] = useState<Array<{ runId: string; createdAt: string; projectName: string; label: string; score: number; caught: number; survived: number; total: number; isDemo: boolean }>>([]);

  const selected = useMemo(() => run?.mutations.find((mutation) => mutation.mutationId === selectedId) ?? null, [run, selectedId]);

  useEffect(() => {
    if (view === 'history') void loadHistory();
  }, [view]);

  async function loadDemo() {
    setError(null); setBusy('Loading deterministic demo…');
    try { const data = await api<ProjectInput>('/api/demo'); setProject(data); setRun(null); setView('analyze'); }
    catch (err) { setError(errorText(err)); }
    finally { setBusy(null); }
  }

  async function analyze() {
    if (!project) return;
    setError(null); setBusy('Running real mutations in an isolated process…'); setView('dashboard');
    try { const data = await api<AnalysisRun>('/api/analyze', { method: 'POST', body: JSON.stringify(project) }); setPreviousScore(null); setRun(data); setView('dashboard'); }
    catch (err) { setError(errorText(err)); setView('analyze'); }
    finally { setBusy(null); }
  }

  async function verify(nextProject: ProjectInput, parentRunId?: string) {
    setError(null); setBusy('Re-running the original and mutated suites…'); setView('verify');
    const before = run?.score.score ?? null;
    try { const data = await api<AnalysisRun>('/api/verify', { method: 'POST', body: JSON.stringify({ project: nextProject, parentRunId }) }); setPreviousScore(before); setProject(nextProject); setRun(data); setView('verify'); }
    catch (err) { setError(errorText(err)); }
    finally { setBusy(null); }
  }

  async function loadHistory() {
    try { const data = await api<{ runs: typeof history }>('/api/history'); setHistory(data.runs); }
    catch (err) { setError(errorText(err)); }
  }

  function openMutation(mutation: MutationResult) { setSelectedId(mutation.mutationId); setView('detail'); }

  function appendSuggestions(all: boolean) {
    if (!project || !run) return;
    const candidates = run.mutations.filter((mutation) => mutation.suggestedTest?.verified && (all || mutation.mutationId === selectedId));
    if (!candidates.length) return;
    const byPath = new Map(project.files.map((file) => [file.path, { ...file }]));
    const additions = new Map<string, string[]>();
    const imports = new Map<string, Set<string>>();
    for (const mutation of candidates) {
      const suggestion = mutation.suggestedTest!;
      const existing = byPath.get(suggestion.targetFile);
      if (!existing) continue;
      const lines = suggestion.code.split('\n');
      const requireLines = lines.filter((line) => line.startsWith('const ') && line.includes('require('));
      const body = lines.filter((line) => !line.startsWith('const ') && line.trim() !== '').join('\n');
      if (!imports.has(suggestion.targetFile)) imports.set(suggestion.targetFile, new Set());
      requireLines.forEach((line) => imports.get(suggestion.targetFile)!.add(line));
      if (!additions.has(suggestion.targetFile)) additions.set(suggestion.targetFile, []);
      additions.get(suggestion.targetFile)!.push(body);
    }
    const nextFiles = project.files.map((file) => {
      const extra = additions.get(file.path);
      if (!extra) return file;
      const requireLines = [...(imports.get(file.path) ?? [])].filter((line) => !file.content.includes(line));
      return { ...file, content: `${file.content.trimEnd()}\n\n${requireLines.join('\n')}${requireLines.length ? '\n\n' : ''}${extra.join('\n\n')}\n` };
    });
    void verify({ ...project, files: nextFiles }, run.runId);
  }

  const nav = (next: View) => { setView(next); setMobileNav(false); };

  return <div className="app-shell">
    <header className="topbar">
      <button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(!mobileNav)}><Icon name="menu" /></button>
      <button className="brand-button" onClick={() => nav('landing')}><Brand compact /></button>
      <div className="topbar-context"><span className="context-dot" />{project?.name ?? 'No project loaded'}<span className="slash">/</span><span>{run ? `${run.score.totalMutations} mutations analyzed` : 'Ready to inspect'}</span></div>
      <div className="topbar-actions"><span className="engine-status"><span /> deterministic engine online</span><button className="icon-button" aria-label="Settings" onClick={() => nav('settings')}><Icon name="settings" /></button></div>
    </header>
    <div className="workspace">
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="side-section"><span className="side-label">Workspace</span><SideButton icon="eye" label="Overview" active={view === 'landing' || view === 'dashboard'} onClick={() => nav(run ? 'dashboard' : 'landing')} /><SideButton icon="flask" label="Analyze project" active={view === 'analyze'} onClick={() => nav('analyze')} /><SideButton icon="history" label="Analysis history" active={view === 'history'} onClick={() => nav('history')} /></div>
        <div className="side-section"><span className="side-label">Understand</span><SideButton icon="code" label="Mutation results" active={view === 'mutations'} onClick={() => nav('mutations')} disabled={!run} /><SideButton icon="spark" label="Suggested tests" active={view === 'suggested'} onClick={() => nav('suggested')} disabled={!run} /><SideButton icon="refresh" label="Verification" active={view === 'verify'} onClick={() => nav('verify')} disabled={!run} /></div>
        <div className="side-bottom"><SideButton icon="settings" label="Settings & AI" active={view === 'settings'} onClick={() => nav('settings')} /><SideButton icon="info" label="How it works" active={view === 'about'} onClick={() => nav('about')} /><div className="safety-note"><Icon name="shield" /><div><b>Local-first by design</b><span>Source runs in an isolated process. No data is stored remotely.</span></div></div></div>
      </aside>
      <main className="main-content">
        {busy && <div className="busy-bar"><span className="busy-spinner" />{busy}<span className="busy-note">Deterministic execution · no AI required</span></div>}
        {error && <div className="error-banner"><Icon name="warning" /><span>{error}</span><button onClick={() => setError(null)}>Dismiss</button></div>}
        <PhaseStrip run={run} currentView={view} />
        {view === 'landing' && <Landing onDemo={loadDemo} onAnalyze={() => nav('analyze')} />}
        {view === 'analyze' && <AnalyzeView project={project} onDemo={loadDemo} onAnalyze={analyze} />}
        {view === 'dashboard' && <Dashboard run={run} onMutations={() => nav('mutations')} onSelect={openMutation} onVerify={() => nav('verify')} />}
        {view === 'mutations' && <MutationResults run={run} onSelect={openMutation} onBack={() => nav('dashboard')} />}
        {view === 'detail' && <MutationDetail run={run} mutation={selected} onBack={() => nav('mutations')} onSuggested={() => nav('suggested')} onAdd={() => appendSuggestions(false)} />}
        {view === 'suggested' && <SuggestedTests run={run} onSelect={openMutation} onAddAll={() => appendSuggestions(true)} />}
        {view === 'verify' && <Verification run={run} previousScore={previousScore} onDashboard={() => nav('dashboard')} />}
        {view === 'history' && <History runs={history} onLoad={(id) => { void api<AnalysisRun>(`/api/runs/${id}`).then((data) => { setRun(data); setProject({ name: data.projectName, isDemo: data.isDemo, files: data.files }); nav('dashboard'); }).catch((err) => setError(errorText(err))); }} />}
        {view === 'settings' && <Settings run={run} />}
        {view === 'about' && <About />}
      </main>
    </div>
  </div>;
}

function SideButton({ icon, label, active, disabled, onClick }: { icon: Parameters<typeof Icon>[0]['name']; label: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return <button className={`side-button ${active ? 'active' : ''}`} disabled={disabled} onClick={onClick}><Icon name={icon} /><span>{label}</span>{active && <i />}</button>;
}

function Landing({ onDemo, onAnalyze }: { onDemo: () => void; onAnalyze: () => void }) {
  return <section className="landing page-enter"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line" /> mutation intelligence for developers</div><h1>Find the failure<br /><em>nobody noticed.</em></h1><p className="hero-sub">Your tests can pass while your software is still wrong. SILENTFAIL mutates real code, runs your real tests, and shows you exactly what they failed to notice.</p><div className="hero-actions"><button className="button primary large" onClick={onDemo}><Icon name="play" /> Try the live demo</button><button className="button ghost large" onClick={onAnalyze}>Analyze a project <Icon name="arrow" /></button></div><div className="hero-proof"><span><Icon name="check" /> deterministic</span><span><Icon name="lock" /> isolated execution</span><span><Icon name="spark" /> AI optional</span></div></div><div className="hero-visual"><div className="visual-grid" /><div className="radar"><div className="radar-ring ring-one" /><div className="radar-ring ring-two" /><div className="radar-ring ring-three" /><div className="radar-sweep" /><span className="radar-core" /><span className="radar-label label-a">PASS</span><span className="radar-label label-b">BLIND SPOT</span><span className="radar-label label-c">VERIFY</span></div><div className="hero-card card-score"><span>mutation score</span><strong>—</strong><i>your run appears here</i></div><div className="hero-card card-survive"><span className="mini-alert">!</span><div><b>survived mutation</b><small>real result · not a fake metric</small></div></div></div><div className="pipeline"><div className="pipeline-heading"><span>THE LOOP</span><p>From passing tests to proven confidence.</p></div><div className="pipeline-items">{[['01', 'Your code', 'code'], ['02', 'Mutate', 'bolt'], ['03', 'Run tests', 'play'], ['04', 'Survive?', 'eye'], ['05', 'Explain', 'spark'], ['06', 'Verify', 'check']].map(([n, label, icon], index) => <div className="pipeline-item" key={label}><span className="pipeline-number">{n}</span><Icon name={icon as Parameters<typeof Icon>[0]['name']} /><b>{label}</b>{index < 5 && <i />}</div>)}</div></div></section>;
}

function AnalyzeView({ project, onDemo, onAnalyze }: { project: ProjectInput | null; onDemo: () => void; onAnalyze: () => void }) {
  return <section className="page page-enter"><PageHeading eyebrow="INPUT" title="Bring the code under scrutiny." body="Start with the deterministic demo. The API also accepts a small CommonJS JavaScript project. Your source is copied into a temporary sandbox and never modified in place." /><div className="input-layout"><div className="project-panel"><div className="panel-top"><div><span className="panel-kicker">PROJECT SOURCE</span><h3>{project?.name ?? 'No project loaded'}</h3></div><span className={`input-state ${project ? 'ready' : ''}`}><span />{project ? 'Ready to analyze' : 'Waiting for input'}</span></div>{project ? <FileList files={project.files} /> : <EmptyState title="Choose a starting point" body="The built-in demo is ready immediately and needs no API key, database, or cloud service." action="Load built-in demo" onAction={onDemo} />}<div className="panel-actions"><button className="button primary" disabled={!project} onClick={onAnalyze}><Icon name="flask" /> Run mutation analysis</button><button className="button ghost" onClick={onDemo}>Reset to demo</button></div></div><div className="support-panel"><div className="support-icon"><Icon name="shield" /></div><h3>What runs here?</h3><ul><li><b>JavaScript</b><span>ES2022 CommonJS modules</span></li><li><b>Test API</b><span>test() + expect() included</span></li><li><b>Isolation</b><span>fresh process, timeout, no network</span></li><li><b>Source of truth</b><span>actual test execution, not AI</span></li></ul><button className="text-link" onClick={() => undefined}>Supported input is documented <Icon name="arrow" /></button></div></div></section>;
}

function FileList({ files }: { files: ProjectFile[] }) {
  return <div className="file-list">{files.map((file) => <div className="file-row" key={file.path}><span className={`file-kind ${file.kind}`}><Icon name={file.kind === 'test' ? 'flask' : 'code'} /></span><span className="file-name">{file.path}</span><span className="file-meta">{file.content.split('\n').length} lines</span><span className="file-check"><Icon name="check" /></span></div>)}</div>;
}

function PageHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return <div className="page-heading"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{body}</p></div>;
}

function Dashboard({ run, onMutations, onSelect, onVerify }: { run: AnalysisRun | null; onMutations: () => void; onSelect: (mutation: MutationResult) => void; onVerify: () => void }) {
  if (!run) return <section className="page page-enter"><EmptyState title="Nothing has been analyzed yet" body="Load the demo to see a real mutation run, surviving code changes, and a verified repair." action="Open analyzer" onAction={onMutations} /></section>;
  const { score } = run;
  const survivors = run.mutations.filter((mutation) => mutation.status === 'SURVIVED' || mutation.status === 'NO_COVERAGE');
  return <section className="page page-enter"><div className="dashboard-heading"><div><span className="eyebrow">ANALYSIS / {run.isDemo ? 'DEMO PROJECT' : 'PROJECT'}</span><h2>{run.label}</h2><p>{run.baseline.message}</p></div><div className="heading-actions"><button className="button ghost" onClick={onMutations}>View all mutations <Icon name="arrow" /></button>{run.parentRunId && <button className="button primary" onClick={onVerify}>Verification report</button>}</div></div><div className="metric-grid"><Metric label="Tests" value={run.stats.testCount} sub="baseline suite" icon="flask" /><Metric label="Mutations" value={score.totalMutations} sub="generated & executed" icon="bolt" /><Metric label="Caught" value={score.caught} sub="tests noticed" tone="good" icon="check" /><Metric label="Survived" value={score.survived + score.noCoverage} sub="blind spots" tone="danger" icon="warning" /></div><div className="score-layout"><div className="score-panel"><div className="score-top"><div><span className="panel-kicker">MUTATION SCORE</span><div className="score-value">{scoreLabel(score.score)}</div><p>{score.caught} / {score.denominator || score.totalMutations} executable mutations caught</p></div><ScoreRing score={score.score} /></div><div className="score-bar"><span style={{ width: `${score.score}%` }} /></div><div className="score-legend"><span><i className="legend-good" /> caught <b>{score.caught}</b></span><span><i className="legend-bad" /> survived <b>{score.survived + score.noCoverage}</b></span><span><i className="legend-neutral" /> errors/timeouts <b>{score.errors + score.timeouts}</b></span></div></div><div className="flow-panel"><span className="panel-kicker">THE TRANSFORMATION</span><div className="flow-list"><FlowStep state="done" label="Tests pass" detail={`${run.stats.testCount} baseline tests`} /><FlowStep state={survivors.length ? 'alert' : 'done'} label={survivors.length ? 'Blind spot found' : 'No survivors'} detail={survivors.length ? `${survivors.length} mutation${survivors.length === 1 ? '' : 's'} survived` : 'Every mutant caught'} /><FlowStep state={run.mutations.some((m) => m.suggestedTest?.verified) ? 'ready' : 'pending'} label="Targeted test" detail={run.mutations.some((m) => m.suggestedTest?.verified) ? 'verified against a real mutant' : 'ready to generate'} /><FlowStep state={run.parentRunId ? 'done' : 'pending'} label="Verify improvement" detail={run.parentRunId ? `${scoreLabel(score.score)} after repair` : 'add a test and re-run'} /></div></div></div><div className="section-heading"><div><span className="panel-kicker">ATTENTION QUEUE</span><h3>{survivors.length} silent failure{survivors.length === 1 ? '' : 's'} found</h3></div><button className="text-link" onClick={onMutations}>Open mutation explorer <Icon name="arrow" /></button></div><div className="mutation-table">{survivors.slice(0, 5).map((mutation) => <MutationRow key={mutation.mutationId} mutation={mutation} onClick={() => onSelect(mutation)} />)}</div>{survivors.length > 5 && <button className="table-more" onClick={onMutations}>View {survivors.length - 5} more survivors <Icon name="chevron" /></button>}</section>;
}

function Metric({ label, value, sub, tone = '', icon }: { label: string; value: number; sub: string; tone?: string; icon: Parameters<typeof Icon>[0]['name'] }) {
  return <div className={`metric ${tone}`}><div className="metric-head"><span>{label}</span><Icon name={icon} /></div><strong>{value}</strong><small>{sub}</small></div>;
}

function ScoreRing({ score }: { score: number }) {
  const radius = 42; const circumference = 2 * Math.PI * radius; const offset = circumference - (score / 100) * circumference;
  return <div className="score-ring"><svg viewBox="0 0 100 100"><circle className="ring-track" cx="50" cy="50" r={radius} /><circle className="ring-progress" cx="50" cy="50" r={radius} style={{ strokeDasharray: circumference, strokeDashoffset: offset }} /></svg><span>{score.toFixed(0)}<small>%</small></span></div>;
}

function FlowStep({ state, label, detail }: { state: 'done' | 'alert' | 'ready' | 'pending'; label: string; detail: string }) {
  return <div className={`flow-step ${state}`}><span className="flow-icon">{state === 'done' ? <Icon name="check" /> : state === 'alert' ? <Icon name="warning" /> : state === 'ready' ? <Icon name="spark" /> : <span>0</span>}</span><div><b>{label}</b><small>{detail}</small></div></div>;
}

function MutationRow({ mutation, onClick }: { mutation: MutationResult; onClick: () => void }) {
  return <button className="mutation-row" onClick={onClick}><span className={`row-severity ${mutation.severity}`} /><span className="row-main"><b>{mutation.operatorLabel}</b><small>{mutation.file} <i>line {mutation.line}</i></small></span><span className="row-code"><code>{mutation.originalCode}</code><Icon name="arrow" /><code className="mutated-code">{mutation.mutatedCode}</code></span><span className="row-reason">{mutation.explanation.summary}</span><StatusPill status={mutation.status} /><Icon name="chevron" /></button>;
}

function MutationResults({ run, onSelect, onBack }: { run: AnalysisRun | null; onSelect: (mutation: MutationResult) => void; onBack: () => void }) {
  const [filter, setFilter] = useState<'ALL' | MutationResult['status']>('ALL');
  if (!run) return <section className="page page-enter"><EmptyState title="No mutation report yet" body="Run an analysis to populate this explorer." action="Back to overview" onAction={onBack} /></section>;
  const visible = run.mutations.filter((mutation) => filter === 'ALL' || mutation.status === filter);
  return <section className="page page-enter"><div className="dashboard-heading"><div><button className="back-link" onClick={onBack}><Icon name="arrow" /> overview</button><span className="eyebrow">MUTATION EXPLORER</span><h2>Every attempted change.</h2><p>Click a mutation to inspect its real test result, coverage signal, and repair path.</p></div><div className="explorer-score"><span>score</span><b>{scoreLabel(run.score.score)}</b></div></div><div className="filter-bar"><div className="filter-tabs">{(['ALL', 'SURVIVED', 'NO_COVERAGE', 'CAUGHT', 'ERROR', 'TIMEOUT'] as const).map((value) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value === 'ALL' ? `All ${run.mutations.length}` : `${value.replace('_', ' ')} ${run.mutations.filter((m) => m.status === value).length}`}</button>)}</div><span className="filter-note"><Icon name="shield" /> Executed in isolated copies</span></div><div className="mutation-table full-table">{visible.map((mutation) => <MutationRow key={mutation.mutationId} mutation={mutation} onClick={() => onSelect(mutation)} />)}</div>{visible.length === 0 && <EmptyState title="No mutations in this filter" body="Try another status filter." />}</section>;
}

function MutationDetail({ run, mutation, onBack, onSuggested, onAdd }: { run: AnalysisRun | null; mutation: MutationResult | null; onBack: () => void; onSuggested: () => void; onAdd: () => void }) {
  if (!run || !mutation) return <section className="page page-enter"><EmptyState title="Choose a mutation" body="Select a row from the mutation explorer to inspect the blind spot." action="Open explorer" onAction={onBack} /></section>;
  const testResults = mutation.testResults;
  const survived = mutation.status === 'SURVIVED' || mutation.status === 'NO_COVERAGE';
  return <section className="page page-enter detail-page"><div className="detail-top"><button className="back-link" onClick={onBack}><Icon name="arrow" /> mutation explorer</button><div className="detail-id"><span>{mutation.mutationId}</span><StatusPill status={mutation.status} /></div></div>{survived && <div className="failure-callout"><div className="callout-icon"><Icon name="warning" /></div><div><span className="eyebrow">SILENT FAILURE</span><h2>This change passed every existing test.</h2><p>{mutation.explanation.summary}</p></div><span className={`severity-stamp ${mutation.severity}`}>{mutation.severity} priority</span></div>}<div className="detail-grid"><div className="detail-main"><div className="metadata"><Meta label="FILE" value={mutation.file} /><Meta label="LINE" value={String(mutation.line)} /><Meta label="FUNCTION" value={mutation.functionName ? `${mutation.functionName}()` : 'top-level'} /><Meta label="OPERATOR" value={mutation.operatorLabel} /></div><div className="diff-panel"><div className="diff-head"><span className="panel-kicker">CODE CHANGE</span><span className="diff-description">{mutation.description}</span></div><div className="code-diff"><div className="code-line original"><span>−</span><small>{mutation.line}</small><code>{mutation.originalLine}</code></div><div className="code-line mutated"><span>+</span><small>{mutation.line}</small><code>{mutation.mutatedLine}</code></div></div></div><div className="explanation-panel"><div className="explanation-heading"><span className="panel-kicker">WHY DID IT {survived ? 'SURVIVE' : 'GET CAUGHT'}?</span><span className="confidence">{Math.round(mutation.explanation.confidence * 100)}% confidence · {mutation.explanation.source}</span></div><h3>{mutation.explanation.summary}</h3><p>{mutation.explanation.detail}</p><div className="impact"><Icon name="warning" /><div><b>Impact</b><span>{mutation.explanation.impact}</span></div></div></div></div><aside className="detail-side"><div className="side-card"><span className="panel-kicker">TEST RUN</span><div className="run-summary"><strong>{testResults.passed}<small>/{testResults.total}</small></strong><span>tests passed<br />against mutant</span></div><div className="test-list">{testResults.tests.slice(0, 6).map((test) => <div className={test.passed ? 'test-result pass' : 'test-result fail'} key={test.name}><Icon name={test.passed ? 'check' : 'warning'} /><span>{test.name}</span></div>)}</div></div><div className="side-card signal-card"><span className="panel-kicker">EXECUTION SIGNAL</span><div className="signal-row"><span>Statement reached</span><b className={mutation.status === 'NO_COVERAGE' ? 'no' : 'yes'}>{mutation.status === 'NO_COVERAGE' ? 'NO' : 'YES'}</b></div><div className="signal-row"><span>Distinguishing input</span><b className={mutation.suggestedTest?.verified ? 'yes' : 'no'}>{mutation.suggestedTest?.verified ? 'FOUND' : 'NOT FOUND'}</b></div><div className="signal-row"><span>Execution time</span><b>{mutation.executionTimeMs}ms</b></div></div>{survived && mutation.suggestedTest && <div className="side-card repair-card"><span className="panel-kicker">NEXT MOVE</span><h3>Patch the blind spot.</h3><p>A targeted test was found and verified against the real mutant.</p><button className="button primary full" onClick={onSuggested}>Inspect suggested test <Icon name="arrow" /></button><button className="button subtle full" onClick={onAdd}>Add this test & verify <Icon name="check" /></button></div>}</aside></div></section>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="meta"><span>{label}</span><b>{value}</b></div>;
}

function SuggestedTests({ run, onSelect, onAddAll }: { run: AnalysisRun | null; onSelect: (mutation: MutationResult) => void; onAddAll: () => void }) {
  if (!run) return <section className="page page-enter"><EmptyState title="No suggestions yet" body="Surviving mutations produce targeted tests after a real input-difference search." /></section>;
  const suggestions = run.mutations.filter((mutation) => mutation.suggestedTest);
  const verified = suggestions.filter((mutation) => mutation.suggestedTest?.verified);
  return <section className="page page-enter"><PageHeading eyebrow="REPAIR QUEUE" title="Tests that close the gap." body="Every suggestion below was derived from the original implementation, then executed against both the original and the mutated copy. Nothing is presented as verified until it passes that check." /><div className="suggestion-banner"><div className="banner-symbol"><Icon name="spark" /></div><div><b>{verified.length} verified targeted test{verified.length === 1 ? '' : 's'} ready</b><span>Applying all of them should turn the discovered executable blind spots into caught mutations.</span></div><button className="button primary" onClick={onAddAll} disabled={!verified.length}>Apply all & verify <Icon name="arrow" /></button></div><div className="suggestion-list">{suggestions.map((mutation) => <button className="suggestion-row" key={mutation.mutationId} onClick={() => onSelect(mutation)}><span className="suggestion-index">{mutation.mutationId.split('#')[1]}</span><span className="suggestion-copy"><b>{mutation.functionName ? `${mutation.functionName}()` : mutation.file}</b><small>{mutation.explanation.summary}</small></span><code>{mutation.suggestedTest?.inputs ?? 'No input found'}</code><span className={mutation.suggestedTest?.verified ? 'verified-tag' : 'review-tag'}>{mutation.suggestedTest?.verified ? 'verified' : 'review'}</span><Icon name="chevron" /></button>)}</div>{!suggestions.length && <EmptyState title="No targeted test was found" body="This run has no surviving mutations with an exported function that can be probed." />}<div className="disclosure"><Icon name="info" /><span>Suggestion generation is deterministic. AI, when configured, only rewrites explanations and never generates execution evidence.</span></div></section>;
}

function Verification({ run, previousScore, onDashboard }: { run: AnalysisRun | null; previousScore: number | null; onDashboard: () => void }) {
  if (!run) return <section className="page page-enter"><EmptyState title="No verification run yet" body="Add a verified suggestion from a mutation detail page to re-run the suite." /></section>;
  const improved = Boolean(run.parentRunId);
  return <section className="page page-enter verify-page"><div className="verify-hero"><div className={`verify-mark ${improved ? 'good' : 'pending'}`}><Icon name={improved ? 'check' : 'refresh'} /></div><span className="eyebrow">{improved ? 'VERIFICATION COMPLETE' : 'READY TO VERIFY'}</span><h2>{improved ? 'The suite noticed more.' : 'Re-run after repair.'}</h2><p>{improved ? 'The updated test suite was executed against fresh isolated mutants. Compare the score with the run that came before it.' : 'Add a targeted test from the repair queue to create a new verification run.'}</p>{improved && <div className="before-after"><div><span>BEFORE</span><strong>{previousScore === null ? '—' : scoreLabel(previousScore)}</strong></div><Icon name="arrow" /><div className="after"><span>NOW</span><strong>{scoreLabel(run.score.score)}</strong></div></div>}<button className="button primary" onClick={onDashboard}>Open verification dashboard <Icon name="arrow" /></button></div><div className="verification-grid"><div className="verify-card"><span className="panel-kicker">THIS RUN</span><div className="verify-number">{run.score.caught}<small> caught</small></div><p>out of {run.score.denominator || run.score.totalMutations} executable mutations</p></div><div className="verify-card"><span className="panel-kicker">BASELINE</span><div className="verify-number">{run.baseline.testRun.passed}<small> tests pass</small></div><p>{run.baseline.testRun.total} total tests in the suite</p></div><div className="verify-card"><span className="panel-kicker">ENGINE</span><div className="verify-number">{run.stats.analysisTimeMs}<small> ms</small></div><p>fresh deterministic analysis</p></div></div></section>;
}

function History({ runs, onLoad }: { runs: Array<{ runId: string; createdAt: string; projectName: string; label: string; score: number; caught: number; survived: number; total: number; isDemo: boolean }>; onLoad: (id: string) => void }) {
  return <section className="page page-enter"><PageHeading eyebrow="TIMELINE" title="Analysis history." body="Each run is kept in process memory while the API is running. The timeline makes improvement visible without adding a database." /><div className="history-list">{runs.map((item, index) => <button className="history-row" key={item.runId} onClick={() => onLoad(item.runId)}><span className={`history-marker ${index === 0 ? 'latest' : ''}`}><Icon name={item.score >= 90 ? 'check' : 'bolt'} /></span><span className="history-main"><b>{item.label}</b><small>{item.projectName} · {new Date(item.createdAt).toLocaleString()}</small></span><span className="history-score"><b>{scoreLabel(item.score)}</b><small>{item.caught}/{item.total} caught</small></span><span className="history-survive">{item.survived} survived</span><Icon name="chevron" /></button>)}</div>{!runs.length && <EmptyState title="No runs in this session" body="Run the built-in demo and your analysis will appear here." />}</section>;
}

function Settings({ run }: { run: AnalysisRun | null }) {
  const status = run?.aiStatus;
  return <section className="page page-enter"><PageHeading eyebrow="CONTROL PLANE" title="Settings & disclosure." body="SILENTFAIL keeps the deterministic engine in charge. Optional AI can improve wording, but it cannot change a status, score, severity, or execution fact." /><div className="settings-grid"><div className="settings-card"><div className="settings-card-head"><div className="setting-icon"><Icon name="spark" /></div><div><span className="panel-kicker">AI EXPLANATIONS</span><h3>{status?.enabled ? 'Optional provider enabled' : 'Deterministic mode active'}</h3></div><span className={`toggle ${status?.enabled ? 'on' : ''}`}><i /></span></div><p>{status?.detail ?? 'No AI provider is configured for this browser session. The complete analysis works without one.'}</p><div className="settings-divider" /><div className="setting-line"><span>Source of truth</span><b>Real test execution</b></div><div className="setting-line"><span>AI can change</span><b>Explanation wording only</b></div><div className="setting-line"><span>Secrets in browser</span><b>Never returned</b></div></div><div className="settings-card"><div className="settings-card-head"><div className="setting-icon green"><Icon name="shield" /></div><div><span className="panel-kicker">EXECUTION SAFETY</span><h3>Sandbox protections</h3></div></div><p>Every mutation is written to a new temporary workspace. The original project is kept in memory and never edited.</p><ul className="safety-list"><li><Icon name="check" /> wall-clock timeout + process cleanup</li><li><Icon name="check" /> output and heap limits</li><li><Icon name="check" /> blocked filesystem, network, and child processes</li><li><Icon name="check" /> path traversal and input-size validation</li></ul></div></div><div className="env-note"><Icon name="info" /><div><b>Configuration is server-side only</b><span>Use <code>SILENTFAIL_AI_API_KEY</code>, <code>SILENTFAIL_AI_BASE_URL</code>, and <code>SILENTFAIL_AI_MODEL</code> in the API environment. They are never included in API responses.</span></div></div></section>;
}

function About() {
  return <section className="page page-enter"><PageHeading eyebrow="THE IDEA" title="Tests passing is not the finish line." body="SILENTFAIL uses mutation testing to ask a sharper question: would your suite notice if the implementation changed?" /><div className="about-grid"><div className="about-story"><div className="story-step"><span>01</span><div><h3>Start with a green suite.</h3><p>We run the untouched project first. If the baseline is red, mutation results are not trusted.</p></div></div><div className="story-step"><span>02</span><div><h3>Make small, meaningful changes.</h3><p>The AST engine flips boundaries, comparisons, arithmetic, flags, constants, branches, and return values in isolated copies.</p></div></div><div className="story-step"><span>03</span><div><h3>Listen for silence.</h3><p>A survivor means every existing test still passed. Coverage tells us whether the code was never reached or simply never asserted.</p></div></div><div className="story-step"><span>04</span><div><h3>Close the exact gap.</h3><p>A deterministic input search compares original and mutant behavior, renders a targeted test, and verifies it before showing it as ready.</p></div></div></div><div className="architecture-card"><span className="panel-kicker">ARCHITECTURE</span><div className="arch-line"><span>React UI</span><i /><span>Express API</span><i /><span>Core pipeline</span></div><div className="arch-line"><span>AST mutations</span><i /><span>Node sandbox</span><i /><span>JSON result</span></div><div className="arch-note"><Icon name="lock" /> no database · no paid service · no API key required</div></div></div><div className="about-footer"><b>How SILENTFAIL is different</b><span>It combines deterministic mutation execution, coverage-aware explanations, and verified targeted test generation into one understandable local workflow. It does not claim to be the only mutation tester; it makes the silent moment legible.</span></div></section>;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Retry the operation.';
}
