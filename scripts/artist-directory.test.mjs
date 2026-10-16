import test from 'node:test';
import assert from 'node:assert/strict';
import { collectArtistDirectory, expandKnownArtistCredits, isNonArtistLabel, normalizeArtistKey, validYoutubeChannelId } from './artist-directory.mjs';

const channelA = 'UC' + 'a'.repeat(22);
const channelB = 'UC' + 'b'.repeat(22);

test('keeps real artist credits and excludes generic channel/project labels', () => {
  const directory = collectArtistDirectory([
    { artists: ['Hoshimachi Suisei', 'Guest Singer'], channelName: 'Hoshimachi Suisei', channelId: channelA },
    { artists: ['Guest Singer', 'Guest Singer'], channelName: 'Guest Singer', channelId: channelB },
    { artists: ['Hololive Official'], channelName: 'hololive English', channelId: 'invalid' },
    { artists: ['Holoearth'], channelName: 'Holoearth', channelId: 'invalid' },
  ], [{ name: 'Hoshimachi Suisei', image: 'https://hololive.hololivepro.com/wp-content/uploads/test.webp' }]);

  assert.equal(directory.length, 2);
  assert.deepEqual(directory.map(item => item.name), ['Guest Singer', 'Hoshimachi Suisei']);
  assert.equal(directory.find(item => item.name === 'Guest Singer').count, 2);
  assert.equal(directory.find(item => item.name === 'Hoshimachi Suisei').official, true);
});

test('splits Fuwawa and Mococo duo credits into their official roster entries', () => {
  const talents = [
    { name: 'Fuwawa Abyssgard', image: 'https://hololive.hololivepro.com/wp-content/uploads/fuwawa.webp' },
    { name: 'Mococo Abyssgard', image: 'https://hololive.hololivepro.com/wp-content/uploads/mococo.webp' },
  ];
  assert.deepEqual(
    expandKnownArtistCredits('Fuwawa & Mococo Abyssgard', talents),
    ['Fuwawa Abyssgard', 'Mococo Abyssgard'],
  );
  assert.deepEqual(expandKnownArtistCredits('FUWAMOCO', talents), ['Fuwawa Abyssgard', 'Mococo Abyssgard']);
  assert.deepEqual(
    expandKnownArtistCredits('Fuwawa & Mococo Abyssgard', [{ name: 'Fuwawa Abyssgard' }]),
    ['Fuwawa & Mococo Abyssgard'],
    'preserves source credits if the scraped roster is incomplete',
  );

  const directory = collectArtistDirectory([
    { artists: ['Fuwawa & Mococo Abyssgard'], channelName: 'FUWAMOCO Ch. hololive-EN', channelId: channelA },
  ], talents);
  assert.equal(directory.length, 2);
  assert.ok(directory.every(item => item.official));
  assert.deepEqual(directory.map(item => item.name), ['Fuwawa Abyssgard', 'Mococo Abyssgard']);
});

test('filters generic labels without excluding real people or artist collaborations', () => {
  for (const label of ['Hololive Official', 'hololive English', 'COVER Corporation', 'Holoearth', 'Hololive Alternative']) {
    assert.equal(isNonArtistLabel(label), true, label);
  }
  for (const label of ['Higuchi Kaede', 'Maaya Uchida', 'Holoearth feat. AZKi']) {
    assert.equal(isNonArtistLabel(label), false, label);
  }
});

test('maps known abbreviated credits to their actual YouTube uploader channels', () => {
  const directory = collectArtistDirectory([
    { artists: ['Peanuts'], channelName: 'Peanuts-kun', channelId: channelA },
    { artists: ['Seiten'], channelName: 'Seiten Channel', channelId: channelB },
    { artists: ['UNIT B [Pre'], channelName: 'UNIT B [Pre-Debut]', channelId: channelA },
  ]);

  assert.equal(directory.find(item => item.name === 'Peanuts').channelId, channelA);
  assert.equal(directory.find(item => item.name === 'Seiten').channelId, channelB);
  assert.equal(directory.find(item => item.name === 'UNIT B [Pre').channelId, channelA);
});

test('prefers the most frequently associated valid uploader channel ID', () => {
  const directory = collectArtistDirectory([
    { artists: ['Guest Singer'], channelName: 'Guest Singer', channelId: channelA },
    { artists: ['Guest Singer'], channelName: 'Guest Singer', channelId: channelA },
    { artists: ['Guest Singer'], channelName: 'Guest Singer', channelId: channelB },
    { artists: ['Guest Singer'], channelName: 'Guest Singer', channelId: 'not-a-channel-id' },
  ]);

  assert.equal(directory[0].channelId, channelA);
});

test('normalizes punctuation and validates YouTube channel IDs', () => {
  assert.equal(normalizeArtistKey('ASOBI★MAWARI-TAI!'), 'asobimawaritai');
  assert.equal(validYoutubeChannelId(channelA), true);
  assert.equal(validYoutubeChannelId('UC-short'), false);
});
