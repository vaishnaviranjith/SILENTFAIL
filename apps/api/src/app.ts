import cors from 'cors';
import { existsSync } from 'node:fs';
import path from 'node:path';
import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import { analyzeProject, AnalysisInputError, AnalysisTimeoutError, NodeProcessExecutor, OpenAiCompatibleExplainer } from '@silentfail/core';
import { validateProject, type ProjectInput } from '@silentfail/shared';
import { loadDemoProject } from './demo.js';
import { RunStore } from './store.js';

const MAX_JSON = '250kb';

export interface AppOptions {
  store?: RunStore;
  analyze?: typeof analyzeProject;
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  const store = options.store ?? new RunStore();
  const runAnalysis = options.analyze ?? analyzeProject;
  const demoOnly = process.env['SILENTFAIL_DEMO_ONLY'] === 'true';
  // Workspace scripts run with apps/api as the working directory on Render,
  // while local commands may run from the repository root. Support both.
  const webDistCandidates = [
    path.resolve(process.cwd(), 'apps/web/dist'),
    path.resolve(process.cwd(), '../web/dist'),
  ];
  const webDist = webDistCandidates.find((candidate) => existsSync(path.join(candidate, 'index.html')))
    ?? webDistCandidates[0];
  const webIndex = path.join(webDist, 'index.html');

  app.disable('x-powered-by');
  const allowedOrigins = new Set([
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    ...(process.env['SILENTFAIL_WEB_ORIGINS'] ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  ]);
  app.use(cors({
    origin(origin, callback) {
      // Requests without an Origin header (for example curl or server-to-server)
      // are not browser cross-origin requests and remain supported.
      if (!origin) {
        callback(null, true);
        return;
      }
      callback(null, allowedOrigins.has(origin));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['content-type'],
  }));
  app.use(express.json({ limit: MAX_JSON, strict: true }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'silentfail-api', version: '1.0.0', ai: new OpenAiCompatibleExplainer().status() });
  });

  app.get('/api/demo', async (_req, res, next) => {
    try {
      res.json(await loadDemoProject());
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/history', (_req, res) => {
    res.json({ runs: store.list().map(toHistoryEntry) });
  });

  app.get('/api/runs/:runId', (req, res) => {
    const run = store.get(req.params.runId);
    if (!run) {
      res.status(404).json({ error: 'Run not found.', code: 'RUN_NOT_FOUND' });
      return;
    }
    res.json(run);
  });

  app.post('/api/analyze', async (req: Request, res: Response, next) => {
    const validation = validateProject(req.body);
    if (!validation.ok || !validation.project) {
      res.status(400).json({ error: 'Project payload is invalid.', code: 'INVALID_PROJECT', details: validation.errors });
      return;
    }
    try {
      // In the public preview, execute only the committed fixture. Never execute
      // source or tests supplied by an anonymous visitor.
      let project = validation.project;
      if (demoOnly) {
        const demo = await loadDemoProject();
        const matchesDemo = validation.project.isDemo
          && JSON.stringify(validation.project.files) === JSON.stringify(demo.files);
        if (!matchesDemo) {
          res.status(403).json({
            error: 'The public preview runs only the built-in demo. Download SILENTFAIL to analyze your own project.',
            code: 'PUBLIC_DEMO_ONLY',
          });
          return;
        }
        project = demo;
      }
      const run = await runAnalysis({
        project,
        executor: new NodeProcessExecutor(),
        ai: new OpenAiCompatibleExplainer(),
        label: demoOnly ? 'Public demo baseline' : (project.isDemo ? 'Demo baseline' : 'Project analysis'),
      });
      store.add(run);
      res.status(201).json(run);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/verify', async (req: Request, res: Response, next) => {
    if (demoOnly) {
      res.status(403).json({
        error: 'Suggested-test verification is disabled in the public preview. Download SILENTFAIL to run the complete workflow locally.',
        code: 'PUBLIC_DEMO_ONLY',
      });
      return;
    }
    const validation = validateProject(req.body?.project);
    if (!validation.ok || !validation.project) {
      res.status(400).json({ error: 'Project payload is invalid.', code: 'INVALID_PROJECT', details: validation.errors });
      return;
    }
    try {
      const run = await runAnalysis({
        project: validation.project,
        executor: new NodeProcessExecutor(),
        ai: new OpenAiCompatibleExplainer(),
        parentRunId: typeof req.body?.parentRunId === 'string' ? req.body.parentRunId : undefined,
        label: 'Verification after suggested test',
      });
      store.add(run);
      res.status(201).json(run);
    } catch (error) {
      next(error);
    }
  });

  // Serve the built frontend from the same origin in the hosted preview.
  if (existsSync(webIndex)) app.use(express.static(webDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    if (existsSync(webIndex)) return res.sendFile(webIndex);
    return next();
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found.', code: 'NOT_FOUND' });
  });

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof AnalysisTimeoutError) {
      res.status(408).json({ error: 'Analysis exceeded its time limit. Try a smaller project.', code: 'ANALYSIS_TIMEOUT' });
      return;
    }
    if (error instanceof AnalysisInputError) {
      res.status(400).json({ error: error.message, code: 'ANALYSIS_INPUT_ERROR', details: error.details });
      return;
    }
    if (error instanceof SyntaxError) {
      res.status(400).json({ error: 'Request body must be valid JSON.', code: 'INVALID_JSON' });
      return;
    }
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    console.error('[silentfail]', message);
    res.status(500).json({ error: 'Analysis failed safely. No server paths or secrets were returned.', code: 'INTERNAL_ERROR' });
  };
  app.use(errorHandler);
  return app;
}

function toHistoryEntry(run: AnalysisRunLike) {
  return {
    runId: run.runId,
    createdAt: run.createdAt,
    projectName: run.projectName,
    label: run.label,
    score: run.score.score,
    caught: run.score.caught,
    survived: run.score.survived,
    total: run.score.totalMutations,
    isDemo: run.isDemo,
  };
}

type AnalysisRunLike = Pick<ProjectInput, never> & {
  runId: string;
  createdAt: string;
  projectName: string;
  label: string;
  isDemo: boolean;
  score: { score: number; caught: number; survived: number; totalMutations: number };
};
