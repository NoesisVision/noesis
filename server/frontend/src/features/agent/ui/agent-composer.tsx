import {
  IconArrowUp,
  IconPaperclip,
  IconPlayerStopFilled,
  IconX,
} from '@tabler/icons-react';
import { useParams } from '@tanstack/react-router';
import { type KeyboardEvent, useState } from 'react';
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
import type { DesignTask } from '#backend/app/agent/design-task.ts';
import {
  useInterruptAgent,
  useSendAgentMessage,
  useUploadAgentFile,
} from '../agent.api.ts';
import { AgentIcon, designTaskOf, taskVerb } from '../agent.model.ts';
import classes from './agent-panel.module.css';

interface AgentComposerProps {
  /** The agent is in the middle of a turn: Stop is offered beside Send. */
  busy: boolean;
  /** Nothing listens: the field says so and sends nothing. */
  disabled: boolean;
}

/**
 * Where the person writes to the agent: what the message is about over the
 * field, the field itself, the files attached to it as chips, and Send — or
 * Stop, while the agent is working. Enter sends; Shift+Enter breaks the
 * line. The skill the message starts is never typed: the service adds it
 * from where the page is.
 */
export function AgentComposer({ busy, disabled }: AgentComposerProps) {
  const task = designTaskOf(useParams({ strict: false }));
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
      { text: sent, attachments, task },
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

  return (
    <Box className={classes.composer}>
      <TaskChip task={task} />
      <Box className={classes.box}>
        {attachments.length > 0 && (
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
        )}
        <Textarea
          className={classes.field}
          classNames={{ input: classes.field }}
          aria-label="Message to the agent"
          placeholder={placeholderFor(task, disabled)}
          value={text}
          onChange={(event) => setText(event.currentTarget.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          autosize
          minRows={1}
          maxRows={8}
          variant="unstyled"
        />
        <Group justify="space-between" gap="xs">
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
          <Group gap={4}>
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
            <Tooltip label={`Send (${enter})`}>
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
          </Group>
        </Group>
      </Box>
      <Text className={classes.hint} role={problem ? 'alert' : undefined}>
        {problem ?? `${enter} to send · Shift+${enter} for a new line`}
      </Text>
    </Box>
  );
}

/**
 * What the next message is about, named over the field: the change a
 * design document is made for, or the design document being revised. Off a
 * change, that there is nothing to design into.
 */
function TaskChip({ task }: { task: DesignTask | undefined }) {
  const { changes } = useChangesWithEntries();
  if (task === undefined) {
    return (
      <Text className={classes.task} c="dimmed">
        Open a change to design into it.
      </Text>
    );
  }
  const change = changes.find((c) => c.id === task.change);
  const subject =
    task.designDoc === undefined
      ? (change?.name ?? task.change)
      : (change?.entries.find((entry) => entry.id === task.designDoc)?.name ??
        task.designDoc);
  return (
    <Text className={classes.task}>
      <AgentIcon size={12} stroke={1.8} aria-hidden />
      <span className={classes.taskVerb}>{taskVerb(task)}</span>
      <span className={classes.taskSubject}>{subject}</span>
    </Text>
  );
}

function placeholderFor(task: DesignTask | undefined, disabled: boolean) {
  if (disabled) return 'The agent is not available.';
  if (task === undefined) return 'Ask the agent…';
  return task.designDoc === undefined
    ? 'What should the design cover?'
    : 'What should change in the design?';
}
