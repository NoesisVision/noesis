import {
  IconArrowUp,
  IconPaperclip,
  IconPlayerStopFilled,
  IconX,
} from '@tabler/icons-react';
import { type KeyboardEvent, type ReactNode, useState } from 'react';
import { useChangesWithEntries } from '#/features/changes/changes.api.ts';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Box } from '#/shared/design-system/box.tsx';
import { Button } from '#/shared/design-system/button.tsx';
import { FileButton } from '#/shared/design-system/file-button.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { useOs } from '#/shared/design-system/hooks.ts';
import { Text } from '#/shared/design-system/text.tsx';
import { Textarea } from '#/shared/design-system/textarea.tsx';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';
import type { AgentAttachment } from '#backend/app/agent/agent-session.ts';
import type { AgentTask } from '#backend/app/agent/agent-task.ts';
import { useAgentPlace } from '../agent-place.ts';
import {
  useInterruptAgent,
  useSendAgentMessage,
  useUploadAgentFile,
} from '../agent.api.ts';
import { AgentIcon, taskPlaceholder, taskVerb } from '../agent.model.ts';
import classes from './agent-composer.module.css';

interface AgentComposerProps {
  /**
   * `bar`: one line across the foot of the page, the task before the field
   * and `trailing` after it. `card`: the task over the field, the buttons
   * under it, as a chat's composer is.
   */
  layout: 'bar' | 'card';
  /** The agent is in the middle of a turn: Stop is offered beside Send. */
  busy: boolean;
  /** Nothing listens: the field says so and sends nothing. */
  disabled: boolean;
  /** What the bar carries after the field: the status, the sheet's toggle. */
  trailing?: ReactNode;
}

/**
 * Where the person writes to the agent: what the message is about, the
 * field, the files attached to it as chips, and Send — or Stop, while the
 * agent is working. Enter sends; Shift+Enter breaks the line. The skill the
 * message starts is never typed: the service adds it from where the page is.
 */
