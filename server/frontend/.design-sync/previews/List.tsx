import { IconCheck, IconLink, List, ThemeIcon } from '@noesis/design-system';

export const Bulleted = () => (
  <List size="sm" spacing="xs" maw={420}>
    <List.Item>Checkout design document</List.Item>
    <List.Item>Order service architecture</List.Item>
    <List.Item>Refund policy</List.Item>
  </List>
);

export const Ordered = () => (
  <List type="ordered" size="sm" spacing="xs" maw={420}>
    <List.Item>Given a customer with a saved card</List.Item>
    <List.Item>When the checkout is submitted</List.Item>
    <List.Item>Then an OrderPlaced event is emitted</List.Item>
  </List>
);

export const ChangeList = () => (
  <List listStyleType="none" spacing="xs" size="sm" center pl={0} maw={420}>
    <List.Item icon={<ThemeIcon variant="light" size={18}><IconLink size={12} /></ThemeIcon>}>PlaceOrder</List.Item>
    <List.Item icon={<ThemeIcon variant="light" size={18}><IconLink size={12} /></ThemeIcon>}>CancelOrder</List.Item>
    <List.Item icon={<ThemeIcon variant="light" size={18}><IconLink size={12} /></ThemeIcon>}>RefundPayment</List.Item>
  </List>
);

export const WithIcons = () => (
  <List
    size="sm"
    spacing="xs"
    center
    maw={420}
    icon={<ThemeIcon color="teal" size={20} radius="xl"><IconCheck size={14} /></ThemeIcon>}
  >
    <List.Item>TypeScript scanner finished</List.Item>
    <List.Item>OpenAPI scanner finished</List.Item>
    <List.Item>Kafka topics scanner finished</List.Item>
  </List>
);
