/**
 * Anomaly pre-filter logic has been merged into the unified runEvaluation()
 * function in services/scoring/ruleEngine.ts.
 *
 * This file is kept as a shim so any stale imports don't break builds.
 * All new code should import from ruleEngine directly.
 */
export { runEvaluation as runAnomalyPreFilter } from '../scoring/ruleEngine'
