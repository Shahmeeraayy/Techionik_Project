import { useMemo } from 'react';
import { BriefcaseBusiness, FileText, Image as ImageIcon, Link2, Pin, Sparkles, Users } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  buildImportantConversationMessages,
  buildSharedConversationAttachments,
  buildSharedConversationLinks,
  buildSharedConversationPhotos,
  formatSharedConversationTimestamp,
} from '@/lib/chat-ui';
import { cn } from '@/lib/utils';
import type { BackendChatConversation, BackendChatMessage } from '@/lib/backend-api';

type ViewerRole = 'admin' | 'technician';

type ChatContextPanelProps = {
  conversation: BackendChatConversation | null;
  messages: BackendChatMessage[];
  token: string;
  viewerRole: ViewerRole;
  currentUserName?: string | null;
  canUpload: boolean;
  onUploadFiles: () => void;
  className?: string;
};

function getInitials(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((chunk) => chunk[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'NO';
}

export function ChatContextPanel({
  conversation,
  messages,
  token,
  viewerRole,
  currentUserName,
  canUpload,
  onUploadFiles,
  className,
}: ChatContextPanelProps) {
  const sharedFiles = useMemo(() => buildSharedConversationAttachments(messages), [messages]);
  const sharedPhotos = useMemo(() => buildSharedConversationPhotos(messages), [messages]);
  const sharedLinks = useMemo(() => buildSharedConversationLinks(messages), [messages]);
  const importantMessages = useMemo(() => buildImportantConversationMessages(messages), [messages]);

  const members = useMemo(() => {
    if (!conversation) return [];
    const ownerName = currentUserName?.trim() || (viewerRole === 'admin' ? 'Admin' : 'Technician');
    const entries = [
      { name: ownerName, role: viewerRole === 'admin' ? 'Admin' : 'Technician' },
    ];
    if (conversation.channel_kind === 'group') {
      for (const name of conversation.member_names.slice(0, 5)) {
        if (name && name.trim().length > 0 && name.trim() !== ownerName) {
          entries.push({ name, role: 'Technician' });
        }
      }
    } else {
      entries.push({
        name: conversation.technician_name || 'Technician',
        role: 'Technician',
      });
    }
    return entries;
  }, [conversation, currentUserName, viewerRole]);

  const fileCount = sharedFiles.filter((attachment) => (
    attachment.attachment_type !== 'image'
    && !attachment.mime_type.toLowerCase().startsWith('image/')
  )).length;

  const photoCount = sharedPhotos.length;
  const linkCount = sharedLinks.length;
  const importantCount = importantMessages.length;
  const pinnedMessages = messages.filter((message) => message.is_pinned);

  return (
    <div className={cn('flex min-h-0 flex-col overflow-hidden bg-[linear-gradient(180deg,rgba(9,24,39,0.96),rgba(6,17,29,0.96))]', className)}>
      <div className="shrink-0 border-b border-white/8 px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Context
            </div>
            <h3 className="mt-1 text-base font-semibold tracking-[-0.03em] text-white">
              Conversation details
            </h3>
          </div>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              <Users className="h-3.5 w-3.5" />
              Members
            </div>
            <div className="space-y-1.5">
              {members.length > 0 ? members.map((member, index) => (
                <div key={`${member.name}-${index}`} className="flex items-center gap-3 rounded-[14px] px-2 py-2 hover:bg-white/[0.03]">
                  <Avatar className="h-8 w-8 border border-white/10">
                    <AvatarFallback className="bg-white/[0.06] text-xs text-slate-100">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{member.name}</p>
                    <p className="text-xs text-slate-500">{member.role}</p>
                  </div>
                </div>
              )) : (
                <div className="rounded-[14px] border border-dashed border-white/10 px-3 py-4 text-center text-sm text-slate-400">
                  No members available for this conversation.
                </div>
              )}
            </div>
          </section>

          {conversation?.job_id ? (
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                <BriefcaseBusiness className="h-3.5 w-3.5" />
                Job Details
              </div>
              <div className="space-y-1.5 text-sm text-slate-300">
                <div className="flex items-center justify-between gap-3 rounded-[14px] px-2 py-2 hover:bg-white/[0.03]">
                  <span className="text-slate-500">Job ID</span>
                  <span className="font-medium text-white">{conversation.job_code || conversation.job_id}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-[14px] px-2 py-2 hover:bg-white/[0.03]">
                  <span className="text-slate-500">Status</span>
                  <span className="font-medium text-white">{conversation.job_status || 'Active'}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-[14px] px-2 py-2 hover:bg-white/[0.03]">
                  <span className="text-slate-500">Assigned</span>
                  <span className="font-medium text-white">{conversation.technician_name}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-[14px] px-2 py-2 hover:bg-white/[0.03]">
                  <span className="text-slate-500">Location</span>
                  <span className="max-w-[180px] truncate font-medium text-white">{conversation.job_location || 'Not set'}</span>
                </div>
              </div>
            </section>
          ) : null}

          <section className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              <Sparkles className="h-3.5 w-3.5" />
              Shared Summary
            </div>
            <div className="space-y-1.5">
              {[
                ['Files', fileCount],
                ['Photos', photoCount],
                ['Links', linkCount],
                ['Important', importantCount],
              ].map(([label, count]) => (
                <div key={label} className="flex items-center justify-between gap-3 rounded-[14px] px-2 py-2 hover:bg-white/[0.03]">
                  <span className="text-sm text-slate-400">{label}</span>
                  <span className="text-sm font-medium text-white">{count}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              <span className="flex items-center gap-2">
                <Pin className="h-3.5 w-3.5" />
                Pinned
              </span>
              <Button
                type="button"
                size="sm"
                onClick={onUploadFiles}
                disabled={!canUpload}
                className="h-8 rounded-full bg-cyan-400 px-3 text-[11px] text-slate-950 hover:bg-cyan-300"
              >
                Upload
              </Button>
            </div>
            <div className="space-y-1.5">
              {pinnedMessages.length > 0 ? pinnedMessages.slice(0, 3).map((message) => (
                <div key={message.id} className="rounded-[14px] px-2 py-2 hover:bg-white/[0.03]">
                  <p className="text-sm font-medium text-white">
                    {message.text || message.attachments[0]?.name || 'Pinned message'}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatSharedConversationTimestamp(message.created_at)}
                  </p>
                </div>
              )) : (
                <div className="rounded-[14px] border border-dashed border-white/10 px-3 py-4 text-sm text-slate-400">
                  No pinned messages yet.
                </div>
              )}
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
