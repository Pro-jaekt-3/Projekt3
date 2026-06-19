// Client-side attempt-id persistence.
//
// BACKEND GAP (docs/FRONTEND-NOTES.md): there is NO "list my attempts" endpoint —
// only GET /assessment-attempts/:id (owner-scoped). The id is returned by
// POST /assessment-attempts/start and the submit call. Until the backend adds a
// list endpoint, the participant flow must remember its own attempt ids locally
// so "My results" can re-fetch them by id.
//
// TODO(hardening track): add GET /assessment-attempts (mine) on the backend and
// replace this localStorage shim with a real query. Tracked as a known gap.

const STORAGE_KEY = "projekt3.attempts";

// Map of assessmentId -> latest attemptId for the current browser/user.
type AttemptMap = Record<string, number>;

function read(): AttemptMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AttemptMap) : {};
  } catch {
    return {};
  }
}

function write(map: AttemptMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota / unavailable storage */
  }
}

/** Remember the attempt id created for an assessment (from start/submit response). */
export function rememberAttemptId(assessmentId: number | string, attemptId: number) {
  const map = read();
  map[String(assessmentId)] = attemptId;
  write(map);
}

/** The latest known attempt id for an assessment, if any. */
export function getAttemptId(assessmentId: number | string): number | null {
  return read()[String(assessmentId)] ?? null;
}

/** All remembered attempt ids (for "My results" until a backend list exists). */
export function getAllAttemptIds(): number[] {
  return Object.values(read());
}

export function forgetAttemptId(assessmentId: number | string) {
  const map = read();
  delete map[String(assessmentId)];
  write(map);
}
