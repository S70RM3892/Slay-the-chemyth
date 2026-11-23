// Aggregates the five question files (DESIGN §2 export names: QUESTIONS, QUIZ_SETS).
import * as theory1 from './theory1.js';
import * as theory2 from './theory2.js';
import * as inorganic from './inorganic.js';
import * as organic from './organic.js';
import * as polymer from './polymer.js';

const FILES = [theory1, theory2, inorganic, organic, polymer];

export const QUESTIONS = FILES.flatMap((m) => (Array.isArray(m.QUESTIONS) ? m.QUESTIONS : []));
export const QUIZ_SETS = FILES.flatMap((m) => (Array.isArray(m.QUIZ_SETS) ? m.QUIZ_SETS : []));
