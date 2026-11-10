import { IconMessageQuestion } from '@tabler/icons-react';
import { useId, useState } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import { Button } from '#/shared/design-system/button.tsx';
import { Checkbox } from '#/shared/design-system/checkbox.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Radio } from '#/shared/design-system/radio.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { TextInput } from '#/shared/design-system/text-input.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import type {
  AgentEntry,
  AgentQuestion,
} from '#backend/app/agent/agent-session.ts';
import { useAnswerAgentQuestion } from '../agent.api.ts';
import classes from './agent-entry.module.css';

type QuestionEntry = Extract<AgentEntry, { kind: 'question' }>;

const OTHER = '__other__';

/** One option of a question on the page: a label, or the person's own words. */
interface Choice {
  picked: string[];
  other: string;
}

/**
 * What the agent asks before it goes on, answered here rather than in a
 * terminal: each question with its options, one more for the person's own
 * answer, and one button for all of them. Answered, it keeps what was said.
 */
export function AgentQuestionCard({ entry }: { entry: QuestionEntry }) {
  const answer = useAnswerAgentQuestion();
  const [choices, setChoices] = useState<Record<string, Choice>>({});

  const choiceOf = (question: AgentQuestion): Choice =>
    choices[question.question] ?? { picked: [], other: '' };
  const answerOf = (question: AgentQuestion): string => {
    const { picked, other } = choiceOf(question);
    return picked
      .map((label) => (label === OTHER ? other.trim() : label))
      .filter((text) => text !== '')
      .join(', ');
  };
  const complete = entry.questions.every(
    (question) => answerOf(question) !== '',
  );

  const submit = () => {
    const answers = Object.fromEntries(
      entry.questions.map((question) => [
        question.question,
        answerOf(question),
      ]),
    );
    answer.mutate({ toolUseId: entry.toolUseId, answers });
  };
  const problem = answer.error === null ? null : answer.error.message;

  if (entry.answers !== null) {
    return (
      <Box className={classes.ask}>
        <Stack gap={6}>
          {entry.questions.map((question) => (
            <Box key={question.question}>
              <Text size="xs" c="dimmed">
                {question.question}
              </Text>
              <Text size="sm" fw={500}>
                {entry.answers?.[question.question] || 'Left unanswered'}
              </Text>
            </Box>
          ))}
        </Stack>
      </Box>
    );
  }

  return (
    <Box className={classes.ask}>
      <Stack gap="md">
        <Group gap={6} wrap="nowrap">
          <IconMessageQuestion size={14} aria-hidden />
          <Text className={classes.askHeader}>The agent asks</Text>
        </Group>
        {entry.questions.map((question) => (
          <QuestionField
            key={question.question}
            question={question}
            choice={choiceOf(question)}
            onChange={(choice) =>
              setChoices((all) => ({ ...all, [question.question]: choice }))
            }
          />
        ))}
        {problem !== null && (
          <Text size="xs" c="red" role="alert">
            {problem}
          </Text>
        )}
        <Group justify="flex-end">
          <Button
            size="xs"
            onClick={submit}
            disabled={!complete}
            busy={answer.isPending}
          >
            Answer
          </Button>
        </Group>
      </Stack>
    </Box>
  );
}

function QuestionField({
  question,
  choice,
  onChange,
}: {
  question: AgentQuestion;
  choice: Choice;
  onChange: (choice: Choice) => void;
}) {
  const otherId = useId();
  const options = [
    ...question.options,
    { label: OTHER, description: 'Something else' },
  ];
  const otherPicked = choice.picked.includes(OTHER);
  const otherField = otherPicked && (
    <TextInput
      id={otherId}
      size="xs"
      placeholder="Your answer"
      aria-label={`Your answer to: ${question.question}`}
      value={choice.other}
      onChange={(event) =>
        onChange({ ...choice, other: event.currentTarget.value })
      }
    />
  );
  const rows = options.map((option) => ({
    value: option.label,
    label: (
      <Box>
        <Text size="sm" fw={500} lh={1.3}>
          {option.label === OTHER ? 'Other' : option.label}
        </Text>
        <Text size="xs" c="dimmed" lh={1.3}>
          {option.description}
        </Text>
      </Box>
    ),
  }));
  return (
    <Stack gap={8}>
      <Text size="xs" fw={700} c="dimmed" tt="uppercase" lts="0.04em">
        {question.header}
      </Text>
      {question.multiSelect ? (
        <Checkbox.Group
          label={question.question}
          value={choice.picked}
          onChange={(picked) => onChange({ ...choice, picked })}
        >
          <Stack gap={6}>
            {rows.map((row) => (
              <Checkbox key={row.value} size="xs" {...row} />
            ))}
          </Stack>
        </Checkbox.Group>
      ) : (
        <Radio.Group
          label={question.question}
          value={choice.picked[0] ?? ''}
          onChange={(picked) => onChange({ ...choice, picked: [picked] })}
        >
          <Stack gap={6}>
            {rows.map((row) => (
              <Radio key={row.value} size="xs" {...row} />
            ))}
          </Stack>
        </Radio.Group>
      )}
      {otherField}
    </Stack>
  );
}
