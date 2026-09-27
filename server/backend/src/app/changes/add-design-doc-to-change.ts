import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/model/change-id';
import { CreateDesignDoc } from '#backend/app/changes/model/design-doc';
import {
  type DesignDocSummary,
  summarize,
} from '#backend/app/changes/model/design-doc-summary';
import type { Handler } from '#backend/app/handler';
import { type ChangesRepository, getChangeOrThrow } from './changes.repository';

/** A new design document for the change. `designDoc` is the working file: the server mints its id. */
export const AddDesignDocToChange = z.object({
  change: ChangeId,
  designDoc: CreateDesignDoc,
});
export type AddDesignDocToChange = z.infer<typeof AddDesignDocToChange>;

export type AddDesignDocToChangeHandler = Handler<
  AddDesignDocToChange,
  DesignDocSummary
>;

export function addDesignDocToChangeHandler(
  changes: ChangesRepository,
): AddDesignDocToChangeHandler {
  return {
    /** Throws `InvalidDesignDocError` when the design document breaks its rules. */
    async handle(command) {
      const change = await getChangeOrThrow(changes, command.change);
      const added = change.addDesignDoc(command.designDoc);
      await changes.save(change);
      return summarize(added);
    },
  };
}
