import { useMemo } from 'react';
import { Check, CheckCheck, MoreHorizontal, Pin, Reply, Sparkles, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AttachmentCard } from '@/components/chat/AttachmentCard';
import { StructuredMessageCard } from '@/components/chat/StructuredMessageCard';
import {
  formatConversationClock,
  getChatMessageMetadata,
  groupChatMessages,
  isImportantChatMessage,
  type ChatMessageGroup,
} from '@/lib/chat-ui';
import { cn } from '@/lib/utils';
import type { BackendChatConversation, BackendChatMessage } from '@/lib/backend-api';

type ViewerRole = 'admin' | 'technician';

type ChatMessageTimelineProps = {
  messages: BackendChatMessage[];
  conversation: BackendChatConversation | null;
  token: string;
  viewerRole: ViewerRole;
  outgoingRole: BackendChatMessage['sender_role'];
  getSenderLabel: (message: BackendChatMessage) => string;
  onOpenJob: (jobId: string) => void;
  onReply: (message: BackendChatMessage) => void;
  onTogglePin?: (message: BackendChatMessage) => void;
  onMarkImportant: (message: BackendChatMessage) => void;
  onDelete?: (message: BackendChatMessage) => void;
  className?: string;
};

function renderMessageStatus(message: BackendChatMessage) {
  if (message.read_at) {
    return <CheckCheck className="h-3.5 w-3.5 text-cyan-300" />;
  }
  if (message.delivered_at) {
    return <CheckCheck className="h-3.5 w-3.5 text-slate-400" />;
  }
  return <Check className="h-3.5 w-3.5 text-slate-500" />;
}

function getReplySnippet(message: BackendChatMessage): { sender: string; text: string } | null {
  const metadata = getChatMessageMetadata(message);
  const sender = typeof metadata.reply_to_sender_name === 'string' ? metadata.reply_to_sender_name.trim() : '';
  const text = typeof metadata.reply_to_text === 'string' ? metadata.reply_to_text.trim() : '';
  if (!sender && !text) {
    return null;
  }
  return {
    sender: sender || 'Reply',
    text: text || 'Quoted reply',
  };
}

type MessageBubbleProps = {
  message: BackendChatMessage;
  conversation: BackendChatConversation | null;
  token: string;
  viewerRole: ViewerRole;
  outgoingRole: BackendChatMessage['sender_role'];
  senderLabel: string;
  onOpenJob: (jobId: string) => void;
  onReply: (message: BackendChatMessage) => void;
  onTogglePin?: (message: BackendChatMessage) => void;
  onMarkImportant: (message: BackendChatMessage) => void;
  onDelete?: (message: BackendChatMessage) => void;
};

