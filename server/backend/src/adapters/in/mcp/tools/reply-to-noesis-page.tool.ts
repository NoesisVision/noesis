import { z } from 'zod';
import { CREATE, defineTool, type ToolRegistration } from '../tool';
import { REPLY_TO_NOESIS_PAGE } from '../tool-names';
import { success } from '../tool-result';

/** Where a reply lands: the page's transcript. */
export interface PageReplies {
  reply(text: string): void;
}

const inputSchema = z
  .object({
    text: z.string().min(1).describe('What to say to the person, in Markdown.'),
  })
  .describe('The answer to a message the Noesis page sent as a channel event.');

const outputSchema = z.object({ delivered: z.literal(true) });

export function replyToNoesisPageTool(replies: PageReplies): ToolRegistration {
  return defineTool(
    REPLY_TO_NOESIS_PAGE,
    {
      title: 'Reply to the Noesis page',
      description:
        'Answers the person reading the Noesis page, who sent a message as a <channel source="noesis"> event. Use it only to answer such a message; the terminal does not show the text, the page does.',
      inputSchema,
      outputSchema,
      annotations: CREATE,
    },
    (input) => {
      replies.reply(input.text);
      return Promise.resolve(
        success('Delivered to the Noesis page.', { delivered: true }),
      );
    },
  );
}