export function AgentComposer({
  layout,
  busy,
  disabled,
  trailing,
}: AgentComposerProps) {
  // The task is read as the message goes, so a diagram is told as it stands then.
  const { task: taskNow } = useAgentPlace();
  const task = taskNow();
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<AgentAttachment[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const send = useSendAgentMessage();
  const interrupt = useInterruptAgent();
  const upload = useUploadAgentFile();
  const mac = ['macos', 'ios'].includes(useOs());
  const enter = mac ? 'Return' : 'Enter';

  const canSend = text.trim() !== '' && !disabled && !send.isPending;

  const submit = () => {
    if (!canSend) return;
    const sent = text.trim();
    send.mutate(
      { text: sent, attachments, task: taskNow() },
      {
        // Words typed while the send was on its way stay in the field.
        onSuccess: () => {
          setText((current) => (current.trim() === sent ? '' : current));
          setAttachments([]);
          setProblem(null);
        },
        onError: (error) => setProblem(error.message),
      },
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submit();
    }
  };

  // One upload at a time, each reported: a `mutate` callback only fires for
  // the last call, so several files at once would lose all but one.
  const attach = async (files: File[]) => {
    const failed: string[] = [];
    for (const file of files) {
      try {
        const attachment = await upload.mutateAsync(file);
        setAttachments((all) => [...all, attachment]);
      } catch (error) {
        failed.push(error instanceof Error ? error.message : file.name);
      }
    }
    setProblem(failed.length === 0 ? null : failed.join(' '));
  };

  const detach = (path: string) =>
    setAttachments((all) => all.filter((a) => a.path !== path));

  const chips = attachments.length > 0 && (
    <Group gap={4}>
      {attachments.map((file) => (
        <Button
          key={file.path}
          size="compact-xs"
          variant="light"
          color="gray"
          radius="xl"
          leftSection={<IconPaperclip size={11} aria-hidden />}
          rightSection={<IconX size={11} aria-hidden />}
          onClick={() => detach(file.path)}
          aria-label={`Remove ${file.name}`}
        >
          {file.name}
        </Button>
      ))}
    </Group>
  );

  const field = (
    <Textarea
      className={classes.field}
      classNames={{ input: classes.field }}
      aria-label="Message to the agent"
      placeholder={
        disabled ? 'The agent is not available.' : taskPlaceholder(task)
      }
      value={text}
      onChange={(event) => setText(event.currentTarget.value)}
      onKeyDown={onKeyDown}
      disabled={disabled}
      autosize
      minRows={1}
      maxRows={layout === 'bar' ? 5 : 8}
      variant="unstyled"
    />
  );

  const buttons = (
    <>
      <FileButton
        onChange={(files) => void attach(files)}
        multiple
        disabled={disabled}
      >
        {(props) => (
          <Tooltip label="Attach files">
            <ActionIcon
              {...props}
              variant="subtle"
              color="gray"
              size="md"
              aria-label="Attach files"
              loading={upload.isPending}
            >
              <IconPaperclip size={16} aria-hidden />
            </ActionIcon>
          </Tooltip>
        )}
      </FileButton>
      {busy && (
        <Tooltip label="Stop the agent">
          <ActionIcon
            variant="light"
            color="red"
            size="md"
            aria-label="Stop the agent"
            onClick={() => interrupt.mutate()}
            loading={interrupt.isPending}
          >
            <IconPlayerStopFilled size={14} aria-hidden />
          </ActionIcon>
        </Tooltip>
      )}
      <Tooltip label={`Send (${enter}; Shift+${enter} for a new line)`}>
        <ActionIcon
          variant="filled"
          size="md"
          radius="xl"
          aria-label="Send"
          onClick={submit}
          disabled={!canSend}
          loading={send.isPending}
        >
          <IconArrowUp size={16} aria-hidden />
        </ActionIcon>
      </Tooltip>
    </>
  );

  const note = problem !== null && (
    <Text className={classes.problem} role="alert">
      {problem}
    </Text>
  );

  if (layout === 'bar') {
    return (
      <Box className={classes.line}>
        {(chips || note) && (
          <Group gap="sm" className={classes.above}>
            {chips}
            {note}
          </Group>
        )}
        <Group gap="sm" wrap="nowrap" align="flex-end">
          <TaskChip task={task} />
          <Box className={classes.box} data-layout="bar">
            {field}
          </Box>
          <Group gap={4} wrap="nowrap" className={classes.after}>
            {buttons}
            {trailing}
          </Group>
        </Group>
      </Box>
    );
  }

  return (
    <Box className={classes.composer}>
      <TaskChip task={task} />
      <Box className={classes.box}>
        {chips}
        {field}
        <Group justify="flex-end" gap={4}>
          {buttons}
        </Group>
      </Box>
      {note || (
        <Text className={classes.hint}>
          {enter} to send · Shift+{enter} for a new line
        </Text>
      )}
    </Box>
  );
}

/**
 * What the next message is about, named beside the field: the change a
 * design document is made for, or the design document being revised. Off a
 * change, that there is nothing to design into.
 */
function TaskChip({ task }: { task: AgentTask | undefined }) {
  const { changes } = useChangesWithEntries();
  if (task === undefined) {
    return (
      <Text className={classes.task} c="dimmed">
        Open a change or the system model to work with the agent.
      </Text>
    );
  }
  const subject = subjectOf(task, changes);
  return (
    <Text className={classes.task} title={`${taskVerb(task)}: ${subject}`}>
      <AgentIcon size={12} stroke={1.8} aria-hidden />
      <span className={classes.taskVerb}>{taskVerb(task)}</span>
      <span className={classes.taskSubject}>{subject}</span>
    </Text>
  );
}

/** What the chip names: the change, the design document, or the diagram by what is on it. */
function subjectOf(
  task: AgentTask,
  changes: ReturnType<typeof useChangesWithEntries>['changes'],
): string {
  if (task.kind === 'diagram') {
    const count = task.diagram.drawn.length;
    return count === 0
      ? 'an empty canvas'
      : `${count} element${count === 1 ? '' : 's'} on the canvas`;
  }
  const change = changes.find((c) => c.id === task.change);
  return task.designDoc === undefined
    ? (change?.name ?? task.change)
    : (change?.entries.find((entry) => entry.id === task.designDoc)?.name ??
        task.designDoc);
}
