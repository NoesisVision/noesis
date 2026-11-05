import {
  IconArrowUp,
  IconPaperclip,
  IconPlayerStopFilled,
  IconX,
} from '@tabler/icons-react';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
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
import { useAgentPanel } from '../agent-panel-context.tsx';
import {
  useInterruptAgent,
  useSendAgentMessage,
  useUploadAgentFile,
} from '../agent.api.ts';
import classes from './agent-panel.module.css';

interface AgentComposerProps {
  /** The agent is in the middle of a turn: Stop is offered beside Send. */
  busy: boolean;
  /** Nothing listens: the field says so and sends nothing. */
  disabled: boolean;
}

/**
 * Where the person writes to the agent: a field that grows with the text,
 * the files attached to it as chips above, and Send — or Stop, while the
 * agent is working. Enter sends; Shift+Enter breaks the line.
 */
export function AgentComposer({ busy, disabled }: AgentComposerProps) {
  const { text, setText, draftCount } = useAgentPanel();
  const field = useRef<HTMLTextAreaElement>(null);
  // A view handed over a draft: the caret goes after it, ready for more.
  useEffect(() => {
    if (draftCount === 0) return;
    const input = field.current;
    if (input === null) return;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, [draftCount]);
  const [attachments, setAttachments] = useState<AgentAttachment[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const send = useSendAgentMessage();
  const interrupt = useInterruptAgent();
  const upload = useUploadAgentFile();
  const mac = ['macos', 'ios'].includes(useOs());

  const canSend = text.trim() !== '' && !disabled && !send.isPending;

  const submit = () => {
    if (!canSend) return;
    const sent = text.trim();
    send.mutate(
      { text: sent, attachments },
      {
        // Words typed while the send was on its way stay in the field.
        onSuccess: () => {
          setText(text === sent || text.trim() === sent ? '' : text);
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
          ref={field}
          className={classes.field}
          classNames={{ input: classes.field }}
          aria-label="Message to the agent"
          placeholder={
            disabled ? 'The agent is not available.' : 'Ask the agent…'
          }
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
            <Tooltip label={`Send (${mac ? 'Return' : 'Enter'})`}>
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
        {problem ??
          `${mac ? 'Return' : 'Enter'} to send · Shift+${mac ? 'Return' : 'Enter'} for a new line`}
      </Text>
    </Box>
  );
}
