import { expect, it } from 'bun:test';
import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppShell } from '../src/shared/design-system/app-shell';
import { Button } from '../src/shared/design-system/button';
import { Menu } from '../src/shared/design-system/menu';
import { MantineProvider } from '../src/shared/design-system/provider';
import { TextInput } from '../src/shared/design-system/text-input';

it('preserves polymorphic props, refs, and Mantine styling', () => {
  const html = renderToStaticMarkup(
    <MantineProvider>
      <Button
        component="a"
        href="/system-model"
        ref={createRef<HTMLAnchorElement>()}
      >
        System model
      </Button>
      <TextInput
        label="Name"
        defaultValue="Retry"
        ref={createRef<HTMLInputElement>()}
      />
    </MantineProvider>,
  );
  expect(html).toContain('href="/system-model"');
  expect(html).toContain('mantine-Button-root');
  expect(html).toContain('value="Retry"');
});

it('renders wrapped compound components with their shared context', () => {
  const html = renderToStaticMarkup(
    <MantineProvider>
      <AppShell header={{ height: 60 }}>
        <AppShell.Header>Header</AppShell.Header>
        <AppShell.Main>
          <Menu>
            <Menu.Target>
              <Button>Open menu</Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item>Item</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </AppShell.Main>
      </AppShell>
    </MantineProvider>,
  );
  expect(html).toContain('mantine-AppShell-header');
  expect(html).toContain('Open menu');
  expect(
    Button.extend({ defaultProps: { size: 'sm' } }).defaultProps?.size,
  ).toBe('sm');
});

it('busy shows a loader and disables the button without leaking to the DOM', () => {
  const html = renderToStaticMarkup(
    <MantineProvider>
      <Button busy loading={false} disabled={false}>
        Save
      </Button>
    </MantineProvider>,
  );
  expect(html).toContain('disabled=""');
  expect(html).toContain('data-loading="true"');
  expect(html).not.toContain('busy=');
});

it('busy=false preserves explicit loading and disabled props', () => {
  const html = renderToStaticMarkup(
    <MantineProvider>
      <Button busy={false} loading disabled>
        Save
      </Button>
    </MantineProvider>,
  );
  expect(html).toContain('disabled=""');
  expect(html).toContain('data-loading="true"');
});
