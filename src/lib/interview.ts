/**
 * Dynamic qualification interview logic (Blueprint §5).
 *
 * Questions live in the `QualificationQuestion` config table (not hardcoded).
 * Some questions are *branch targets* — only shown when a prior answer triggers
 * them via `branchRules` (e.g. NAFDAC "no" → ask for the registration timeline).
 */

export type QuestionLike = {
  key: string;
  text: string;
  category: string;
  order: number;
  branchRules: unknown;
};

export type ActiveQuestion = {
  key: string;
  text: string;
  category: string;
  answer: string;
  /** true when this question was surfaced by a branch rule rather than the base flow */
  triggered: boolean;
};

/** Normalize `branchRules` JSON into `{ matchValue: [targetKey, …] }`. */
function parseBranchRules(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(v)) out[k] = v.map(String);
  }
  return out;
}

/** A branch fires when the answer contains the rule's match value (case-insensitive). */
export function answerMatches(answer: string, matchValue: string): boolean {
  return answer.trim().toLowerCase().includes(matchValue.trim().toLowerCase());
}

/**
 * Given the full question config and the answers gathered so far, return the
 * ordered list of questions that should currently be visible — base questions
 * plus any branch targets whose trigger conditions are met.
 */
export function buildActiveQuestions(
  questions: QuestionLike[],
  answers: Map<string, string>,
): ActiveQuestion[] {
  const sorted = [...questions].sort((a, b) => a.order - b.order);
  const byKey = new Map(sorted.map((q) => [q.key, q]));

  // Any key referenced as a branch target is hidden until triggered.
  const targetKeys = new Set<string>();
  for (const q of sorted) {
    for (const targets of Object.values(parseBranchRules(q.branchRules))) {
      targets.forEach((t) => targetKeys.add(t));
    }
  }

  const result: ActiveQuestion[] = [];
  const added = new Set<string>();

  const push = (q: QuestionLike, triggered: boolean) => {
    if (added.has(q.key)) return;
    added.add(q.key);
    result.push({
      key: q.key,
      text: q.text,
      category: q.category,
      answer: answers.get(q.key) ?? "",
      triggered,
    });
  };

  for (const q of sorted) {
    if (targetKeys.has(q.key)) continue; // surfaced only via a trigger
    push(q, false);

    const answer = answers.get(q.key);
    if (!answer) continue;
    for (const [matchValue, targets] of Object.entries(parseBranchRules(q.branchRules))) {
      if (!answerMatches(answer, matchValue)) continue;
      for (const tKey of targets) {
        const tq = byKey.get(tKey);
        if (tq) push(tq, true);
      }
    }
  }

  return result;
}
