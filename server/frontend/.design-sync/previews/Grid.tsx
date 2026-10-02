import { Card, Grid, Group, IconFileText, IconSitemap, Text, ThemeIcon, Title } from '@noesis/design-system';

const Doc = ({ title, meta }: { title: string; meta: string }) => (
  <Card padding="md">
    <Text fw={600} size="sm">{title}</Text>
    <Text size="xs" c="dimmed">{meta}</Text>
  </Card>
);

export const ThreeColumns = () => (
  <Grid w={640}>
    <Grid.Col span={4}><Doc title="Payment flow" meta="12 elements" /></Grid.Col>
    <Grid.Col span={4}><Doc title="Order service" meta="8 elements" /></Grid.Col>
    <Grid.Col span={4}><Doc title="Notifications" meta="5 elements" /></Grid.Col>
  </Grid>
);

export const OverviewStats = () => (
  <Grid w={640}>
    <Grid.Col span={5}>
      <Card padding="lg">
        <Grid>
          <Grid.Col span={6}>
            <Group gap="xs">
              <ThemeIcon variant="light"><IconFileText size={18} /></ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">Documents</Text>
                <Title order={4}>4</Title>
              </div>
            </Group>
          </Grid.Col>
          <Grid.Col span={6}>
            <Group gap="xs">
              <ThemeIcon variant="light"><IconSitemap size={18} /></ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">Design Docs</Text>
                <Title order={4}>2</Title>
              </div>
            </Group>
          </Grid.Col>
        </Grid>
      </Card>
    </Grid.Col>
  </Grid>
);

export const UnevenSpans = () => (
  <Grid w={640} gutter="md">
    <Grid.Col span={8}><Doc title="Checkout behaviour" meta="Input PlaceOrder · Output OrderPlaced" /></Grid.Col>
    <Grid.Col span={4}><Doc title="Scenarios" meta="3 cases" /></Grid.Col>
    <Grid.Col span={6}><Doc title="Refund policy" meta="Changed in this draft" /></Grid.Col>
    <Grid.Col span={6}><Doc title="Retry rules" meta="Unchanged" /></Grid.Col>
  </Grid>
);
