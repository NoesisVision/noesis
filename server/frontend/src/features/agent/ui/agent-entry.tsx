import { IconCheck, IconPaperclip, IconTool, IconX } from '@tabler/icons-react';
import { Box } from '#/shared/design-system/box.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Loader } from '#/shared/design-system/loader.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import { MarkdownEditor } from '#/shared/ui/markdown-editor.tsx';
import type { AgentEntry } from '#backend/app/agent/agent-session.ts';
import { taskVerb, toolLabel } from '../agent.model.ts';
import { AgentDiagramCard } from './agent-diagram-card.tsx';
import { AgentPermissionCard } from './agent-permission-card.tsx';
import { AgentQuestionCard } from './agent-question-card.tsx';
import classes from './agent-entry.module.css';

/** One entry of the transcript, drawn as its kind is. */
export function AgentEntryView({ entry }: { entry: AgentEntry }) {
  switch (entry.kind) {
    case 'user':
      return (
        <Box className={classes.user}>
          {entry.starts && entry.task !== null && (
            <Box className={classes.caption}>{taskVerb(entry.task)}</Box>
          )}
          {entry.text}
          {entry.attachments.length > 0 && (
            <Group gap={4} mt={6}>
              {entry.attachments.map((file) => (
                <Box
                  key={file.path}
                  component="span"
                  className={classes.attachment}
                >
                  <IconPaperclip size={11} aria-hidden />
                  {file.name}
                </Box>
              ))}
            </Group>
          )}
        </Box>
      );
    case 'assistant':
      // A plan still arriving is not for reading as text: it shows as its
      // card once whole.
      return entry.streaming ? (
        <Text className={`${classes.assistant} ${classes.streaming}`}>
          {entry.text.split('```noesis-diagram')[0]}
        </Text>
      ) : (
        <Box className={classes.assistant}>
          <MarkdownEditor
            key={entry.text}
            markdown={entry.text}
            headingLevel={3}
            readOnly
            noMargin
            fallback={<Text className={classes.streaming}>{entry.text}</Text>}
          />
        </Box>
      );
    case 'tool':
      return <ToolLine entry={entry} />;
    case 'question':
      return <AgentQuestionCard entry={entry} />;
    case 'permission':
      return <AgentPermissionCard entry={entry} />;
    case 'diagram':
      return <AgentDiagramCard entry={entry} />;
    case 'note':
      return (
        <Text
          className={classes.note}
          c={entry.severity === 'error' ? 'red' : undefined}
          role={entry.severity === 'error' ? 'alert' : undefined}
        >
          {entry.text}
        </Text>
      );
  }
}

function ToolLine({ entry }: { entry: Extract<AgentEntry, { kind: 'tool' }> }) {
  // The icon is for the eye; the word beside it, hidden, is what is read.
  const state =
    entry.state === 'running' ? (
      <Loader size={12} aria-hidden />
    ) : entry.state === 'done' ? (
      <IconCheck size={14} aria-hidden />
    ) : (
      <IconX size={14} color="var(--mantine-color-red-6)" aria-hidden />
    );
  const said = { running: 'Running', done: 'Done', failed: 'Failed' }[
    entry.state
  ];
  return (
    <Box className={classes.tool} title={entry.summary}>
      <IconTool size={13} aria-hidden />
      <Box component="span" className={classes.toolName}>
        {toolLabel(entry.tool)}
      </Box>
      {entry.summary !== '' && (
        <Box component="span" className={classes.toolSummary}>
          {entry.summary}
        </Box>
      )}
      {state}
      <VisuallyHidden>{said}</VisuallyHidden>
    </Box>
  );
}
