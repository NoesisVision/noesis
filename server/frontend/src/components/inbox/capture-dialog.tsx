import { PaperclipIcon, XIcon } from 'lucide-react';
import * as React from 'react';
import { useInboxActions } from '@/components/inbox/use-inbox-actions';
import { useShell } from '@/components/shell/use-shell';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

// A pasted transcript can be long; keep the item reviewable, not exhaustive.
const ATTACHMENT_EXCERPT_CHARS = 4000;

/**
 * Quick capture — "drop it in seconds, before it is forgotten". A plain note
 * by default; attaching a file (any kind) turns the capture into a transcript
 * item carrying the file's leading text.
 */
export function CaptureDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { account } = useShell();
  const { capture } = useInboxActions(projectId);
  const [title, setTitle] = React.useState('');
  const [note, setNote] = React.useState('');
  const [file, setFile] = React.useState<{ name: string; text: string } | null>(
    null,
  );
  const fileInput = React.useRef<HTMLInputElement>(null);

  const reset = () => {
    setTitle('');
    setNote('');
    setFile(null);
    capture.reset();
  };

  const pickFile: React.ChangeEventHandler<HTMLInputElement> = async (
    event,
  ) => {
    const picked = event.target.files?.[0];
    if (picked === undefined) return;
    const text = (await picked.text()).slice(0, ATTACHMENT_EXCERPT_CHARS);
    setFile({ name: picked.name, text });
    // The filename is usually the right title; only fill, never overwrite.
    setTitle((current) => (current.trim() === '' ? picked.name : current));
    event.target.value = '';
  };

  const submit = () => {
    const by = account.name.trim() !== '' ? account.name : account.login;
    capture.mutate(
      file === null
        ? { kind: 'note', title: title.trim(), body: note, origin: '' }
        : {
            kind: 'transcript',
            title: title.trim(),
            body: [note.trim(), file.text].filter((s) => s !== '').join('\n\n'),
            origin: `uploaded by ${by} · ${file.name}`,
          },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Capture to inbox</DialogTitle>
          <DialogDescription>
            Lands in the team inbox for triage. Attach a file of any kind to
            capture a transcript.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Input
            aria-label="Title"
            placeholder="What needs a reaction?"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
          />
          <Textarea
            aria-label="Note"
            placeholder="Optional context"
            rows={4}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />

          {file === null ? (
            <div>
              <input
                ref={fileInput}
                type="file"
                className="sr-only"
                aria-label="Attach file"
                onChange={pickFile}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInput.current?.click()}
              >
                <PaperclipIcon />
                <span>Attach file</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm text-card-foreground shadow-xs">
              <PaperclipIcon className="size-4 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Remove attachment"
                onClick={() => setFile(null)}
              >
                <XIcon />
              </Button>
            </div>
          )}

          {capture.isError && (
            <p className="text-sm text-destructive">{capture.error.message}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={title.trim() === '' || capture.isPending}
            onClick={submit}
          >
            Capture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
