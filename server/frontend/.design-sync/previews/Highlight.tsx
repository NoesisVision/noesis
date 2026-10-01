import { Highlight, Stack } from '@noesis/design-system';

export const SearchMatch = () => (
  <Highlight highlight="order" maw={420} size="sm">
    Splits the order service into read and write models so order reporting no
    longer blocks checkout.
  </Highlight>
);

export const MultipleTerms = () => (
  <Highlight highlight={['scanner', 'element']} maw={420} size="sm">
    Each scanner reads the sources and records every element it finds in the
    knowledge graph.
  </Highlight>
);

export const Colors = () => (
  <Stack gap="xs" maw={420}>
    <Highlight highlight="PlaceOrder" color="brand.2" size="sm">
      Behaviour PlaceOrder accepts a cart and emits OrderPlaced.
    </Highlight>
    <Highlight highlight="removed" color="red.2" size="sm">
      The legacy refund endpoint is removed in this change.
    </Highlight>
  </Stack>
);
