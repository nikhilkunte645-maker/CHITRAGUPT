import { addDays } from "./money.js";

export interface StudentRef {
  id: number;
  name: string;
}

export interface LedgerCandidate {
  studentId: number;
  studentName: string;
  amount: number;
  date: string;
  intent: "payment" | "pending";
  confidence: number;
}

export interface ParseResult {
  candidates: LedgerCandidate[];
  needsStudentChoice: boolean;
  matches: StudentRef[];
  note: string | null;
}

const PENDING_WORDS = ["pending", "due", "unpaid", "owes", "yet to pay", "not paid"];
const PAYMENT_WORDS = ["paid", "received", "got", "credited", "fees"];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasWord(text: string, word: string): boolean {
  return new RegExp(`\\b${escapeRegex(word)}\\b`).test(text);
}

/** Lowercase, drop currency marks and "rs" tokens, collapse whitespace. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/₹/g, " ")
    .replace(/\brs\.?(?![a-z])/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function failure(matches: StudentRef[], note: string): ParseResult {
  return { candidates: [], needsStudentChoice: true, matches, note };
}

function parseInner(
  text: string,
  students: StudentRef[],
  today: string,
  oldestUnpaidAmount: ReadonlyMap<number, number>,
): ParseResult {
  const norm = normalize(text);
  if (norm.length === 0) return failure(students.slice(), "empty text");

  const matched = students.filter((s) => {
    const full = s.name.toLowerCase();
    const first = full.split(/\s+/)[0] ?? "";
    if (norm.includes(full)) return true;
    return first.length > 0 && hasWord(norm, first);
  });

  if (matched.length === 0) {
    return failure(students.slice(), "no student name found in text");
  }
  if (matched.length > 1) {
    return failure(matched.slice(), "more than one student matches; choose one");
  }

  const student = matched[0];
  const fullMatched = norm.includes(student.name.toLowerCase());
  const notes: string[] = [];
  let amount = 0;
  let amountFound = false;
  let rest = norm;

  const fraction = /(\d+)\s*\/\s*(\d+)/.exec(norm);
  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    rest = norm.replace(fraction[0], " ");
    amountFound = true;
    const unpaid = oldestUnpaidAmount.get(student.id);
    if (unpaid === undefined) {
      notes.push("fraction given; no unpaid invoice found");
    } else if (denominator > 0) {
      amount = Math.floor((unpaid * numerator) / denominator);
    } else {
      notes.push("fraction denominator is zero");
    }
  } else {
    const cleaned = rest.replace(/(\d),(?=\d)/g, "$1");
    const plain = /(\d+(?:\.\d+)?)(k?)\b/.exec(cleaned);
    if (plain) {
      const base = Number(plain[1]);
      const multiplier = plain[2] === "k" ? 1000 : 1;
      amount = Math.floor(Number((base * multiplier).toFixed(6)));
      amountFound = true;
    }
  }

  const isPending = PENDING_WORDS.some((w) => hasWord(norm, w));
  const isPayment = PAYMENT_WORDS.some((w) => hasWord(norm, w));
  let intent: "payment" | "pending" | null = null;
  if (isPending) intent = "pending";
  else if (isPayment || amountFound) intent = "payment";

  if (intent === null) {
    return failure(
      matched.slice(),
      "could not tell whether this is a payment or a pending amount",
    );
  }

  if (amount === 0 && notes.length === 0) notes.push("no amount given");

  const date = hasWord(norm, "yesterday") ? addDays(today, -1) : today;

  let confidence = fullMatched ? 0.9 : 0.7;
  if (amount === 0) confidence -= 0.3;
  confidence = Math.max(0.1, Math.round(confidence * 100) / 100);

  return {
    candidates: [
      {
        studentId: student.id,
        studentName: student.name,
        amount,
        date,
        intent,
        confidence,
      },
    ],
    needsStudentChoice: false,
    matches: [student],
    note: notes.length > 0 ? notes.join("; ") : null,
  };
}

/** Pure, never throws. Turns a free-text ledger note into a candidate payment. */
export function parseLedgerText(
  text: string,
  students: StudentRef[],
  today: string,
  oldestUnpaidAmount: ReadonlyMap<number, number>,
): ParseResult {
  try {
    return parseInner(text, students, today, oldestUnpaidAmount);
  } catch {
    return failure(students.slice(), "could not read this text");
  }
}
