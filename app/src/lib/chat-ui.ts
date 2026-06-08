import type {
  BackendChatAttachment,
  BackendChatConversation,
  BackendChatMessage,
  BackendChatMessageMetadata,
} from '@/lib/backend-api';

export type ChatQuickFilter = 'all' | 'unread' | 'direct' | 'group' | 'job' | 'pinned';
export type ChatInsightTab = 'overview' | 'files' | 'pins' | 'members';
export type ChatWorkspaceTab = 'chat' | 'shared';
export type ChatSharedTab = 'files' | 'links';

export type SharedConversationAttachment = BackendChatAttachment & {
  created_at: string;
  message_id: string;
  sender_role: BackendChatMessage['sender_role'];
  conversation_type: BackendChatMessage['conversation_type'];
};

export type SharedConversationLink = {
  id: string;
  created_at: string;
  message_id: string;
  sender_role: BackendChatMessage['sender_role'];
  conversation_type: BackendChatMessage['conversation_type'];
  title: string;
  domain: string;
  url: string;
};

export function getChatMessageMetadata(message: BackendChatMessage): BackendChatMessageMetadata {
  return (message.metadata && typeof message.metadata === 'object'
    ? message.metadata
    : {}) as BackendChatMessageMetadata;
}

export function getChatMessageKind(message: BackendChatMessage): string | null {
  const metadata = getChatMessageMetadata(message);
  const kind = String(metadata.kind ?? metadata.action ?? '').trim().toLowerCase();
  return kind || null;
}

export function isImportantChatMessage(message: BackendChatMessage): boolean {
  const metadata = getChatMessageMetadata(message);
  return Boolean(metadata.important || getChatMessageKind(message) === 'important');
}

export function buildGoogleMapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

export function formatCoordinate(value: number): string {
  return Number.isFinite(value) ? value.toFixed(5) : '';
}

export function formatRelativeChatTime(value?: string | null): string {
  if (!value) return 'No activity yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No activity yet';

  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const absMinutes = Math.abs(diffMinutes);

  if (absMinutes < 1) return 'Just now';
  if (absMinutes < 60) return `${absMinutes} min ago`;

  const absHours = Math.round(absMinutes / 60);
  if (absHours < 24) return `${absHours} hr ago`;

  const absDays = Math.round(absHours / 24);
  if (absDays < 7) return `${absDays} day${absDays === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function formatConversationClock(value?: string | null): string {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
}

export function formatMessageDayLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (left: Date, right: Date) => (
    left.getFullYear() === right.getFullYear()
      && left.getMonth() === right.getMonth()
      && left.getDate() === right.getDate()
  );

  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'long', day: 'numeric' });
}

export function shouldRenderMessageDayDivider(
  messages: BackendChatMessage[],
  index: number,
): boolean {
  if (index === 0) return true;
  const current = formatMessageDayLabel(messages[index]?.created_at ?? '');
  const previous = formatMessageDayLabel(messages[index - 1]?.created_at ?? '');
  return current !== previous;
}

export function getConversationTypeLabel(conversation: BackendChatConversation | null): string {
  if (!conversation) return 'Secure chat';
  if (conversation.channel_kind === 'job') return 'Job Chat';
  if (conversation.channel_kind === 'group') return 'Technician Group';
  return 'Direct Chat';
}

export function getConversationStatusLine(conversation: BackendChatConversation | null): string {
  if (!conversation) return 'Open a secure conversation to continue.';
  if (conversation.channel_kind === 'group') {
    return `${conversation.member_count} technician${conversation.member_count === 1 ? '' : 's'} in this group`;
  }
  if (conversation.channel_kind === 'job') {
    return `${conversation.technician_name} \u00B7 ${conversation.job_status || 'Active job'}`;
  }
  return `${conversation.technician_name} \u00B7 ${conversation.technician_status}`;
}

export function filterConversationsByQuickFilter(
  conversations: BackendChatConversation[],
  filter: ChatQuickFilter,
): BackendChatConversation[] {
  switch (filter) {
    case 'unread':
      return conversations.filter((conversation) => conversation.unread_count > 0);
    case 'direct':
      return conversations.filter((conversation) => conversation.channel_kind === 'direct');
    case 'group':
      return conversations.filter((conversation) => conversation.channel_kind === 'group');
    case 'job':
      return conversations.filter((conversation) => conversation.channel_kind === 'job');
    case 'pinned':
      return conversations.filter((conversation) => conversation.pinned_count > 0);
    default:
      return conversations;
  }
}

export function buildSharedConversationAttachments(
  messages: BackendChatMessage[],
): SharedConversationAttachment[] {
  const shared: SharedConversationAttachment[] = [];
  for (const message of messages) {
    for (const attachment of message.attachments) {
      shared.push({
        ...attachment,
        created_at: message.created_at,
        message_id: message.id,
        sender_role: message.sender_role,
        conversation_type: message.conversation_type,
      });
    }
  }
  return shared.sort((left, right) => (
    new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  ));
}

function normalizeLinkCandidate(candidate: string): string | null {
  const trimmed = candidate.trim().replace(/[)\].,;!?'"<>]+$/g, '');
  if (!trimmed) {
    return null;
  }

  const prefixed = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : (trimmed.startsWith('www.') ? `https://${trimmed}` : null);

  if (!prefixed) {
    return null;
  }

  try {
    return new URL(prefixed).toString();
  } catch {
    return null;
  }
}

function extractUrlsFromText(text?: string | null): string[] {
  if (!text) {
    return [];
  }

  const matches = text.match(/(?:https?:\/\/|www\.)[^\s<>"'`]+/gi) ?? [];
  return Array.from(new Set(matches.map(normalizeLinkCandidate).filter((value): value is string => Boolean(value))));
}

function formatSharedLinkTitle(url: string): string {
  try {
    const parsed = new URL(url);
    const pathSegments = parsed.pathname.split('/').filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1];
    if (lastSegment) {
      return decodeURIComponent(lastSegment).replace(/[-_]+/g, ' ');
    }
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function buildSharedConversationLinks(
  messages: BackendChatMessage[],
): SharedConversationLink[] {
  const links: SharedConversationLink[] = [];

  for (const message of messages) {
    const metadata = getChatMessageMetadata(message);
    const metadataUrls = typeof metadata.map_url === 'string' ? [metadata.map_url] : [];
    const urls = Array.from(new Set([
      ...extractUrlsFromText(message.text),
      ...metadataUrls,
    ]));
    for (const [index, url] of urls.entries()) {
      try {
        const parsed = new URL(url);
        links.push({
          id: `${message.id}:${index}:${url}`,
          created_at: message.created_at,
          message_id: message.id,
          sender_role: message.sender_role,
          conversation_type: message.conversation_type,
          title: formatSharedLinkTitle(url),
          domain: parsed.hostname.replace(/^www\./, ''),
          url: parsed.toString(),
        });
      } catch {
        links.push({
          id: `${message.id}:${index}:${url}`,
          created_at: message.created_at,
          message_id: message.id,
          sender_role: message.sender_role,
          conversation_type: message.conversation_type,
          title: url,
          domain: url,
          url,
        });
      }
    }
  }

  return links.sort((left, right) => (
    new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  ));
}

export function formatSharedConversationTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
