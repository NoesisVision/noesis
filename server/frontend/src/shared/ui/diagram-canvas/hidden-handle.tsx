import { Handle, type HandleType, type Position } from '@xyflow/react';
import classes from './hidden-handle.module.css';

/**
 * One end React Flow ties a card's edges to, unseen and never dragged: every
 * diagram's edges meet its cards where they are drawn, not at a handle.
 */
export function HiddenHandle({
  type,
  position,
}: {
  type: HandleType;
  position: Position;
}) {
  return (
    <Handle
      type={type}
      position={position}
      isConnectable={false}
      className={classes.handle}
    />
  );
}
