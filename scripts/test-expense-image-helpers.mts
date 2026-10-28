import {
  getExpenseCoverUrl,
  getExpenseImageUrls,
  parseExpenseImageUrlsField,
} from '../src/utils/expenseImage.ts';

function assertEqual(actual: unknown, expected: unknown, message: string) {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  if (left !== right) {
    throw new Error(`${message}: expected ${right}, got ${left}`);
  }
}

function run(name: string, fn: () => void) {
  fn();
  console.log(`ok ${name}`);
}

const sample = 'https://img.example/v1/images/u/e.jpg?token=abc';
const sample2 = 'https://img.example/v1/images/u/e_2.jpg?token=def';

run('legacy imageUrl only', () => {
  assertEqual(getExpenseImageUrls({ imageUrl: sample }), [sample], 'urls');
  assertEqual(getExpenseCoverUrl({ imageUrl: sample }), sample, 'cover');
});

run('missing imageUrls is not an error', () => {
  assertEqual(getExpenseImageUrls({ imageUrl: sample }), [sample], 'fallback');
  assertEqual(parseExpenseImageUrlsField(undefined), undefined, 'parse missing');
});

run('imageUrls present uses array even if imageUrl differs', () => {
  const expense = { imageUrl: sample, imageUrls: [sample2, sample] };
  assertEqual(getExpenseImageUrls(expense), [sample2, sample], 'array wins');
  assertEqual(getExpenseCoverUrl(expense), sample2, 'cover is first of array');
});

run('empty imageUrls does not revive leftover imageUrl', () => {
  const expense = { imageUrl: sample, imageUrls: [] };
  assertEqual(getExpenseImageUrls(expense), [], 'empty');
  assertEqual(getExpenseCoverUrl(expense), null, 'no cover');
});

run('no photos', () => {
  assertEqual(getExpenseImageUrls({}), [], 'none');
  assertEqual(getExpenseCoverUrl({ imageUrl: null }), null, 'null url');
  assertEqual(getExpenseCoverUrl({ imageUrl: '  ' }), null, 'blank');
});

run('invalid entries are dropped and capped at 5', () => {
  const urls = [
    sample,
    'not-a-url',
    '',
    sample2,
    sample,
    'https://a.example/1.jpg',
    'https://a.example/2.jpg',
    'https://a.example/3.jpg',
    'https://a.example/4.jpg',
  ];
  const parsed = parseExpenseImageUrlsField(urls);
  assertEqual(parsed?.length, 5, 'cap');
  assertEqual(parsed?.[0], sample, 'first');
  assertEqual(getExpenseImageUrls({ imageUrls: urls }).includes(sample), true, 'keep valid');
});

console.log('all expense image helper tests passed');
