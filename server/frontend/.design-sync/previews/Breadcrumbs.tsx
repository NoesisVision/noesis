import { Anchor, Box, Breadcrumbs, Button, Text } from '@noesis/design-system';

export const ElementPath = () => (
  <Box component="nav" aria-label="Where this element sits">
    <Breadcrumbs
      separator={<span aria-hidden="true">&gt;</span>}
      separatorMargin="xs"
      px="xs"
      pt="xs"
    >
      <Button variant="subtle" size="compact-sm">
        shop
      </Button>
      <Button variant="subtle" size="compact-sm">
        payments-service
      </Button>
      <Button variant="subtle" size="compact-sm">
        RefundController
      </Button>
      <Text c="dimmed" size="xs" aria-current="location">
        refundPayment
      </Text>
    </Breadcrumbs>
  </Box>
);

export const Links = () => (
  <Breadcrumbs>
    <Anchor href="#" size="sm">
      Design documents
    </Anchor>
    <Anchor href="#" size="sm">
      Payment flow
    </Anchor>
    <Text size="sm" c="dimmed">
      Retry policy
    </Text>
  </Breadcrumbs>
);

export const CustomSeparator = () => (
  <Breadcrumbs separator="→" separatorMargin="sm">
    <Anchor href="#" size="sm">
      Changes
    </Anchor>
    <Anchor href="#" size="sm">
      Split order service
    </Anchor>
    <Text size="sm">Scenarios</Text>
  </Breadcrumbs>
);
