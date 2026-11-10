import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import type { AgentSessionListener } from '#backend/app/agent/agent-transcript';
import {
  AnswerAgentQuestion,
  type AnswerAgentQuestionHandler,
} from '#backend/app/agent/answer-agent-question';
import {
  DecideAgentPermission,
  type DecideAgentPermissionHandler,
} from '#backend/app/agent/decide-agent-permission';
import type { FindAgentSessionHandler } from '#backend/app/agent/find-agent-session';
import type { InterruptAgentHandler } from '#backend/app/agent/interrupt-agent';
import {
  SendAgentMessage,
  type SendAgentMessageHandler,
} from '#backend/app/agent/send-agent-message';
import {
  UploadAgentFile,
  type UploadAgentFileHandler,
} from '#backend/app/agent/upload-agent-file';
import { jsonBody, workingFileLimit } from '../json-body';

export interface AgentDeps {
  findAgentSession: FindAgentSessionHandler;
  /** Calls the listener with the session on every change, until unsubscribed. */
  followAgentSession: (listener: AgentSessionListener) => () => void;
  sendAgentMessage: SendAgentMessageHandler;
  answerAgentQuestion: AnswerAgentQuestionHandler;
  decideAgentPermission: DecideAgentPermissionHandler;
  interruptAgent: InterruptAgentHandler;
  uploadAgentFile: UploadAgentFileHandler;
}

/**
 * Mounted at `/ui/agent`. The page reads the session whole and follows it as
 * server-sent events; what it sends in goes through the same handlers an
 * agent's own surface would.
 */
export function createAgentApp(deps: AgentDeps) {
  const {
    findAgentSession,
    followAgentSession,
    sendAgentMessage,
    answerAgentQuestion,
    decideAgentPermission,
    interruptAgent,
    uploadAgentFile,
  } = deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return (
    new Hono()
      .get('/', async (c) => {
        return c.json({ session: await findAgentSession.handle() });
      })

      .get('/events', (c) =>
        streamSSE(c, async (stream) => {
          // A write after the page has gone is nothing to report: the abort
          // that follows ends the stream.
          const send = (session: unknown) =>
            stream
              .writeSSE({ event: 'session', data: JSON.stringify(session) })
              .catch(() => undefined);
          // Subscribed before the first snapshot, so no change falls between.
          const unsubscribe = followAgentSession(
            (session) => void send(session),
          );
          await send(await findAgentSession.handle());
          // A comment line is a beat the browser ignores and the server's idle
          // timeout counts.
          const beat = setInterval(
            () => void stream.write(': beat\n\n'),
            20_000,
          );
          await new Promise<void>((resolve) => {
            stream.onAbort(() => {
              clearInterval(beat);
              unsubscribe();
              resolve();
            });
          });
        }),
      )

      .post(
        '/messages',
        workingFileLimit,
        jsonBody(SendAgentMessage),
        async (c) => {
          return c.json(
            { session: await sendAgentMessage.handle(c.req.valid('json')) },
            202,
          );
        },
      )

      .post('/answers', jsonBody(AnswerAgentQuestion), async (c) => {
        return c.json({
          session: await answerAgentQuestion.handle(c.req.valid('json')),
        });
      })

      .post('/decisions', jsonBody(DecideAgentPermission), async (c) => {
        return c.json({
          session: await decideAgentPermission.handle(c.req.valid('json')),
        });
      })

      // A JSON body, so a cross-site form post cannot stop a turn: the
      // `csrf()` guard reads only form-style bodies, and a JSON one is a
      // request another site cannot send without CORS.
      .post('/interrupt', jsonBody(z.object({})), async (c) => {
        return c.json({ session: await interruptAgent.handle() });
      })

      .post(
        '/files',
        workingFileLimit,
        jsonBody(UploadAgentFile),
        async (c) => {
          const attachment = await uploadAgentFile.handle(c.req.valid('json'));
          return c.json({ attachment }, 201);
        },
      )
  );
}
