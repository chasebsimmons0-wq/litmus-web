import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mentionsCrisis } from '../safety.js';

test('catches crisis language, including curly apostrophes and missing ones', () => {
  for (const t of [
    'I want to die', 'honestly I’m better off dead', 'cant go on like this',
    'Thinking about SUICIDE again', 'i dont want to be here anymore', 'might hurt myself tonight',
  ]) assert.ok(mentionsCrisis(t), t);
});

test('leaves ordinary notes alone', () => {
  for (const t of [
    '', null, 'Rough night, back flared after gardening', 'Heat pad helped a bit',
    'Went to the physio', 'Tired but okay',
  ]) assert.equal(mentionsCrisis(t), false, String(t));
});

test('the first crisis line follows the device region', async () => {
  const { crisisLine } = await import('../safety.js');
  assert.equal(crisisLine(['en-US']).href, 'tel:988');
  assert.equal(crisisLine(['en-GB']).href, 'tel:116123');
  assert.equal(crisisLine(['fr-CA', 'en']).href, 'tel:988');
  assert.equal(crisisLine(['de']).href, 'https://findahelpline.com');
});
