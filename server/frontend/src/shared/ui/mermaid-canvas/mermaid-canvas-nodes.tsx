import { IconDatabase, IconUser } from '@tabler/icons-react';
import { type Node, type NodeProps, Position } from '@xyflow/react';
import { clsx } from 'clsx';
import { type MouseEvent, type ReactNode } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import '@xyflow/react/dist/base.css';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { HiddenHandle } from '#/shared/ui/diagram-canvas/hidden-handle.tsx';
import { cardShapeClass } from '#/shared/ui/diagram-shapes.tsx';
import { pressed, useBoxState } from './mermaid-canvas-reading.ts';
import type { DiagramBox, DiagramFrame } from './mermaid-graph.ts';
import classes from './mermaid-canvas.module.css';

/*
 * A mermaid diagram's boxes and frames, each drawn in its own shape.
 */

export type BoxNode = Node<{ box: DiagramBox }, 'box'>;

export type FrameNode = Node<{ frame: DiagramFrame }, 'frame'>;

/** Where a line meets a box: React Flow needs a handle there to draw it. */
const Handles = () => (
  <>
    <HiddenHandle type="target" position={Position.Top} />
    <HiddenHandle type="source" position={Position.Bottom} />
  </>
);

export function BoxNodeView({
  data: { box },
  width = 0,
  height = 0,
}: NodeProps<BoxNode>) {
  const { state, dimmed, onClick } = useBoxState(box.id);
  const name = box.lines.join(' ') || box.id;
  const common = {
    'data-state': state,
    'data-dimmed': dimmed || undefined,
    'data-box': box.shape,
    'aria-pressed': state === 'selected',
    onClick: (event: MouseEvent) => onClick(box.id, pressed(event)),
  };
  const words = box.lines.map((line, index) => (
    // A line has no identity but its place in the label.
    // oxlint-disable-next-line react/no-array-index-key
    <span key={index} className={classes.line}>
      {line}
    </span>
  ));
  let body: ReactNode;
  switch (box.shape) {
    // Where a sequence diagram's lifeline ends: nothing to see or click.
    case 'point':
      return <Handles />;
    case 'start':
    case 'end':
      body = (
        <UnstyledButton
          {...common}
          className={classes.dot}
          aria-label={box.shape === 'start' ? 'Start' : 'End'}
        />
      );
      break;
    case 'bar':
      body = (
        <UnstyledButton
          {...common}
          className={classes.bar}
          aria-label="Fork or join"
        />
      );
      break;
    case 'diamond':
      body = (
        <UnstyledButton
          {...common}
          className={classes.diamond}
          aria-label={name}
        >
          <svg
            className={classes.diamondShape}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            aria-hidden
          >
            <polygon
              points={`${width / 2},1 ${width - 1},${height / 2} ${width / 2},${height - 1} 1,${height / 2}`}
            />
          </svg>
          <span className={classes.words}>{words}</span>
        </UnstyledButton>
      );
      break;
    case 'class':
      body = (
        <UnstyledButton
          {...common}
          className={clsx(classes.card, classes.table, cardShapeClass)}
          data-shape="box"
          aria-label={`${name}, class`}
        >
          <span className={classes.tableHead}>
            {box.annotations.map((note) => (
              <span key={note} className={classes.annotation}>
                «{note}»
              </span>
            ))}
            <span className={classes.line}>{name}</span>
          </span>
          {box.members.length > 0 && (
            <span className={classes.rows}>
              {box.members.map((member, index) => (
                // oxlint-disable-next-line react/no-array-index-key
                <span key={index} className={classes.row}>
                  {member}
                </span>
              ))}
            </span>
          )}
          {box.methods.length > 0 && (
            <span className={classes.rows}>
              {box.methods.map((method, index) => (
                // oxlint-disable-next-line react/no-array-index-key
                <span key={index} className={classes.row}>
                  {method}
                </span>
              ))}
            </span>
          )}
        </UnstyledButton>
      );
      break;
    case 'entity':
      body = (
        <UnstyledButton
          {...common}
          className={clsx(classes.card, classes.table, cardShapeClass)}
          data-shape="box"
          aria-label={`${name}, entity`}
        >
          <span className={classes.tableHead}>
            <span className={classes.line}>{name}</span>
          </span>
          {box.attributes.length > 0 && (
            <span className={clsx(classes.rows, classes.attributes)}>
              {box.attributes.map((attribute, index) => (
                // oxlint-disable-next-line react/no-array-index-key
                <span key={index} className={classes.attribute}>
                  <span>{attribute.name}</span>
                  <span className={classes.type}>{attribute.type}</span>
                  <span className={classes.keys}>
                    {attribute.keys.join(', ')}
                  </span>
                </span>
              ))}
            </span>
          )}
        </UnstyledButton>
      );
      break;
    default:
      body = (
        <UnstyledButton
          {...common}
          className={clsx(
            classes.card,
            box.shape !== 'circle' && box.shape !== 'note' && cardShapeClass,
          )}
          data-shape={box.shape === 'pill' ? 'pill' : 'box'}
          aria-label={name}
        >
          {box.shape === 'actor' && (
            <IconUser
              size={16}
              stroke={1.7}
              aria-hidden
              className={classes.icon}
            />
          )}
          {box.shape === 'database' && (
            <IconDatabase
              size={16}
              stroke={1.7}
              aria-hidden
              className={classes.icon}
            />
          )}
          <span className={classes.words}>{words}</span>
        </UnstyledButton>
      );
  }
  return (
    <>
      <Handles />
      {body}
    </>
  );
}

export function FrameNodeView({ data: { frame } }: NodeProps<FrameNode>) {
  const { state, dimmed, onClick } = useBoxState(frame.id);
  return (
    <Box
      className={classes.frame}
      data-state={state}
      data-dimmed={dimmed || undefined}
      // The frame's room is the pointer's alone; its title is the
      // keyboard's way to the same.
      onClick={(event) => {
        if (event.target === event.currentTarget)
          onClick(frame.id, pressed(event));
      }}
    >
      <Handles />
      <UnstyledButton
        className={classes.frameTitle}
        aria-pressed={state === 'selected'}
        onClick={(event) => onClick(frame.id, pressed(event))}
      >
        {frame.title || frame.id}
      </UnstyledButton>
    </Box>
  );
}
