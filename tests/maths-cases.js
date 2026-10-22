// Class 8 maths benchmark (plus common Class 6-10 topics), graded by tests/maths-eval.mjs.
// Every numeric expectation is written by hand AND recomputed independently in tests/verify_expected.py
// (`py` = Python/sympy expression). Fields:
//   expect     values that must all appear in the "**Answer:**" line (exact, or to the decimals written)
//   expr       expected algebraic expression; the answer line must be equivalent (checked at many points)
//   unit       regex the answer line must contain (units, %)
//   must/not   regexes over the whole reply (concepts that must / must not appear)
//   history    earlier turns, so follow-ups can be tested
//   modes      failure modes this case is designed to expose (A-T, see maths-eval.mjs)
const C = (cat, id, q, o = {}) => Object.assign({ cat, id, q }, o);
const ctxSolve = [['user', 'Solve 2x + 5 = 17'], ['model', '**Given:** \\(2x + 5 = 17\\). **To find:** \\(x\\).\n\n1. Subtract 5 from both sides: \\(2x + 5 - 5 = 17 - 5\\), so \\(2x = 12\\).\n2. Divide both sides by 2: \\(\\frac{2x}{2} = \\frac{12}{2}\\), so \\(x = 6\\).\n\n**Check:** \\(2(6) + 5 = 17\\) ✓\n\n**Answer:** \\(x = 6\\)\n\n👉 Try this one: \\(3x + 4 = 25\\)']];
const ctxBrackets = [['user', 'Solve 3(2x − 5) = 4x + 7'], ['model', '1. Open the bracket: \\(6x - 15 = 4x + 7\\).\n2. Subtract \\(4x\\) from both sides: \\(2x - 15 = 7\\).\n3. Add 15 to both sides: \\(2x = 22\\).\n4. Divide both sides by 2: \\(x = 11\\).\n\n**Check:** \\(3(22 - 5) = 51\\) and \\(4(11) + 7 = 51\\) ✓\n\n**Answer:** \\(x = 11\\)']];
const ctxFractions = [['user', 'What is 1/2 + 1/3?'], ['model', 'Make the denominators the same: \\(\\frac{1}{2} = \\frac{3}{6}\\) and \\(\\frac{1}{3} = \\frac{2}{6}\\). Then \\(\\frac{3}{6} + \\frac{2}{6} = \\frac{5}{6}\\).\n\n**Answer:** \\(\\frac{5}{6}\\)']];
const ctxCommonDen = [['user', 'Why do we need a common denominator to add fractions?'], ['model', 'The denominator tells you what size the parts are. You can only add parts directly when they are the same size, so we rewrite each fraction with a common denominator, using equivalent fractions, and then add the numerators while keeping the denominator.']];

