import { useEffect, useMemo, useState } from 'react';
import {
  AudioLines,
  Copy,
  Download,
  ExternalLink,
  Eye,
  File as FileIcon,
  FileText,
  Image as ImageIcon,
  Link2,
  MoreHorizontal,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  buildSharedConversationAttachments,
  buildSharedConversationLinks,
  formatSharedConversationTimestamp,
  type ChatSharedTab,
  type SharedConversationAttachment,
  type SharedConversationLink,
} from '@/lib/chat-ui';
import {
  fetchSecureChatAttachmentBlob,
  formatChatAttachmentSize,
  isAudioAttachment,
  isImageAttachment,
} from '@/lib/chat-attachments';
import type { BackendChatConversation, BackendChatMessage } from '@/lib/backend-api';

type ViewerRole = 'admin' | 'technician';

type SharedConversationPanelProps = {
  conversation: BackendChatConversation | null;
  messages: BackendChatMessage[];
  token: string;
  viewerRole: ViewerRole;
  canUpload: boolean;
  onUploadFiles: () => void;
};

function getAttachmentKindLabel(attachment: SharedConversationAttachment): string {
  if (attachment.attachment_type === 'voice' || isAudioAttachment(attachment.mime_type)) {
    return 'Voice';
  }
  if (isImageAttachment(attachment.mime_type)) {
    return 'Image';
  }
  if (attachment.mime_type === 'application/pdf') {
    return 'PDF';
  }
  if (
    attachment.mime_type === 'application/msword'
    || attachment.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || attachment.mime_type === 'text/plain'
  ) {
    return 'Document';
  }
  return 'File';
}

function getConversationSenderLabel(
  viewerRole: ViewerRole,
  conversation: BackendChatConversation | null,
  senderRole: BackendChatMessage['sender_role'],
): string {
  if (senderRole === 'admin') {
    return 'Admin Dispatch';
  }

  if (!conversation) {
    return 'Technician';
  }

  if (conversation.channel_kind === 'group') {
    return conversation.title || 'Technician Group';
  }

  return viewerRole === 'technician'
    ? 'You'
    : (conversation.technician_name || 'Technician');
}

function matchesSearch(search: string, values: Array<string | number | null | undefined>): boolean {
  if (!search) {
    return true;
  }
  return values.some((value) => String(value ?? '').toLowerCase().includes(search));
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success('Copied to clipboard.');
  } catch {
    toast.error('Unable to copy to clipboard.');
  }
}

