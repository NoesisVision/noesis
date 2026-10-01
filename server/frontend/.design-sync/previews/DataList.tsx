import { Card, DataList } from '@noesis/design-system';

export const ScenarioStep = () => (
  <Card maw={420}>
    <DataList orientation="horizontal" labelWidth={80}>
      <DataList.Item>
        <DataList.ItemLabel>Given</DataList.ItemLabel>
        <DataList.ItemValue>A customer with a saved card</DataList.ItemValue>
      </DataList.Item>
    </DataList>
  </Card>
);

export const Horizontal = () => (
  <DataList orientation="horizontal" labelWidth={100} maw={420}>
    <DataList.Item>
      <DataList.ItemLabel>Kind</DataList.ItemLabel>
      <DataList.ItemValue>Behaviour</DataList.ItemValue>
    </DataList.Item>
    <DataList.Item>
      <DataList.ItemLabel>Input</DataList.ItemLabel>
      <DataList.ItemValue>PlaceOrder</DataList.ItemValue>
    </DataList.Item>
    <DataList.Item>
      <DataList.ItemLabel>Output</DataList.ItemLabel>
      <DataList.ItemValue>OrderPlaced</DataList.ItemValue>
    </DataList.Item>
  </DataList>
);

export const Vertical = () => (
  <DataList orientation="vertical" maw={420}>
    <DataList.Item>
      <DataList.ItemLabel>Scanner</DataList.ItemLabel>
      <DataList.ItemValue>TypeScript sources</DataList.ItemValue>
    </DataList.Item>
    <DataList.Item>
      <DataList.ItemLabel>Last run</DataList.ItemLabel>
      <DataList.ItemValue>12 minutes ago</DataList.ItemValue>
    </DataList.Item>
  </DataList>
);

export const WithDivider = () => (
  <DataList orientation="horizontal" labelWidth={100} withDivider maw={420}>
    <DataList.Item>
      <DataList.ItemLabel>Change</DataList.ItemLabel>
      <DataList.ItemValue>Split order read model</DataList.ItemValue>
    </DataList.Item>
    <DataList.Item>
      <DataList.ItemLabel>Documents</DataList.ItemLabel>
      <DataList.ItemValue>4</DataList.ItemValue>
    </DataList.Item>
    <DataList.Item>
      <DataList.ItemLabel>Elements</DataList.ItemLabel>
      <DataList.ItemValue>27</DataList.ItemValue>
    </DataList.Item>
  </DataList>
);
