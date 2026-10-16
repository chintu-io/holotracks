import test from 'node:test';
import assert from 'node:assert/strict';
import { collectArtistDirectory, isNonArtistLabel, normalizeArtistKey, validYoutubeChannelId } from './artist-directory.mjs';

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

test('filters generic labels without excluding real people or artist collaborations', () => {
  for (const label of ['Hololive Official', 'hololive English', 'COVER Corporation', 'Holoearth', 'Hololive Alternative']) {
    assert.equal(isNonArtistLabel(label), true, label);
  }
  for (const label of ['Higuchi Kaede', 'Maaya Uchida', 'Holoearth feat. AZKi']) {
    assert.equal(isNonArtistLabel(label), false, label);
  }
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
  assert.equal(normalizeArtistKey('ASOBI★MAWARI-TAI!'), 'asobimaw aritai'.replaceAll(' ', ''));
  assert.equal(validYoutubeChannelId(channelA), true);
  assert.equal(validYoutubeChannelId('UC-short'), false);
});
