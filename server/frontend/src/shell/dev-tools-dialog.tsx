import { DevToolsView } from '#/features/dev-tools/ui/dev-tools-view.tsx';
import { Box } from '#/shared/design-system/box';
import { Modal } from '#/shared/design-system/modal.tsx';
import { ModalTitle } from '#/shared/ui/modal-title.tsx';

interface DevToolsDialogProps {
  opened: boolean;
  onClose: () => void;
}

/**
 * Dev tools, opened over the page rather than in place of it, so the effect
 * of a switch is seen on what was being read. The page stays at its address
 * for a link straight to it.
 */
export function DevToolsDialog({ opened, onClose }: DevToolsDialogProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<ModalTitle trail={[]}>Dev tools</ModalTitle>}
      centered
      size="lg"
    >
      <Box py={24}>
        <DevToolsView />
      </Box>
    </Modal>
  );
}
