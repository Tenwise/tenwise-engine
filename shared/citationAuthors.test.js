import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apaAuthorList, apaAuthors, cleanAuthorField, decodeLatex, personName } from './citationAuthors.js';

test('personName inverts a name and keeps only initials of the given names', () => {
  assert.equal(personName('Ada Lovelace'), 'Lovelace, A.');
  assert.equal(personName('Thomas D. Holt'), 'Holt, T. D.');
  assert.equal(personName('Jill R Shah'), 'Shah, J. R.');
  assert.equal(personName('J.R.R. Tolkien'), 'Tolkien, J. R. R.');
  assert.equal(personName('Jean-Paul Sartre'), 'Sartre, J.-P.');
  assert.equal(personName("Sean O'Kane"), "O'Kane, S.");
});

test('personName keeps particles and suffixes with the surname, drops credentials, and calms shouting', () => {
  assert.equal(personName('Ludwig van Beethoven'), 'van Beethoven, L.');
  assert.equal(personName('Tim De Chant'), 'De Chant, T.');
  assert.equal(personName('Alejandra López de Aberasturi Gómez'), 'Gómez, A. L. A.');
  assert.equal(personName('Martin Luther King Jr.'), 'King, M. L., Jr.');
  assert.equal(personName('Jane Doe PhD'), 'Doe, J.');
  assert.equal(personName('TANMAY DANGE'), 'Dange, T.');
});

test('personName refuses names that read as groups or handles', () => {
  for (const name of ['AI Now Institute', 'Air Street Press', 'Trida AI', 'Last Week in AI', 'Aeon Video', 'iamthat', 'Ghosty.AI', 'Boone Ashworth wired.com', 'Startups with Maria']) {
    assert.equal(personName(name), null, name);
  }
});

test('decodeLatex turns arXiv accents into letters', () => {
  assert.equal(decodeLatex('Hinrich Sch\\"utze'), 'Hinrich Schütze');
  assert.equal(decodeLatex("Oscar Mir\\'o L\\'opez-Feliu"), 'Oscar Miró López-Feliu');
  assert.equal(decodeLatex('Josef Pavl\\\'i\\v{c}ek'), 'Josef Pavlíček');
  assert.equal(decodeLatex('{\\L}ukasz Pawela'), 'Łukasz Pawela');
  assert.equal(decodeLatex('Miki Weso{\\l}owska'), 'Miki Wesołowska');
  assert.equal(decodeLatex('Frederik Hytting J{\\o}rgensen'), 'Frederik Hytting Jørgensen');
  assert.equal(decodeLatex('Pe\\~na, L\\\'eo Sauli\\`eres, {\\"u}ber, \\\'{\\i}'), 'Peña, Léo Saulières, über, í');
  assert.equal(decodeLatex('No accents here'), 'No accents here');
});

test('decodeLatex leaves math commands in titles alone', () => {
  assert.equal(decodeLatex('Bounds in $\\mathcal{O}(\\log n)$ with \\lambda and \\omega'), 'Bounds in $\\mathcal{O}(\\log n)$ with \\lambda and \\omega');
});

test('cleanAuthorField strips markup, e-mail wrappers, "By" and closing periods', () => {
  assert.equal(cleanAuthorField('staff@engadget.com (Luke James)'), 'Luke James');
  assert.equal(cleanAuthorField('\n                    Beth Mole\n                '), 'Beth Mole');
  assert.equal(cleanAuthorField('Rory McDonald and Will Drover. <p>Rory McDonald is the John Tyler Professor'), 'Rory McDonald and Will Drover');
  assert.equal(cleanAuthorField('By Jane Doe'), 'Jane Doe');
  assert.equal(cleanAuthorField('Byron Smith'), 'Byron Smith');
});

test('cleanAuthorField returns nothing for fields that name no one', () => {
  for (const raw of ['', '   ', '[object Object]', 'staff@engadget.com', 'nvd.nist.gov via fro', 'thezvi.substack.com via thisalex', 'Guest Author', 'admin', null, undefined, { name: 'x' }]) {
    assert.equal(cleanAuthorField(raw), '', String(raw));
  }
});

