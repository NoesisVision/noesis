import { Select as MantineSelect } from '@mantine/core';
import { wrapComponent } from './wrap-component';

export type {
  ComboboxItem,
  ComboboxParsedItem,
  OptionsFilter,
} from '@mantine/core';

export const Select = wrapComponent(MantineSelect, 'Select');