function MessageBubble({
  message,
  conversation,
  token,
  viewerRole,
  outgoingRole,
  senderLabel,
  onOpenJob,
  onReply,
  onTogglePin,
  onMarkImportant,
  onDelete,
}: MessageBubbleProps) {
  const isOutgoing = message.sender_role === outgoingRole;
  const replySnippet = getReplySnippet(message);
  const bubbleTone = isOutgoing ? 'light' : 'dark';

  return (
    <div className="group relative">
      <div
        className={cn(
          'relative max-w-[min(64%,39rem)] rounded-[18px] border px-3.5 py-3 shadow-none',
          isOutgoing
            ? 'ml-auto border-sky-300/20 bg-sky-500 text-white'
            : 'mr-auto border-white/8 bg-[#111a2a] text-white',
          isImportantChatMessage(message) && 'ring-1 ring-amber-300/20',
        )}
      >
        <div className="absolute right-1.5 top-1.5 opacity-0 transition group-hover:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className={cn(
                  'h-7 w-7 rounded-full',
                  isOutgoing
                    ? 'text-slate-950 hover:bg-white/20 hover:text-slate-950'
                    : 'text-slate-300 hover:bg-white/[0.08] hover:text-white',
                )}
                aria-label="Message actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border-white/10 bg-[#091827] text-slate-100">
              <DropdownMenuItem onSelect={() => onReply(message)}>
                <Reply className="h-4 w-4" />
                Reply
              </DropdownMenuItem>
              {viewerRole === 'admin' && onTogglePin ? (
                <DropdownMenuItem onSelect={() => onTogglePin(message)}>
                  <Pin className="h-4 w-4" />
                  {message.is_pinned ? 'Unpin message' : 'Pin message'}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={() => onMarkImportant(message)}>
                <Sparkles className="h-4 w-4" />
                Mark Important
              </DropdownMenuItem>
              {viewerRole === 'admin' || onDelete ? (
                <>
                  <DropdownMenuSeparator className="bg-white/10" />
                  {onDelete ? (
                    <DropdownMenuItem onSelect={() => onDelete(message)}>
                      <Trash2 className="h-4 w-4" />
                      Delete message
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem disabled>
                      <Trash2 className="h-4 w-4" />
                      Delete message
                    </DropdownMenuItem>
                  )}
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-2">
          {replySnippet ? (
            <div className={cn(
              'rounded-2xl border-l-2 px-3 py-2 text-xs',
              isOutgoing
                ? 'border-white/40 bg-white/15 text-white'
                : 'border-cyan-300/20 bg-white/[0.04] text-slate-300',
            )}>
              <div className="font-semibold">{replySnippet.sender}</div>
              <div className="line-clamp-2 opacity-80">{replySnippet.text}</div>
            </div>
          ) : null}

          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            {message.is_pinned ? <Pin className={cn('h-3.5 w-3.5', isOutgoing ? 'text-white' : 'text-cyan-300')} /> : null}
            {message.attachments.some((attachment) => attachment.attachment_type === 'voice') ? (
              <Badge
                variant="outline"
                className={cn(
                  'h-5 border-cyan-300/20 px-2 text-[10px]',
                  isOutgoing ? 'bg-white/15 text-white' : 'bg-cyan-300/10 text-cyan-100',
                )}
              >
                Voice note
              </Badge>
            ) : null}
            {message.conversation_type === 'job' && message.job_id ? (
              <Badge
                variant="outline"
                className={cn(
                  'h-5 border-emerald-300/20 px-2 text-[10px]',
                  isOutgoing ? 'bg-white/15 text-white' : 'bg-emerald-300/10 text-emerald-100',
                )}
              >
                {conversation?.job_code || 'Job'}
              </Badge>
            ) : null}
          </div>

          <StructuredMessageCard
            message={message}
            conversation={conversation}
            viewerRole={viewerRole}
            tone={bubbleTone}
            onOpenJob={onOpenJob}
          />

          {message.text && (!message.metadata?.kind || message.metadata.kind === 'important' || message.metadata.kind === 'site_photo') ? (
            <p className="text-[15px] leading-6">{message.text}</p>
          ) : null}

          {message.attachments.length > 0 ? (
            <div className={cn(
              'mt-3 grid gap-2',
              message.attachments.length === 1
                ? 'grid-cols-1'
                : message.attachments.length === 2
                  ? 'grid-cols-2'
                  : 'grid-cols-3',
            )}>
              {message.attachments.map((attachment) => (
                <AttachmentCard
                  key={attachment.id}
                  attachment={attachment}
                  token={token}
                  tone={bubbleTone}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className={cn(
        'mt-1 flex items-center gap-2 px-1 text-[11px] text-slate-500',
        isOutgoing ? 'justify-end' : 'justify-start',
      )}>
        <span>{formatConversationClock(message.created_at)}</span>
        {isOutgoing ? renderMessageStatus(message) : null}
      </div>
    </div>
  );
}

export function ChatMessageTimeline({
  messages,
  conversation,
  token,
  viewerRole,
  outgoingRole,
  getSenderLabel,
  onOpenJob,
  onReply,
  onTogglePin,
  onMarkImportant,
  onDelete,
  className,
}: ChatMessageTimelineProps) {
  const groups = useMemo(() => groupChatMessages(messages, getSenderLabel), [getSenderLabel, messages]);

  if (groups.length === 0) {
    return (
      <div className={cn('flex min-h-[320px] flex-col items-center justify-center py-10 text-center', className)}>
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.04]">
          <Reply className="h-8 w-8 text-slate-500" />
        </div>
        <h3 className="text-lg font-semibold text-white">No messages yet</h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
          Start the thread with a secure message, file, or voice note.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {groups.map((group: ChatMessageGroup) => {
        const isOutgoing = group.senderRole === outgoingRole;
        return (
          <div key={group.key} className="space-y-2.5">
            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-white/8" />
              <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
                {group.dateLabel}
              </span>
              <div className="h-px flex-1 bg-white/8" />
            </div>
            <div className={cn('flex', isOutgoing ? 'justify-end' : 'justify-start')}>
              <div className="w-full max-w-[min(68%,39rem)] space-y-2">
                <p className={cn(
                  'px-1 text-[10px] font-semibold uppercase tracking-[0.18em]',
                  isOutgoing ? 'text-right text-slate-500' : 'text-left text-slate-400',
                )}>
                  {group.senderName}
                </p>
                <div className="space-y-3">
                  {group.messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      conversation={conversation}
                      token={token}
                      viewerRole={viewerRole}
                      outgoingRole={outgoingRole}
                      senderLabel={group.senderName}
                      onOpenJob={onOpenJob}
                      onReply={onReply}
                      onTogglePin={onTogglePin}
                      onMarkImportant={onMarkImportant}
                      onDelete={onDelete}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
