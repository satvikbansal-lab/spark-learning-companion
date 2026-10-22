// Tutoring scenarios A-H: is Sparky teaching, not just answering? Each has required concepts (`must`),
// forbidden behaviour (`not`), and is also scored on the 10-dimension rubric in maths-eval.mjs.
const cases = require('./maths-cases.js');
const hist = id => cases.find(c => c.id === id).history;
const fractionsTurn = [['user', 'What is 1/2 + 1/3?'], ['model', 'Make the denominators the same: \\(\\frac{1}{2} = \\frac{3}{6}\\) and \\(\\frac{1}{3} = \\frac{2}{6}\\). Then \\(\\frac{3}{6} + \\frac{2}{6} = \\frac{5}{6}\\).\n\n**Answer:** \\(\\frac{5}{6}\\)']];
const firstExplanation = 'The denominator tells you what size the parts are. You can only add parts directly when they are the same size, so we rewrite each fraction with a common denominator, using equivalent fractions, and then add the numerators while keeping the denominator.';

module.exports = [
  { id: 'tutor-A', scenario: 'A: does not understand fractions', history: fractionsTurn, q: "I don't understand why the denominators need to be the same.",
    must: [/size|equal (parts|pieces)|same[- ]sized?|pieces|slices/i, /equivalent|3\s*\/\s*6|\\frac\{3\}\{6\}|2\s*\/\s*6|\\frac\{2\}\{6\}/i, /5\s*\/\s*6|\\frac\{5\}\{6\}/], not: [] },
  { id: 'tutor-B', scenario: 'B: student makes a mistake', q: 'I got 2³ × 2⁴ = 2¹². Is that right?',
    must: [/\badd\b|adding|added/i, /2\s*(×|\\times|·|\\cdot)\s*2\s*(×|\\times|·|\\cdot)\s*2|seven 2s|7 twos|(2 × ){2,}|expand|written out|write (it )?out/i, /2\s*\^\s*\{?\(?7|2⁷|128/, /try|your turn|👉/i],
    not: [/\b(yes|correct|that'?s right)\b[^.\n]*2\s*\^\s*\{?12/i] },
  { id: 'tutor-C', scenario: 'C: stuck in algebra', history: hist('ctx-4'), q: 'Why did you subtract 4x from both sides?',
    must: [/4x/, /balance|scale|see-?saw|weighing/i, /both sides|same (thing|amount)|each side|from the (left|right) (side )?too|keep (it|the scale|both) (balanced|equal)/i], not: [] },
  { id: 'tutor-D', scenario: 'D: asks for a simpler explanation', history: [['user', 'Why do we need a common denominator to add fractions?'], ['model', firstExplanation]], q: "I still don't understand. Explain like I'm 10.",
    must: [/pizza|roti|chocolate|cake|slices?|pieces?|paratha|ladoo|apple|bar/i], not: [], differentFrom: firstExplanation },
  { id: 'tutor-E', scenario: 'E: wants the answer directly', q: 'Just give me the full solution, I have an exam tomorrow: solve 4(x − 3) = 2x + 10',
    expect: ['11'], must: [/\*\*Answer:?\*\*/i], not: [/what have you tried|what do you think the first step|can you try first/i] },
  { id: 'tutor-F', scenario: 'F: wants to try independently', q: "I want to try 5x − 7 = 3x + 9 myself. Just give me a hint, don't tell me the answer.",
    must: [/hint|try|first|start/i], not: [/x\s*=\s*8\b/, /\*\*Answer:?\*\*/i] },
  { id: 'tutor-G', scenario: 'G: follow-up about an earlier step', history: hist('ctx-1'), q: 'Why did you divide by 2 in the previous step?',
    must: [/2x\s*=\s*12|2x/i, /both sides|balance|alone|by itself|undo|isolate/i], not: [] },
  { id: 'tutor-H', scenario: 'H: misconception', q: 'I think 0.5 is smaller than 0.25 because 5 is smaller than 25.',
    must: [/0\.50?\s*(is\s+)?(actually\s+|really\s+)?(greater|bigger|larger|more)|0\.25\s*(is\s+)?(actually\s+|really\s+)?(smaller|less)|0\.50?\s*>\s*0\.25/i, /place value|tenths|hundredths|0\.50|50\s*(\/|out of)\s*100|half|\\frac\{1\}\{2\}/i, /try|which is (bigger|greater|larger)|👉/i], not: [] }
];
