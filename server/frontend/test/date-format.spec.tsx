import { expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createDateFormat, isoDate } from '../src/shared/ui/date-format';
import { DateFormatProvider } from '../src/shared/ui/date-format-provider';
import { FormattedDate } from '../src/shared/ui/formatted-date';

/** The day every case reads, and the moment that day began at in UTC. */
const DAY = '2026-09-14';
const MOMENT = '2026-09-14T08:30:00Z';

it('writes a day the way the language writes days', () => {
  // Loose where the language's own abbreviation has changed between CLDR
  // releases, exact where it is numeric and cannot.
  expect(createDateFormat('en-GB').format(DAY)).toMatch(/^14 Sept? 2026$/);
  expect(createDateFormat('en-US').format(DAY)).toMatch(/^Sept? 14, 2026$/);
  expect(createDateFormat('de-DE').format(DAY)).toBe('14.09.2026');
  expect(createDateFormat('pl-PL').format(DAY)).toMatch(/^14 wrz\.? 2026$/);
});

it('takes the languages in the reader’s order of preference', () => {
  // The first one `Intl` knows wins, which is how a browser hands them over.
  expect(createDateFormat(['xx-ZZ', 'de-DE', 'en-GB']).locale).toBe('de-DE');
});

it('names the same day whatever zone the reader is in', () => {
  // `2026-09-14` parses as midnight UTC, and in a zone behind UTC that
  // midnight is still the 13th. A document's date names a day, not a moment,
  // so it is read in the zone it was parsed in.
  const zone = process.env.TZ;
  const restore = () => {
    // Assigning `undefined` would leave the string 'undefined' behind, and
    // every later date in this process would be read in no zone at all.
    if (zone === undefined) delete process.env.TZ;
    else process.env.TZ = zone;
  };
  try {
    for (const tz of ['UTC', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
      process.env.TZ = tz;
      expect(createDateFormat('en-GB').format(DAY)).toMatch(/^14 /);
    }
  } finally {
    restore();
  }
});

it('writes as much of the date as it is asked for', () => {
  const { format } = createDateFormat('en-GB');
  expect(format(DAY, 'short')).toBe('14/09/2026');
  expect(format(DAY, 'long')).toBe('14 September 2026');
  expect(format(DAY, 'full')).toBe('Monday, 14 September 2026');
  // Nothing asked for is the middle one.
  expect(format(DAY)).toBe(format(DAY, 'medium'));
});

it('reads a date however it is held', () => {
  const { format } = createDateFormat('de-DE');
  const midday = Date.UTC(2026, 8, 14, 12);
  expect(format(new Date(midday))).toContain('14.09.2026');
  expect(format(midday)).toContain('14.09.2026');
  expect(format(DAY)).toBe('14.09.2026');
});

it('reads a moment with its time, and a day without one', () => {
  const { format } = createDateFormat('en-GB');
  expect(format(DAY)).not.toContain(':');
  expect(format(MOMENT)).toContain(':');
  expect(format(new Date(MOMENT))).toContain(':');
});

it('hands back what is no date at all, rather than failing to read it', () => {
  const { format } = createDateFormat('en-GB');
  expect(format('one day soon')).toBe('one day soon');
  expect(format('')).toBe('');
  expect(format(new Date('nonsense'))).toBe('');
});

it('says which locale it settled on', () => {
  expect(createDateFormat('en-GB').locale).toBe('en-GB');
});

it('writes a date for its reader, and keeps the ISO value for a machine', () => {
  const html = renderToStaticMarkup(
    <DateFormatProvider language="de-DE">
      <FormattedDate value={DAY} />
    </DateFormatProvider>,
  );
  expect(html).toMatch(/^<time dateTime="2026-09-14">14\.09\.2026<\/time>$/i);
});

it('takes the same value and the same lengths as the hook', () => {
  const html = renderToStaticMarkup(
    <DateFormatProvider language="en-GB">
      <FormattedDate value={new Date(MOMENT)} dateStyle="long" />
    </DateFormatProvider>,
  );
  expect(html).toContain('dateTime="2026-09-14T08:30:00.000Z"');
  expect(html).toContain('14 September 2026');
});

it('leaves `datetime` off a value that is no date', () => {
  const html = renderToStaticMarkup(<FormattedDate value="one day soon" />);
  expect(html).toBe('<time>one day soon</time>');
});

it('writes a date drawn outside the provider too', () => {
  // A component under test is drawn on its own, and a date still reads as one.
  const html = renderToStaticMarkup(<FormattedDate value={DAY} />);
  expect(html).toMatch(/<time dateTime="2026-09-14">/i);
  expect(html).not.toContain('Invalid Date');
});

it('gives the machine-readable form of whatever it is handed', () => {
  expect(isoDate(DAY)).toBe(DAY);
  expect(isoDate(new Date(MOMENT))).toBe('2026-09-14T08:30:00.000Z');
  expect(isoDate(Date.UTC(2026, 8, 14, 8, 30))).toBe(
    '2026-09-14T08:30:00.000Z',
  );
  expect(isoDate(new Date('nonsense'))).toBe('');
});