async function openBlobInNewTab(blob: Blob, fallbackName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const win = window.open(objectUrl, '_blank', 'noopener,noreferrer');
  if (!win) {
    URL.revokeObjectURL(objectUrl);
    toast.error(`Preview blocked for ${fallbackName}.`);
    return;
  }
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

async function handleDataUrlPreview(dataUrl: string, fallbackName: string) {
  const win = window.open(dataUrl, '_blank', 'noopener,noreferrer');
  if (!win) {
    toast.error(`Preview blocked for ${fallbackName}.`);
  }
}

export function SharedConversationPanel({
  conversation,
  messages,
  token,
  viewerRole,
  canUpload,
  onUploadFiles,
}: SharedConversationPanelProps) {
  const [activeTab, setActiveTab] = useState<ChatSharedTab>('files');
  const [search, setSearch] = useState('');
  const searchQuery = search.trim().toLowerCase();

  useEffect(() => {
    setActiveTab('files');
    setSearch('');
  }, [conversation?.id]);

  const messageById = useMemo(() => new Map(messages.map((message) => [message.id, message])), [messages]);
  const sharedFiles = useMemo(() => buildSharedConversationAttachments(messages), [messages]);
  const sharedLinks = useMemo(() => buildSharedConversationLinks(messages), [messages]);

  const filteredFiles = useMemo(() => sharedFiles.filter((attachment) => {
    const message = messageById.get(attachment.message_id);
    const senderLabel = getConversationSenderLabel(viewerRole, conversation, attachment.sender_role);
    const context = message?.text?.trim() || '';
    return matchesSearch(searchQuery, [
      attachment.name,
      attachment.mime_type,
      getAttachmentKindLabel(attachment),
      formatChatAttachmentSize(attachment.size_bytes),
      senderLabel,
      context,
      formatSharedConversationTimestamp(attachment.created_at),
    ]);
  }), [conversation, messageById, searchQuery, sharedFiles, viewerRole]);

  const filteredLinks = useMemo(() => sharedLinks.filter((link) => {
    const message = messageById.get(link.message_id);
    const senderLabel = getConversationSenderLabel(viewerRole, conversation, link.sender_role);
    const context = message?.text?.trim() || '';
    return matchesSearch(searchQuery, [
      link.title,
      link.domain,
      link.url,
      senderLabel,
      context,
      formatSharedConversationTimestamp(link.created_at),
    ]);
  }), [conversation, messageById, searchQuery, sharedLinks, viewerRole]);

  const handlePreviewAttachment = async (attachment: SharedConversationAttachment) => {
    try {
      if (attachment.data_url) {
        await handleDataUrlPreview(attachment.data_url, attachment.name);
        return;
      }

      const path = attachment.preview_url || attachment.download_url;
      if (!path || !token) {
        toast.error('Preview is unavailable for this file.');
        return;
      }

      const blob = await fetchSecureChatAttachmentBlob(path, token);
      await openBlobInNewTab(blob, attachment.name);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to open preview.');
    }
  };

  const handleDownloadAttachment = async (attachment: SharedConversationAttachment) => {
    try {
      if (attachment.data_url) {
        const anchor = document.createElement('a');
        anchor.href = attachment.data_url;
        anchor.download = attachment.name;
        anchor.click();
        return;
      }

      const path = attachment.download_url || attachment.preview_url;
      if (!path || !token) {
        toast.error('Download is unavailable for this file.');
        return;
      }

      const blob = await fetchSecureChatAttachmentBlob(path, token);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = attachment.name;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to download file.');
    }
  };

  const handleOpenLink = async (link: SharedConversationLink) => {
    const win = window.open(link.url, '_blank', 'noopener,noreferrer');
    if (!win) {
      toast.error(`Unable to open ${link.domain}.`);
    }
  };

  const renderFileRow = (attachment: SharedConversationAttachment) => {
    const message = messageById.get(attachment.message_id);
    const senderLabel = message ? getConversationSenderLabel(viewerRole, conversation, message.sender_role) : 'Technician';
    const context = message?.text?.trim();
    const canPreview = Boolean(attachment.data_url || attachment.preview_url || attachment.download_url);
    const canDownload = Boolean(attachment.data_url || attachment.download_url || attachment.preview_url);
    const kindLabel = getAttachmentKindLabel(attachment);

    return (
      <div
        key={attachment.id}
        className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.16)]"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#08131d] text-slate-100">
              {isImageAttachment(attachment.mime_type) ? (
                <ImageIcon className="h-6 w-6 text-cyan-300" />
              ) : isAudioAttachment(attachment.mime_type) ? (
                <AudioLines className="h-6 w-6 text-cyan-300" />
              ) : (
                <FileText className="h-6 w-6 text-slate-200" />
              )}
            </div>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-white">{attachment.name}</p>
                <Badge className="rounded-full bg-cyan-300/10 text-cyan-100">{kindLabel}</Badge>
                <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-[10px] text-slate-300">
                  {attachment.mime_type}
                </Badge>
              </div>
              <p className="text-xs text-slate-400">
                {formatChatAttachmentSize(attachment.size_bytes)}
                {' \u00B7 '}
                {senderLabel}
                {' \u00B7 '}
                {formatSharedConversationTimestamp(attachment.created_at)}
              </p>
              {context ? (
                <p className="line-clamp-2 max-w-3xl text-xs leading-6 text-slate-500">
                  {context}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void handlePreviewAttachment(attachment)}
              disabled={!canPreview}
              className="h-9 gap-2 rounded-full border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
            >
              <Eye className="h-4 w-4" />
              Preview
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void handleDownloadAttachment(attachment)}
              disabled={!canDownload}
              className="h-9 gap-2 rounded-full border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 rounded-full border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
                  aria-label={`More actions for ${attachment.name}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border-white/10 bg-[#091827] text-slate-100">
                <DropdownMenuItem onSelect={() => void handlePreviewAttachment(attachment)} disabled={!canPreview}>
                  <Eye className="h-4 w-4" />
                  Preview file
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void handleDownloadAttachment(attachment)} disabled={!canDownload}>
                  <Download className="h-4 w-4" />
                  Download file
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem onSelect={() => void copyText(attachment.name)}>
                  <Copy className="h-4 w-4" />
                  Copy filename
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void copyText(attachment.mime_type)}>
                  <Copy className="h-4 w-4" />
                  Copy MIME type
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    );
  };

  const renderLinkRow = (link: SharedConversationLink) => {
    const message = messageById.get(link.message_id);
    const senderLabel = message ? getConversationSenderLabel(viewerRole, conversation, message.sender_role) : 'Technician';
    const context = message?.text?.trim();

    return (
      <div
        key={link.id}
        className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.16)]"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#08131d] text-cyan-300">
              <Link2 className="h-6 w-6" />
            </div>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-white">{link.title}</p>
                <Badge className="rounded-full bg-cyan-300/10 text-cyan-100">{link.domain || 'Link'}</Badge>
              </div>
              <p className="text-xs text-slate-400">
                {senderLabel}
                {' \u00B7 '}
                {formatSharedConversationTimestamp(link.created_at)}
              </p>
              {context ? (
                <p className="line-clamp-2 max-w-3xl text-xs leading-6 text-slate-500">
                  {context}
                </p>
              ) : null}
              <p className="truncate text-xs text-slate-500">{link.url}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void handleOpenLink(link)}
              className="h-9 gap-2 rounded-full border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
            >
              <ExternalLink className="h-4 w-4" />
              Open
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void copyText(link.url)}
              className="h-9 gap-2 rounded-full border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
            >
              <Copy className="h-4 w-4" />
              Copy
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 rounded-full border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
                  aria-label={`More actions for ${link.title}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border-white/10 bg-[#091827] text-slate-100">
                <DropdownMenuItem onSelect={() => void handleOpenLink(link)}>
                  <ExternalLink className="h-4 w-4" />
                  Open link
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void copyText(link.url)}>
                  <Copy className="h-4 w-4" />
                  Copy URL
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void copyText(link.domain)}>
                  <Copy className="h-4 w-4" />
                  Copy domain
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    );
  };

  const fileCount = filteredFiles.length;
  const linkCount = filteredLinks.length;

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as ChatSharedTab)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="shrink-0 border-b border-white/8 bg-[linear-gradient(180deg,rgba(9,24,39,0.98),rgba(6,17,29,0.98))] px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100">
              Shared
            </div>
            <h3 className="text-xl font-semibold tracking-[-0.04em] text-white">Files &amp; Links</h3>
            <p className="max-w-2xl text-sm leading-6 text-slate-400">
              Tenant-scoped files and links from this conversation. Secure previews and downloads stay permission checked.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-white/10 bg-white/[0.03] px-3 py-2 text-slate-100">
              {fileCount} files
            </Badge>
            <Badge variant="outline" className="border-white/10 bg-white/[0.03] px-3 py-2 text-slate-100">
              {linkCount} links
            </Badge>
            <Button
              type="button"
              size="sm"
              onClick={onUploadFiles}
              disabled={!canUpload}
              className="h-10 gap-2 rounded-full bg-cyan-400 px-4 text-slate-950 hover:bg-cyan-300"
            >
              <Upload className="h-4 w-4" />
              Upload files
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search files, links, senders, or notes"
              className="h-11 w-full rounded-full border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/30 focus:ring-2 focus:ring-cyan-300/10"
            />
          </div>

          <TabsList className="h-11 rounded-full border border-white/10 bg-white/[0.04] p-1">
            <TabsTrigger value="files" className="h-9 rounded-full px-4 text-sm text-slate-300 data-[state=active]:bg-cyan-300 data-[state=active]:text-slate-950">
              Files
            </TabsTrigger>
            <TabsTrigger value="links" className="h-9 rounded-full px-4 text-sm text-slate-300 data-[state=active]:bg-cyan-300 data-[state=active]:text-slate-950">
              Links
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      <TabsContent value="files" className="mt-0 flex min-h-0 flex-1 flex-col">
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-3 px-5 py-5">
            {filteredFiles.length > 0 ? (
              filteredFiles.map(renderFileRow)
            ) : (
              <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[26px] border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.05]">
                  <FileIcon className="h-8 w-8 text-slate-500" />
                </div>
                <h4 className="text-lg font-semibold text-white">
                  {searchQuery ? 'No shared files matched your search' : 'No files have been shared yet'}
                </h4>
                <p className="mt-2 max-w-lg text-sm leading-6 text-slate-400">
                  Upload secure files from the composer or attach them to a reply to make them appear here.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="links" className="mt-0 flex min-h-0 flex-1 flex-col">
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-3 px-5 py-5">
            {filteredLinks.length > 0 ? (
              filteredLinks.map(renderLinkRow)
            ) : (
              <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[26px] border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.05]">
                  <Link2 className="h-8 w-8 text-slate-500" />
                </div>
                <h4 className="text-lg font-semibold text-white">
                  {searchQuery ? 'No shared links matched your search' : 'No links have been shared yet'}
                </h4>
                <p className="mt-2 max-w-lg text-sm leading-6 text-slate-400">
                  Links pasted into a message will appear here with open and copy actions for fast follow-up.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}
