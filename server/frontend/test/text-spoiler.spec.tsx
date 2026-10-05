import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '../src/shared/design-system/provider';
import { TextSpoiler } from '../src/shared/ui/text-spoiler';

const render = (text: string) =>
  renderToStaticMarkup(
    <MantineProvider>
      <TextSpoiler text={text} maxLength={20} />
    </MantineProvider>,
  );

describe('TextSpoiler', () => {
  it('shows a text that fits as it is, with nothing to open', () => {
    const html = render('A short note.');
    expect(html).toContain('>A short note.<');
    expect(html).not.toContain('<button');
  });

  it('cuts a long text at its last whole word, with Show more in its line', () => {
    const html = render(
      'The sum held on the card until the booking is confirmed.',
    );
    // 20 characters end mid-word in "card"; the cut falls back to "the".
    expect(html).toMatch(
      /<span[^>]*>The sum held on the… <button[^>]*aria-expanded="false"[^>]*>Show more<\/button><\/span>/,
    );
    expect(html).not.toContain('booking');
  });
});
