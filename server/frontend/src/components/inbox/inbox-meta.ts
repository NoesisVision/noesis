import {
  BellIcon,
  CalendarIcon,
  FileTextIcon,
  type LucideIcon,
  PencilIcon,
} from 'lucide-react';
import type { InboxItem } from '@/lib/inbox';

export const KIND_ICONS: Record<InboxItem['kind'], LucideIcon> = {
  alert: BellIcon,
  transcript: FileTextIcon,
  event: CalendarIcon,
  note: PencilIcon,
};

export const KIND_LABELS: Record<InboxItem['kind'], string> = {
  alert: 'Alert',
  transcript: 'Transcript',
  event: 'Event',
  note: 'Note',
};

export const STATE_LABELS: Record<InboxItem['state'], string> = {
  open: 'Open',
  dismissed: 'Dismissed',
  promoted: 'Promoted',
  expired: 'Expired',
};