module.exports = [
  // 1. Integers and rational numbers
  C('integers', 'int-1', 'What is (−12) + 7 − (−5)?', { expect: ['0'], py: '-12 + 7 - (-5)', modes: ['E'] }),
  C('integers', 'int-2', 'Evaluate (−3) × (−4) × (−2).', { expect: ['-24'], py: '(-3)*(-4)*(-2)', modes: ['E'] }),
  C('integers', 'int-3', 'What is (−48) ÷ 6 + 3 × (−2)?', { expect: ['-14'], py: 'F(-48,6) + 3*(-2)', modes: ['E'] }),
  C('integers', 'rat-1', 'Calculate −3/4 + 5/8 and explain the common-denominator method.', { expect: ['-1/8'], py: 'F(-3,4)+F(5,8)', must: [/common denominator|same denominator|LCM|equivalent/i], modes: ['E', 'F'] }),
  C('integers', 'rat-2', 'What is 2/3 − 5/6?', { expect: ['-1/6'], py: 'F(2,3)-F(5,6)', modes: ['E', 'F'] }),
  C('integers', 'rat-3', 'Find the additive inverse and the multiplicative inverse of −7/9.', { expect: ['7/9', '-9/7'], py: '[-F(-7,9), 1/F(-7,9)]', modes: ['E'] }),
  C('integers', 'rat-4', 'Find one rational number between 1/4 and 1/3.', { between: ['1/4', '1/3'], modes: ['A'] }),
  // 2. Fractions, decimals and recurring decimals
  C('fractions', 'fr-1', 'What is 3/4 divided by 1/2?', { expect: ['3/2'], py: 'F(3,4)/F(1,2)', modes: ['F'] }),
  C('fractions', 'fr-2', 'Simplify 18/24 to its lowest terms.', { expect: ['3/4'], py: 'F(18,24)', must: [/\b6\b|HCF|GCD|common factor/i], modes: ['F'] }),
  C('fractions', 'fr-3', 'What is 2 1/3 + 1 3/4? Give the answer as a mixed number.', { expect: ['49/12'], py: 'F(7,3)+F(7,4)', modes: ['F'] }),
  C('fractions', 'fr-4', 'Convert 0.375 into a fraction in its lowest terms.', { expect: ['3/8'], py: 'F(375,1000)', modes: ['F'] }),
  C('fractions', 'dec-1', 'What is 0.6 × 0.25 + 1.35?', { expect: ['1.5'], py: 'F(6,10)*F(25,100)+F(135,100)', modes: ['A'] }),
  C('fractions', 'rec-1', 'Express 0.3333… (3 recurring) as a fraction.', { expect: ['1/3'], py: 'F(1,3)', modes: ['F'] }),
  C('fractions', 'rec-2', 'Express 0.454545… (45 recurring) as a fraction in its lowest terms.', { expect: ['5/11'], py: 'F(45,99)', modes: ['F'] }),
  C('fractions', 'dec-2', 'Which is greater, 0.7 or 0.65, and by how much?', { expect: ['0.7', '0.05'], py: '[F(7,10), F(7,10)-F(65,100)]', modes: ['D'] }),
  C('fractions', 'adv-equiv', 'Simplify 4/8 + 2/4.', { expect: ['1'], py: 'F(4,8)+F(2,4)', modes: ['F'] }),
  // 3. Exponents and powers
  C('exponents', 'exp-1', 'Simplify 2³ × 2⁴ and write the answer as a power of 2.', { expect: ['128'], py: '2**3 * 2**4', must: [/2\s*\^\s*\{?\(?7|2⁷/], modes: ['A'] }),
  C('exponents', 'exp-2', 'Evaluate (−2)³ × (−2)².', { expect: ['-32'], py: '(-2)**3 * (-2)**2', modes: ['E'] }),
  C('exponents', 'exp-3', 'Simplify (5²)³ ÷ 5⁴.', { expect: ['25'], py: 'F((5**2)**3, 5**4)', modes: ['A'] }),
  C('exponents', 'exp-4', 'Evaluate 2⁻³.', { expect: ['1/8'], py: 'F(1, 2**3)', modes: ['E', 'F'] }),
  C('exponents', 'exp-5', 'Find the value of (3/4)⁰ + 4⁻¹.', { expect: ['5/4'], py: 'F(3,4)**0 + F(1,4)', modes: ['A'] }),
  C('exponents', 'exp-6', 'Write 0.000045 in standard form.', { expect: ['0.000045'], py: 'F(45, 1000000)', must: [/4\.5\s*(×|\\times|x)\s*10/i], modes: ['G'] }),
  C('exponents', 'exp-7', 'Find x if 3^x × 3² = 3⁷.', { expect: ['5'], py: '7-2', modes: ['A'] }),
  // 4. Squares, square roots, cubes, cube roots
  C('roots', 'sq-1', 'Find √1764 using prime factorisation.', { expect: ['42'], py: 'sp.sqrt(1764)', must: [/2\s*(×|\\times)\s*2|prime factor/i], modes: ['A'] }),
  C('roots', 'sq-2', 'Find the cube root of 2744.', { expect: ['14'], py: 'sp.cbrt(2744)', modes: ['A'] }),
  C('roots', 'sq-3', 'What is the smallest number by which 72 must be multiplied to make it a perfect square?', { expect: ['2'], py: '2', modes: ['D'] }),
  C('roots', 'sq-4', 'Is 1000 a perfect square? Is it a perfect cube?', { must: [/not a perfect square|isn'?t a perfect square|is not a (perfect )?square/i, /(is a|is) perfect cube|10\s*(×|\\times)\s*10\s*(×|\\times)\s*10|10\^3|10³/i], modes: ['C'] }),
  C('roots', 'sq-5', 'Find √0.0081.', { expect: ['0.09'], py: 'sp.sqrt(sp.Rational(81,10000))', modes: ['G'] }),
  C('roots', 'sq-6', 'Find the square of 2.5.', { expect: ['6.25'], py: 'F(5,2)**2', modes: ['A'] }),
  C('roots', 'sq-7', 'Find ∛(−343).', { expect: ['-7'], py: '-7 if (-7)**3 == -343 else None', modes: ['E'] }),
  // 5. Algebraic expressions and identities
  C('algebra', 'alg-1', 'Expand (x + 3)².', { expr: 'x^2+6x+9', py: 'sp.expand((x+3)**2)', modes: ['B'] }),
  C('algebra', 'alg-2', 'Expand (2a − 3b)(2a + 3b).', { expr: '4a^2-9b^2', py: 'sp.expand((2*a-3*b)*(2*a+3*b))', modes: ['E'] }),
  C('algebra', 'alg-3', 'Use an identity to find 103 × 97.', { expect: ['9991'], py: '103*97', must: [/a\s*\+\s*b|a\s*-\s*b|a\^?2\s*-\s*b\^?2|a²\s*-\s*b²|100\^?2|100²/i], modes: ['B'] }),
  C('algebra', 'alg-4', 'Find 99² using an identity.', { expect: ['9801'], py: '99**2', modes: ['B'] }),
  C('algebra', 'alg-5', 'Simplify 3x(2x − 5) − 2x(x + 4).', { expr: '4x^2-23x', py: 'sp.expand(3*x*(2*x-5)-2*x*(x+4))', modes: ['E'] }),
  C('algebra', 'alg-6', 'Add 3a² − 2ab + 5 and −a² + 4ab − 7.', { expr: '2a^2+2ab-2', py: 'sp.expand(3*a**2-2*a*b+5 + (-a**2+4*a*b-7))', modes: ['E'] }),
  C('algebra', 'alg-7', 'Find the value of 2x² − 3x + 1 when x = −2.', { expect: ['15'], py: '2*(-2)**2 - 3*(-2) + 1', modes: ['E'] }),
  // 6. Linear equations in one variable
  C('linear', 'lin-1', 'Solve 2x + 5 = 17', { expect: ['6'], py: 'sp.solve(sp.Eq(2*x+5,17))', modes: ['A', 'I'] }),
  C('linear', 'lin-2', 'Solve 3(2x − 5) = 4x + 7 and verify the result by substitution.', { expect: ['11'], py: 'sp.solve(sp.Eq(3*(2*x-5),4*x+7))', must: [/check|verify|substitut|LHS/i], modes: ['E', 'I'] }),
  C('linear', 'lin-3', 'A number is multiplied by 5 and then 8 is subtracted. The result is 32. Find the number.', { expect: ['8'], py: 'sp.solve(sp.Eq(5*x-8,32))', modes: ['D', 'J'] }),
  C('linear', 'lin-4', 'Solve x/3 + 2 = 7', { expect: ['15'], py: 'sp.solve(sp.Eq(x/3+2,7))', modes: ['F'] }),
  C('linear', 'lin-5', 'Solve 7 − 2x = 3x − 8', { expect: ['3'], py: 'sp.solve(sp.Eq(7-2*x,3*x-8))', modes: ['E'] }),
  C('linear', 'lin-6', 'Solve (x − 1)/2 = (x + 2)/5', { expect: ['3'], py: 'sp.solve(sp.Eq((x-1)/2,(x+2)/5))', modes: ['F'] }),
  C('linear', 'lin-7', 'Solve 0.5x − 1.2 = 0.3x + 0.4', { expect: ['8'], py: 'sp.solve(sp.Eq(sp.Rational(1,2)*x-sp.Rational(6,5), sp.Rational(3,10)*x+sp.Rational(2,5)))', modes: ['G'] }),
  C('linear', 'lin-8', 'Solve −4(x + 2) = 2(x − 7)', { expect: ['1'], py: 'sp.solve(sp.Eq(-4*(x+2),2*(x-7)))', modes: ['E'] }),
  C('linear', 'lin-9', 'The sum of three consecutive integers is 72. Find the integers.', { expect: ['23', '24', '25'], py: '[23,24,25] if 23+24+25==72 else None', modes: ['D', 'J'] }),
  C('linear', 'lin-10', 'Aman is three times as old as his daughter. In 5 years, the sum of their ages will be 50. Find their present ages.', { expect: ['30', '10'], py: '[3*sp.solve(sp.Eq(4*x+10,50))[0], sp.solve(sp.Eq(4*x+10,50))[0]]', modes: ['D', 'J'] }),
  C('linear', 'lin-11', 'Solve 2(x + 3) = 2x + 5', { must: [/no solution|not possible|impossible|never (true|equal)|contradiction|6\s*(=|≠|\\neq)\s*5/i], modes: ['T'] }),
  C('linear', 'lin-12', 'Solve 5x − 3 = 2x + 9 − (−3)', { expect: ['5'], py: 'sp.solve(sp.Eq(5*x-3,2*x+9+3))', modes: ['E'] }),
  // 7. Factorisation
  C('factorisation', 'fac-1', 'Factorise x² + 7x + 12 and explain how to identify the factors.', { expr: 'x^2+7x+12', factored: true, must: [/\(x\s*\+\s*3\)\s*\(x\s*\+\s*4\)|\(x\s*\+\s*4\)\s*\(x\s*\+\s*3\)/, /multiply to|product|add (up )?to|sum/i], py: 'sp.factor(x**2+7*x+12)', modes: ['B'] }),
  C('factorisation', 'fac-2', 'Factorise 6x² − 9x.', { expr: '6x^2-9x', factored: true, must: [/3x\s*\(\s*2x\s*-\s*3\s*\)/], py: 'sp.factor(6*x**2-9*x)', modes: ['B'] }),
  C('factorisation', 'fac-3', 'Factorise a² − 49.', { expr: 'a^2-49', factored: true, py: 'sp.factor(a**2-49)', modes: ['B'] }),
  C('factorisation', 'fac-4', 'Factorise x² − 5x + 6.', { expr: 'x^2-5x+6', factored: true, py: 'sp.factor(x**2-5*x+6)', modes: ['E'] }),
  C('factorisation', 'fac-5', 'Factorise 4y² + 12y + 9.', { expr: '4y^2+12y+9', factored: true, py: 'sp.factor(4*y**2+12*y+9)', modes: ['B'] }),
  C('factorisation', 'fac-6', 'Divide 10x² − 25x by 5x.', { expr: '2x-5', py: 'sp.simplify((10*x**2-25*x)/(5*x))', modes: ['E'] }),
  C('factorisation', 'fac-7', 'Factorise x² + x − 20.', { expr: 'x^2+x-20', factored: true, py: 'sp.factor(x**2+x-20)', modes: ['E'] }),
  // 8. Comparing quantities and percentages
  C('percentages', 'pct-1', 'What is 15% of 240?', { expect: ['36'], py: 'F(15,100)*240', modes: ['A'] }),
  C('percentages', 'pct-2', 'The price of a book went up from ₹250 to ₹300. What is the percentage increase?', { expect: ['20'], unit: /%|percent/i, py: 'F(300-250,250)*100', modes: ['G'] }),
  C('percentages', 'pct-3', 'A school has 1,200 students and 45% of them are girls. How many boys are there?', { expect: ['660'], py: '1200 - F(45,100)*1200', modes: ['D'] }),
  C('percentages', 'pct-4', 'Convert 3/8 into a percentage.', { expect: ['37.5'], unit: /%|percent/i, py: 'F(3,8)*100', modes: ['G'] }),
  C('percentages', 'pct-5', 'Find the simple interest on ₹5,000 at 8% per annum for 3 years.', { expect: ['1200'], py: '5000*F(8,100)*3', modes: ['A'] }),
  C('percentages', 'pct-6', 'Find the amount on ₹10,000 at 10% per annum compounded annually for 2 years.', { expect: ['12100'], py: '10000*F(11,10)**2', modes: ['A'] }),
  C('percentages', 'pct-7', 'A town of 20,000 people shrinks by 5% every year. What will its population be after 2 years?', { expect: ['18050'], py: '20000*F(95,100)**2', modes: ['A'] }),
  C('percentages', 'pct-8', 'A number is increased by 20% and then the new number is decreased by 20%. What is the overall percentage change?', { expect: ['4'], unit: /%|percent/i, must: [/decrease|less|lower|loss|fall/i], py: '(1-F(12,10)*F(8,10))*100', modes: ['D'] }),
  // 9. Profit, loss, discount and tax
  C('profit-loss', 'pl-1', 'A product costs ₹2,000 before a 15% discount. A further 5% tax is applied to the discounted price. Find the final bill.', { expect: ['1785'], py: '2000*F(85,100)*F(105,100)', modes: ['D'] }),
  C('profit-loss', 'pl-2', 'A shopkeeper buys a toy for ₹400 and sells it for ₹460. Find the profit percent.', { expect: ['15'], unit: /%|percent/i, py: 'F(60,400)*100', modes: ['G'] }),
  C('profit-loss', 'pl-3', 'A cycle bought for ₹3,600 is sold at a loss of 12%. Find the selling price.', { expect: ['3168'], py: '3600*F(88,100)', modes: ['A'] }),
  C('profit-loss', 'pl-4', 'The marked price of a shirt is ₹1,250 and it is sold for ₹1,000. What is the discount percent?', { expect: ['20'], unit: /%|percent/i, py: 'F(250,1250)*100', modes: ['G'] }),
  C('profit-loss', 'pl-5', 'After a 10% discount, a bag costs ₹900. What was its marked price?', { expect: ['1000'], py: 'F(900, F(9,10))', modes: ['D'] }),
  C('profit-loss', 'pl-6', 'A phone costs ₹12,000 plus 18% GST. What is the total price?', { expect: ['14160'], py: '12000*F(118,100)', modes: ['A'] }),
  C('profit-loss', 'pl-7', 'By selling a pen for ₹45, a shopkeeper loses 10%. What was the cost price?', { expect: ['50'], py: 'F(45, F(9,10))', modes: ['D'] }),
  C('profit-loss', 'pl-8', 'Riya buys 3 notebooks at ₹45 each and 2 pens at ₹12 each. She is 13 years old and lives 2 km from school. How much does she spend?', { expect: ['159'], py: '3*45+2*12', modes: ['D'] }),
  // 10. Ratio, proportion, direct and inverse proportion
  C('ratio', 'rt-1', 'Divide ₹840 between Asha and Ben in the ratio 3:4.', { expect: ['360', '480'], py: '[840*F(3,7), 840*F(4,7)]', modes: ['A'] }),
  C('ratio', 'rt-2', 'Six workers complete a job in 10 days. Assuming equal constant work rates and unchanged working conditions, calculate the time needed for 15 workers.', { expect: ['4'], unit: /days?/i, py: 'F(6*10,15)', must: [/inverse/i], modes: ['D'] }),
  C('ratio', 'rt-3', 'If 12 pencils cost ₹84, how much do 20 pencils cost?', { expect: ['140'], py: 'F(84,12)*20', modes: ['A'] }),
  C('ratio', 'rt-4', 'A car travels 180 km on 12 litres of petrol. How far will it travel on 20 litres?', { expect: ['300'], unit: /km|kilomet/i, py: 'F(180,12)*20', modes: ['G'] }),
  C('ratio', 'rt-5', 'Write the ratio 45 : 60 in its simplest form.', { expect: ['3', '4'], py: '[3,4] if F(45,60)==F(3,4) else None', modes: ['F'] }),
  C('ratio', 'rt-6', 'If x : y = 2 : 3 and y : z = 4 : 5, find x : z.', { expect: ['8', '15'], py: '[8,15] if F(2,3)*F(4,5)==F(8,15) else None', modes: ['A'] }),
  C('ratio', 'rt-7', 'A map has a scale of 1 : 50,000. Two towns are 6 cm apart on the map. What is the real distance in km?', { expect: ['3'], unit: /km|kilomet/i, py: 'F(6*50000, 100000)', modes: ['G'] }),
  // 11. Multi-step word problems
  C('word-problems', 'wp-1', 'A train travels 360 km in 4.5 hours. What is its average speed?', { expect: ['80'], unit: /km\s*\/\s*h|km per hour|kmph|kilomet/i, py: 'F(360, F(9,2))', modes: ['G'] }),
  C('word-problems', 'wp-2', 'Ravi had ₹500. He spent 2/5 of it on books and ₹75 on lunch. How much money is left?', { expect: ['225'], py: '500 - F(2,5)*500 - 75', modes: ['D'] }),
  C('word-problems', 'wp-3', 'A tank holds 1,200 litres. It is 3/4 full. Then 250 litres are used. How many litres are left?', { expect: ['650'], py: 'F(3,4)*1200 - 250', modes: ['D'] }),
  C('word-problems', 'wp-4', 'Tickets cost ₹120 for adults and ₹75 for children. A family of 2 adults and 3 children pays with a ₹1,000 note. How much change do they get?', { expect: ['535'], py: '1000 - (2*120 + 3*75)', modes: ['D'] }),
  C('word-problems', 'wp-5', 'Meena scored 72, 85 and 90 in three tests. What must she score in the fourth test to get an average of 85?', { expect: ['93'], py: '4*85 - (72+85+90)', modes: ['D'] }),
  C('word-problems', 'wp-6', 'A rectangular garden is 25 m long and 18 m wide. Fencing costs ₹40 per metre. Find the cost of fencing the garden.', { expect: ['3440'], py: '2*(25+18)*40', modes: ['D'] }),
  C('word-problems', 'wp-7', 'One pipe fills a tank in 6 hours and another fills it in 3 hours. How long will they take to fill it together?', { expect: ['2'], unit: /hours?|hrs?/i, py: '1/(F(1,6)+F(1,3))', modes: ['D'] }),
  C('word-problems', 'wp-8', 'A bus leaves at 9:40 am and arrives at 1:15 pm. How long is the journey in minutes?', { expect: ['215'], py: '(13*60+15) - (9*60+40)', modes: ['D'] }),
  // 12. Geometry
  C('geometry', 'geo-1', 'Two angles of a triangle are 47° and 68°. Find the third angle.', { expect: ['65'], py: '180-47-68', modes: ['A'] }),
  C('geometry', 'geo-2', 'Find each interior angle of a regular hexagon.', { expect: ['120'], py: 'F((6-2)*180,6)', modes: ['A'] }),
  C('geometry', 'geo-3', 'The angles of a quadrilateral are in the ratio 2 : 3 : 4 : 6. Find the largest angle.', { expect: ['144'], py: 'F(360,15)*6', modes: ['A'] }),
  C('geometry', 'geo-4', 'One angle of a parallelogram is 70°. Find the other three angles.', { expect: ['110', '70'], py: '[180-70, 70]', modes: ['A'] }),
  C('geometry', 'geo-5', 'Each exterior angle of a regular polygon is 24°. How many sides does it have?', { expect: ['15'], py: 'F(360,24)', modes: ['A'] }),
  C('geometry', 'geo-6', 'Find the sum of the interior angles of an octagon.', { expect: ['1080'], py: '(8-2)*180', modes: ['A'] }),
  C('geometry', 'geo-7', 'In triangle ABC, AB = 5 cm and BC = 12 cm. Find AC.', { clarify: true, must: [/right[- ]angle|not (enough|given)|can'?t (be )?(found|determined|calculate)|cannot (be )?(found|determined|calculate)|depends|need (to know|more)|missing|any length between|between 7/i], not: [/\*\*Answer:?\*\*:?\s*\\?\(?\s*AC\s*=\s*13/i], modes: ['H', 'T'] }),
  C('geometry', 'geo-8', 'In a right-angled triangle, the two sides that form the right angle are 5 cm and 12 cm. Find the hypotenuse.', { expect: ['13'], unit: /cm/i, py: 'sp.sqrt(5**2+12**2)', modes: ['A'] }),
  C('geometry', 'geo-9', 'The diagonals of a rhombus are 16 cm and 12 cm. Find the length of each side.', { expect: ['10'], unit: /cm/i, py: 'sp.sqrt(8**2+6**2)', modes: ['H'] }),
  // 13. Mensuration
  C('mensuration', 'men-1', 'A trapezium has parallel sides of 12 cm and 8 cm and a perpendicular height of 5 cm. Calculate its area.', { expect: ['50'], unit: /cm\s*(\^|²|2|sq)/i, py: 'F(12+8,2)*5', modes: ['G'] }),
  C('mensuration', 'men-2', 'Find the area of a circle of radius 7 cm. Use π = 22/7.', { expect: ['154'], unit: /cm/i, py: 'F(22,7)*7*7', modes: ['G'] }),
  C('mensuration', 'men-3', 'Find the circumference of a circle of diameter 14 cm. Use π = 22/7.', { expect: ['44'], unit: /cm/i, py: 'F(22,7)*14', modes: ['G'] }),
  C('mensuration', 'men-4', 'Find the volume of a cuboid 12 cm long, 8 cm wide and 5 cm high.', { expect: ['480'], unit: /cm\s*(\^|³|3|cub)/i, py: '12*8*5', modes: ['G'] }),
  C('mensuration', 'men-5', 'Find the total surface area of a cube with edge 6 cm.', { expect: ['216'], unit: /cm/i, py: '6*6*6', modes: ['G'] }),
  C('mensuration', 'men-6', 'Find the volume of a cylinder of radius 7 cm and height 10 cm. Use π = 22/7.', { expect: ['1540'], unit: /cm/i, py: 'F(22,7)*7*7*10', modes: ['G'] }),
  C('mensuration', 'men-7', 'Find the curved surface area of a cylinder of radius 3.5 cm and height 10 cm. Use π = 22/7.', { expect: ['220'], unit: /cm/i, py: '2*F(22,7)*F(7,2)*10', modes: ['G'] }),
  C('mensuration', 'men-8', 'A rectangle has a perimeter of 30 cm. Is its area uniquely determined? Explain why or why not.', { must: [/\bno\b|not (uniquely|fixed|determined)|can'?t be (found|determined)|cannot be/i, /for example|e\.g\.|like|could be|\d+\s*cm\s*(×|\\times|x|by)\s*\d+/i], modes: ['T', 'H'] }),
  C('mensuration', 'men-9', 'The area of a rhombus is 96 cm² and one diagonal is 16 cm. Find the other diagonal.', { expect: ['12'], unit: /cm/i, py: 'F(2*96,16)', modes: ['A'] }),
  C('mensuration', 'men-10', 'How many cubes of side 2 cm fit exactly inside a box 10 cm × 8 cm × 6 cm?', { expect: ['60'], py: '(10//2)*(8//2)*(6//2)', modes: ['G'] }),
  // 14. Data handling
  C('data', 'dat-1', 'Find the mean, median, mode and range of 12, 15, 15, 18, 25.', { expect: ['17', '15', '13'], py: '[F(12+15+15+18+25,5), 15, 15, 25-12]', modes: ['A'] }),
  C('data', 'dat-2', 'Find the mean of the first five prime numbers.', { expect: ['5.6'], py: 'F(2+3+5+7+11,5)', modes: ['A'] }),
  C('data', 'dat-3', 'Find the median of 7, 3, 9, 1, 5, 11.', { expect: ['6'], py: 'F(5+7,2)', modes: ['D'] }),
  C('data', 'dat-4', 'The mean of 5 numbers is 18. When one number is removed, the mean of the rest is 16. Find the number removed.', { expect: ['26'], py: '5*18-4*16', modes: ['D'] }),
  C('data', 'dat-5', 'In a pie chart, a sector shows 30% of the data. What is its central angle?', { expect: ['108'], py: 'F(30,100)*360', modes: ['A'] }),
  C('data', 'dat-6', 'Find the mode of 2, 3, 3, 5, 7, 7, 7, 9.', { expect: ['7'], py: '7', modes: ['A'] }),
  // 15. Probability and logical reasoning
  C('probability', 'prob-1', 'Two coins are tossed. What is the probability of getting at least one head?', { expect: ['3/4'], py: 'F(3,4)', modes: ['A'] }),
  C('probability', 'prob-2', 'A die is rolled once. What is the probability of getting a number greater than 4?', { expect: ['1/3'], py: 'F(2,6)', modes: ['F'] }),
  C('probability', 'prob-3', 'A bag has 4 red, 5 blue and 6 green balls. One ball is drawn at random. What is the probability that it is not blue?', { expect: ['2/3'], py: 'F(10,15)', modes: ['F', 'D'] }),
  C('probability', 'prob-4', 'A normal die is rolled once. What is the probability of getting a 7?', { expect: ['0'], py: '0', modes: ['A'] }),
  C('probability', 'log-1', 'Find the next number: 2, 6, 12, 20, ?', { expect: ['30'], py: '5*6', modes: ['J'] }),
  C('probability', 'log-2', 'Find the next number: 3, 9, 27, 81, ?', { expect: ['243'], py: '3**5', modes: ['J'] }),
  C('probability', 'log-3', 'If 5 machines make 5 toys in 5 minutes, how long would 100 machines take to make 100 toys?', { expect: ['5'], unit: /min/i, py: '5', modes: ['D'] }),
  // 16. Units
  C('units', 'unit-1', 'Convert 2.5 km into centimetres.', { expect: ['250000'], unit: /cm|centimet/i, py: 'F(5,2)*100000', modes: ['G'] }),
  C('units', 'unit-2', 'Write 3 hours 45 minutes in hours as a decimal.', { expect: ['3.75'], py: '3+F(45,60)', modes: ['G'] }),
  C('units', 'unit-3', 'How many square centimetres are there in 1 square metre?', { expect: ['10000'], py: '100*100', modes: ['G'] }),
  C('units', 'unit-4', 'A water tank measures 2 m × 1.5 m × 1 m. How many litres does it hold when full?', { expect: ['3000'], unit: /lit|\bL\b/i, py: '2*F(3,2)*1*1000', modes: ['G'] }),
  C('units', 'unit-5', 'Convert 72 km/h into metres per second.', { expect: ['20'], unit: /m\s*\/\s*s|metres? per second|meters? per second/i, py: 'F(72*1000,3600)', modes: ['G'] }),
  C('units', 'unit-6', 'Add 2 kg 750 g and 1 kg 400 g. Give the answer in kilograms.', { expect: ['4.15'], unit: /kg|kilogram/i, py: 'F(2750+1400,1000)', modes: ['G'] }),
  // 17. Follow-ups that need earlier messages
  C('context', 'ctx-1', 'Why did you divide by 2 in the previous step?', { history: ctxSolve, must: [/2x\s*=\s*12|2x/i, /both sides|balance|alone|by itself|undo|isolate/i], modes: ['O'] }),
  C('context', 'ctx-2', 'Ok, now solve the one you gave me.', { history: ctxSolve, expect: ['7'], py: 'sp.solve(sp.Eq(3*x+4,25))', modes: ['O'] }),
  C('context', 'ctx-3', 'Now find its perimeter.', { history: [['user', 'A rectangle is 12 cm long and 5 cm wide. Find its area.'], ['model', 'Area = length × width = \\(12 \\times 5 = 60\\) cm².\n\n**Answer:** 60 cm²']], expect: ['34'], unit: /cm/i, py: '2*(12+5)', modes: ['O'] }),
  C('context', 'ctx-4', 'Why did you subtract 4x from both sides?', { history: ctxBrackets, must: [/4x/, /balance|scale|both sides|same (thing|amount)|equal/i], modes: ['O', 'C'] }),
  C('context', 'ctx-5', 'What if it was 3/4 − 1/6 instead?', { history: [['user', 'What is 3/4 + 1/6?'], ['model', 'Use 12 as the common denominator: \\(\\frac{9}{12} + \\frac{2}{12} = \\frac{11}{12}\\).\n\n**Answer:** \\(\\frac{11}{12}\\)']], expect: ['7/12'], py: 'F(3,4)-F(1,6)', modes: ['O'] }),
  // 18. Hindi and Hinglish
  C('hindi', 'hi-1', '2x + 5 = 17 ko solve karo', { expect: ['6'], py: 'sp.solve(sp.Eq(2*x+5,17))', modes: ['J'] }),
  C('hindi', 'hi-2', 'Ek number ko 3 se guna karke 7 jodne par 25 milta hai. Number kya hai?', { expect: ['6'], py: 'sp.solve(sp.Eq(3*x+7,25))', modes: ['J', 'D'] }),
  C('hindi', 'hi-3', '₹800 ka 15% kitna hota hai?', { expect: ['120'], py: '800*F(15,100)', modes: ['J'] }),
  C('hindi', 'hi-4', 'Ek rectangle ki length 8 cm aur breadth 5 cm hai. Uska area kitna hoga?', { expect: ['40'], unit: /cm/i, py: '8*5', modes: ['J'] }),
  C('hindi', 'hi-5', '3/4 aur 2/3 mein se bada kaun hai?', { expect: ['3/4'], py: 'max(F(3,4),F(2,3))', modes: ['J', 'F'] }),
  C('hindi', 'hi-6', 'एक त्रिभुज के दो कोण 50° और 60° हैं। तीसरा कोण ज्ञात कीजिए।', { expect: ['70'], py: '180-50-60', modes: ['J'] }),
  // 19. Questions in a photo
  C('image', 'img-1', 'Solve the question in this photo', { image: 'equation.png', expect: ['9'], py: 'sp.solve(sp.Eq(4*x-7,29))', modes: ['A'] }),
  C('image', 'img-2', 'Can you solve this?', { image: 'fraction.png', expect: ['7/10'], py: 'F(3,5)+F(1,10)', modes: ['F'] }),
  // 20. Missing, ambiguous or contradictory information
  C('clarify', 'cl-1', 'A rectangle has a length of 8 cm. What is its area?', { clarify: true, must: [/width|breadth|missing|need (to know|more)|not (given|enough)/i], not: [/\*\*Answer:?\*\*:?\s*\d+\s*cm/i], modes: ['T'] }),
  C('clarify', 'cl-2', 'What is 6 ÷ 2(1+2)?', { clarify: true, must: [/ambigu|two (ways|readings|meanings)|depends|could mean|unclear|brackets?/i], modes: ['T'] }),
  C('clarify', 'cl-3', 'A train leaves the station at 3 pm. When does it arrive?', { clarify: true, must: [/need|missing|not (given|enough|told)|don'?t know|distance|speed|how (far|long)/i], modes: ['T'] }),
  C('clarify', 'cl-4', 'Solve for x.', { clarify: true, must: [/which|what (is the )?equation|share|send|type|missing|need/i], modes: ['T'] }),
  C('clarify', 'cl-5', 'A triangle has angles of 90°, 60° and 50°. Find its area.', { clarify: true, must: [/180|not possible|impossible|can'?t (exist|be)|cannot (exist|be)|no such triangle|isn'?t (possible|a valid)/i], modes: ['T'] }),
  C('clarify', 'cl-6', 'A shop gives a discount. The marked price is ₹500. What is the selling price?', { clarify: true, must: [/how much|what (is the )?discount|percent|missing|need|not (given|told)/i], modes: ['T'] }),
  // Adversarial: wrong student attempts, misconceptions, boundaries
  C('adversarial', 'adv-1', 'I got 2³ × 2⁴ = 2¹². Is that right?', { must: [/\badd\b|adding|added|sum of the (powers|exponents)/i, /2\s*\^\s*\{?\(?7|2⁷|128/], not: [/\b(yes|correct|that'?s right)\b[^.]*\b(2\^\{?12|2¹²)/i], modes: ['A', 'C'] }),
  C('adversarial', 'adv-2', 'I solved 3(x − 2) = 12 and got x = 2. Where did I go wrong?', { expect: ['6'], py: 'sp.solve(sp.Eq(3*(x-2),12))', must: [/3x\s*-\s*6|bracket|distribut|multiply (both|each)|divide (both sides )?by 3|x\s*-\s*2\s*=\s*4/i], modes: ['A', 'E'] }),
  C('adversarial', 'adv-3', 'My friend says 1/2 + 1/3 = 2/5. Is she right?', { must: [/5\s*\/\s*6|\\frac\{5\}\{6\}|5⁄6/, /\bnot\b|isn'?t|\bno\b|wrong|mistake/i], modes: ['C', 'F'] }),
  C('adversarial', 'adv-4', 'Is 0.999… (9 recurring) equal to 1?', { must: [/\byes\b|equal|exactly 1|same (number|value)/i], not: [/\bno\b,? (it'?s|it is) (not|less)/i], modes: ['R'] }),
  C('adversarial', 'adv-5', 'What is 0 ÷ 5, and what is 5 ÷ 0?', { must: [/0\s*(÷|\\div|\/)\s*5\s*=\s*0|is 0\b|equals 0|\bzero\b/i, /not defined|undefined|can'?t (divide|be)|cannot (divide|be)|no answer|not possible/i], modes: ['R', 'T'] }),
  C('adversarial', 'adv-6', 'I think 0.5 is smaller than 0.25 because 5 is smaller than 25.', { must: [/0\.5\s*(is )?(greater|bigger|larger|more)|0\.25\s*(is )?(smaller|less)|0\.50/i, /place value|tenths|hundredths|0\.50|50\s*(\/|out of)\s*100|half/i], modes: ['C'] }),
  C('adversarial', 'adv-7', 'Solve 3x = 0.', { expect: ['0'], py: 'sp.solve(sp.Eq(3*x,0))', modes: ['R'] })
];