test('apaAuthors splits lists at commas, "and", "&" and semicolons', () => {
  assert.deepEqual(apaAuthors('Raymond Wong, Kyle Barr, and James Pero'), ['Wong, R.', 'Barr, K.', 'Pero, J.']);
  assert.deepEqual(apaAuthors('Coreen McGuire & Alex Aylward'), ['McGuire, C.', 'Aylward, A.']);
  assert.deepEqual(apaAuthors('Ann Lee; Bo Kim'), ['Lee, A.', 'Kim, B.']);
  assert.deepEqual(apaAuthors('Faridoun Mehri, Hinrich Sch\\"utze'), ['Mehri, F.', 'Schütze, H.']);
  assert.deepEqual(apaAuthors('hello@smashingmagazine.com (Casey Hudetz and Eric Olive)'), ['Hudetz, C.', 'Olive, E.']);
});

test('apaAuthors drops affiliations, credentials and the outlet after the names', () => {
  assert.deepEqual(apaAuthors('Sebastian Raschka, PhD'), ['Raschka, S.']);
  assert.deepEqual(apaAuthors('Martin Luther King, Jr.'), ['King, M. L., Jr.']);
  assert.deepEqual(apaAuthors('Steve Nadis | Department of Nuclear Science and Engineering'), ['Nadis, S.']);
  assert.deepEqual(apaAuthors('Danielle Randall Doughty | Jane Halpern | Department of Chemistry'), ['Doughty, D. R.', 'Halpern, J.']);
  assert.deepEqual(apaAuthors('Sachin Sharma | Cloud & Business Transformation'), ['Sharma, S.']);
  assert.deepEqual(apaAuthors('Dan Goodin, Ars Technica', 'Ars Technica'), ['Goodin, D.']);
  assert.deepEqual(apaAuthors('Boone Ashworth, wired.com'), ['Ashworth, B.']);
  assert.deepEqual(apaAuthors('Stephanie Stacey, Chris Cook, and Jill R Shah, Financial Times'), ['Stacey, S.', 'Cook, C.', 'Shah, J. R.']);
  assert.deepEqual(
    apaAuthors("Naisha Roy, Northwestern University, and Francesca D'Annunzio and J. David McSwane, ProPublica"),
    ['Roy, N.', "D'Annunzio, F.", 'McSwane, J. D.'],
  );
});

test('apaAuthors keeps a group or handle whole, as written', () => {
  assert.deepEqual(apaAuthors('AI Now Institute'), ['AI Now Institute']);
  assert.deepEqual(apaAuthors('School of Humanities, Arts, and Social Sciences'), ['School of Humanities, Arts, and Social Sciences']);
  assert.deepEqual(apaAuthors('Division of Graduate and Undergraduate Education'), ['Division of Graduate and Undergraduate Education']);
  assert.deepEqual(apaAuthors('Building AI, Careers & Startups with Maria'), ['Building AI, Careers & Startups with Maria']);
  assert.deepEqual(apaAuthors('EnrollAI & Erudify'), ['EnrollAI & Erudify']);
  assert.deepEqual(apaAuthors('Department of Chemistry | Department of Physics'), ['Department of Chemistry']);
  assert.deepEqual(apaAuthors('chinmayajha'), ['chinmayajha']);
});

test('apaAuthors reads "Surname, Given" as one person', () => {
  assert.deepEqual(apaAuthors('Smith, John'), ['Smith, J.']);
  assert.deepEqual(apaAuthors('Synced, Inc'), ['Synced, Inc']);
  // A credential is never read as a given name ("Doe, P.").
  assert.deepEqual(apaAuthors('Doe, PhD'), ['Doe, PhD']);
});

test('apaAuthors is empty when the field names no one', () => {
  assert.deepEqual(apaAuthors(''), []);
  assert.deepEqual(apaAuthors('[object Object]'), []);
  assert.deepEqual(apaAuthors('nvd.nist.gov via fro'), []);
});

test('apaAuthorList joins with an ampersand, and past 20 names lists 19, an ellipsis and the last', () => {
  assert.equal(apaAuthorList([]), '');
  assert.equal(apaAuthorList(['Lee, A.']), 'Lee, A.');
  assert.equal(apaAuthorList(['Lee, A.', 'Kim, B.']), 'Lee, A., & Kim, B.');
  assert.equal(apaAuthorList(['Lee, A.', 'Kim, B.', 'Ng, C.']), 'Lee, A., Kim, B., & Ng, C.');
  const twenty = Array.from({ length: 20 }, (_, i) => `A${i}, X.`);
  assert.equal(apaAuthorList(twenty), `${twenty.slice(0, 19).join(', ')}, & A19, X.`);
  const many = Array.from({ length: 25 }, (_, i) => `A${i}, X.`);
  assert.equal(apaAuthorList(many), `${many.slice(0, 19).join(', ')}, . . . A24, X.`);
});
