import { useMemo } from 'react';
import { BriefcaseBusiness, FileText, Image as ImageIcon, Link2, Pin, Sparkles, Users } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SharedConversationPanel } from '@/components/chat/SharedConversationPanel';
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

  return (
    <Card className={cn('flex min-h-0 flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.96),rgba(6,17,29,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.28)]', className)}>
      <div className="shrink-0 border-b border-white/8 px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100">
              Context
            </div>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-white">
              Members, Job, Shared
            </h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
              Operational context stays attached to the current conversation and remains tenant-scoped.
            </p>
          </div>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          <section className="rounded-[26px] border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              <Users className="h-3.5 w-3.5" />
              Members
            </div>
            <div className="space-y-2">
              {members.length > 0 ? members.map((member, index) => (
                <div key={`${member.name}-${index}`} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-2">
                  <Avatar className="h-9 w-9 border border-white/10">
                    <AvatarFallback className="bg-white/[0.06] text-xs text-slate-100">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{member.name}</p>
                    <p className="text-xs text-slate-400">{member.role}</p>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-white/10 px-3 py-6 text-center text-sm text-slate-400">
                  No members available for this conversation.
                </div>
              )}
            </div>
          </section>

          {conversation?.job_id ? (
            <section className="rounded-[26px] border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                <BriefcaseBusiness className="h-3.5 w-3.5" />
                Job Details
              </div>
              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-2">
                  <span className="text-slate-500">Job ID</span>
                  <span className="font-medium text-white">{conversation.job_code || conversation.job_id}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-2">
                  <span className="text-slate-500">Status</span>
                  <span className="font-medium text-white">{conversation.job_status || 'Active'}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-2">
                  <span className="text-slate-500">Assigned</span>
                  <span className="font-medium text-white">{conversation.technician_name}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-2">
                  <span className="text-slate-500">Location</span>
                  <span className="max-w-[180px] truncate font-medium text-white">{conversation.job_location || 'Not set'}</span>
                </div>
              </div>
            </section>
          ) : null}

          <section className="rounded-[26px] border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              <Sparkles className="h-3.5 w-3.5" />
              Shared Summary
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Files</div>
                <div className="mt-1 text-lg font-semibold text-white">{fileCount}</div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Photos</div>
                <div className="mt-1 text-lg font-semibold text-white">{photoCount}</div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Links</div>
                <div className="mt-1 text-lg font-semibold text-white">{linkCount}</div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Important</div>
                <div className="mt-1 text-lg font-semibold text-white">{importantCount}</div>
              </div>
            </div>
          </section>

          <section className="rounded-[26px] border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Shared Content</div>
                <div className="mt-1 text-sm text-slate-400">Files, photos, links, and starred messages below.</div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={onUploadFiles}
                disabled={!canUpload}
                className="h-9 rounded-full bg-cyan-400 px-3 text-slate-950 hover:bg-cyan-300"
              >
                Upload
              </Button>
            </div>

            <SharedConversationPanel
              conversation={conversation}
              messages={messages}
              token={token}
              viewerRole={viewerRole}
              canUpload={canUpload}
              onUploadFiles={onUploadFiles}
            />
          </section>
        </div>
      </ScrollArea>
    </Card>
  );
}
