import { Stack, Switch } from '@noesis/design-system';

export const FeatureFlags = () => (
  <Stack gap="sm">
    <Switch label="Scenario column" size="md" onLabel="ON" offLabel="OFF" defaultChecked />
    <Switch label="Model tree icons" size="md" onLabel="ON" offLabel="OFF" />
    <Switch label="Change picker" size="md" onLabel="ON" offLabel="OFF" defaultChecked />
  </Stack>
);

export const Sizes = () => (
  <Stack gap="sm">
    {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
      <Switch key={size} size={size} label={`Watch repository (${size})`} defaultChecked />
    ))}
  </Stack>
);

export const States = () => (
  <Stack gap="sm">
    <Switch label="Run scanners on push" defaultChecked />
    <Switch label="Notify on new changes" />
    <Switch label="Archive old design documents" disabled />
    <Switch label="Sync from main branch" disabled defaultChecked />
  </Stack>
);

export const WithDescription = () => (
  <Stack gap="md" maw={360}>
    <Switch
      label="Human-authored only"
      description="Hide fields the scanners filled in so you only see what people wrote."
      defaultChecked
    />
    <Switch
      label="Include draft changes"
      error="Drafts need an owner before they can be shown"
    />
  </Stack>
);
