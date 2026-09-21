import { DuplicateChangeError, useCreateChange } from '#/api/changes';
import { Alert } from '#/components/design-system/alert';
import { Button } from '#/components/design-system/button';
import { useForm } from '#/components/design-system/form';
import { Group } from '#/components/design-system/group';
import { Modal } from '#/components/design-system/modal';
import { SegmentedControl } from '#/components/design-system/segmented-control';
import { Stack } from '#/components/design-system/stack';
import { TextInput } from '#/components/design-system/text-input';
import {
  CHANGE_KEY_PATTERN,
  CHANGE_TYPES,
  type CreateChange,
} from '#backend/app/changes/change.ts';
import { CHANGE_TYPE_META } from './change-status';

interface NewChangeModalProps {
  opened: boolean;
  onClose: () => void;
}

/** The service derives the slug and starts the status at discovery. */
export function NewChangeModal({ opened, onClose }: NewChangeModalProps) {
  const create = useCreateChange();
  const form = useForm<CreateChange>({
    mode: 'uncontrolled',
    initialValues: { name: '', key: '', type: 'feature' },
    validate: {
      name: (value) =>
        value.trim().length === 0
          ? 'Give the change a name'
          : value.trim().length > 120
            ? 'At most 120 characters'
            : null,
      key: (value) =>
        value.trim() === '' || CHANGE_KEY_PATTERN.test(value.trim())
          ? null
          : 'A key looks like NOE-142',
    },
  });

  const close = () => {
    form.reset();
    create.reset();
    onClose();
  };

  const submit = form.onSubmit(async (values) => {
    try {
      await create.mutateAsync({
        name: values.name.trim(),
        key: values.key.trim(),
        type: values.type,
      });
      close();
    } catch (error) {
      if (error instanceof DuplicateChangeError) {
        form.setFieldError(
          error.field === 'key' ? 'key' : 'name',
          error.message,
        );
      }
      // Anything else stays in `create.error` and shows below the fields.
    }
  });

  const failure =
    create.error && !(create.error instanceof DuplicateChangeError)
      ? create.error.message
      : null;

  return (
    <Modal opened={opened} onClose={close} title="New change" centered>
      <form onSubmit={submit}>
        <Stack>
          <TextInput
            label="Name"
            placeholder="Payment retry"
            data-autofocus
            withAsterisk
            key={form.key('name')}
            {...form.getInputProps('name')}
          />
          <TextInput
            label="Key"
            description="The tracker key, if there is one"
            placeholder="NOE-142"
            key={form.key('key')}
            {...form.getInputProps('key')}
          />
          <SegmentedControl
            fullWidth
            data={CHANGE_TYPES.map((type) => ({
              value: type,
              label: CHANGE_TYPE_META[type].label,
            }))}
            key={form.key('type')}
            {...form.getInputProps('type')}
          />
          {failure ? (
            <Alert color="red" title="Could not create the change">
              {failure}
            </Alert>
          ) : null}
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending}>
              Create
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
