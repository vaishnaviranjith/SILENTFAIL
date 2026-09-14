import type { AnalysisRun } from '@silentfail/shared';
import { LIMITS } from '@silentfail/shared';

/** Small process-local history store: deliberately no database for a hackathon demo. */
export class RunStore {
  private readonly runs: AnalysisRun[] = [];

  add(run: AnalysisRun): void {
    this.runs.unshift(run);
    if (this.runs.length > LIMITS.maxStoredRuns) this.runs.length = LIMITS.maxStoredRuns;
  }

  list(): AnalysisRun[] {
    return [...this.runs];
  }

  get(runId: string): AnalysisRun | undefined {
    return this.runs.find((run) => run.runId === runId);
  }
}
