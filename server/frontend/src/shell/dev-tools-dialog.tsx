import { IconTool } from '@tabler/icons-react';
import { DevToolsView } from '#/features/dev-tools/ui/dev-tools-view.tsx';
import { ModalBody, ModalFrame } from '#/shared/ui/modal-frame.tsx';

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
    <ModalFrame
      opened={opened}
      onClose={onClose}
      icon={<IconTool size={22} aria-hidden />}
      title="Dev tools"
    >
      <ModalBody>
        <DevToolsView />
      </ModalBody>
    </ModalFrame>
  );
}
