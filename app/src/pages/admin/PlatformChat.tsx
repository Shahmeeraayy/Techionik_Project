import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioLines,
  Bell,
  Check,
  CheckCheck,
  File,
  Image as ImageIcon,
  Mic,
  MessageCircleMore,
  Megaphone,
  Paperclip,
  Search,
  Send,
  Square,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useVoiceNoteRecorder } from '@/hooks/use-voice-note-recorder';
import {
  CHAT_ATTACHMENT_ACCEPT,
  fileToChatAttachment,
  formatChatAttachmentSize,
  formatVoiceRecordingDuration,
  getChatAttachmentValidationMessage,
  isAudioAttachment,
  isImageAttachment,
} from '@/lib/chat-attachments';
import {
  broadcastAdminChatMessage,
  fetchAdminChatConversations,
  fetchAdminChatMessages,
  getStoredAdminToken,
  markAdminChatConversationRead,
  sendAdminChatMessage,
  type BackendAdminChatConversation,
  type BackendChatAttachment,
  type BackendChatMessage,
} from '@/lib/backend-api';

const CHAT_UNREAD_STORAGE_KEY = 'sm_admin_chat_unread_count';

function formatMessageStatus(message: BackendChatMessage) {
  if (message.read_at) {
    return <CheckCheck className="h-3.5 w-3.5 text-cyan-300" />;
  }
  if (message.delivered_at) {
    return <CheckCheck className="h-3.5 w-3.5 text-slate-400" />;
  }
  return <Check className="h-3.5 w-3.5 text-slate-500" />;
}

function getAttachmentIcon(mimeType: string) {
  if (isImageAttachment(mimeType)) {
    return ImageIcon;
  }
  if (isAudioAttachment(mimeType)) {
    return AudioLines;
  }
  return File;
}

function AttachmentCard({ attachment }: { attachment: BackendChatAttachment }) {
  const isImage = isImageAttachment(attachment.mime_type);
  const isAudio = isAudioAttachment(attachment.mime_type);
  const AttachmentIcon = getAttachmentIcon(attachment.mime_type);
  const sizeLabel = formatChatAttachmentSize(attachment.size_bytes);

  return (
    <div
      className="overflow-hidden rounded-2xl border border-black/10 bg-white/95"
    >
      {isImage ? (
        <div className="aspect-[1/0.9] overflow-hidden bg-slate-950">
          <img src={attachment.data_url} alt={attachment.name} className="h-full w-full object-cover" />
        </div>
      ) : isAudio ? (
        <div className="bg-slate-50 p-4">
          <div className="rounded-[22px] border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
              <AudioLines className="h-4 w-4 text-[#2F8E92]" />
              Voice message
            </div>
            <audio controls preload="metadata" src={attachment.data_url} className="w-full" />
          </div>
        </div>
      ) : (
        <div className="flex aspect-[1/0.9] items-center justify-center bg-slate-100 text-slate-700">
          <AttachmentIcon className="h-7 w-7" />
        </div>
      )}
      <div className="space-y-2 px-3 py-2">
        <div className="space-y-1">
          <p className="truncate text-xs font-medium text-slate-800">{attachment.name}</p>
          <p className="text-[11px] text-slate-500">{sizeLabel}</p>
        </div>
        <a
          href={attachment.data_url}
          download={attachment.name}
          className="inline-flex text-[11px] font-medium text-[#2F8E92] transition hover:text-[#267276]"
        >
          Download
        </a>
      </div>
    </div>
  );
}

export default function PlatformChatPage() {
  const [contacts, setContacts] = useState<BackendAdminChatConversation[]>([]);
  const [messages, setMessages] = useState<BackendChatMessage[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string>('');
  const [contactSearch, setContactSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [draftMessage, setDraftMessage] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<BackendChatAttachment[]>([]);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastDraft, setBroadcastDraft] = useState('');
  const [broadcastAttachments, setBroadcastAttachments] = useState<BackendChatAttachment[]>([]);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const broadcastInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const {
    isRecording,
    isProcessing: isVoiceProcessing,
    isSupported: voiceRecordingSupported,
    recordingSeconds,
    startRecording,
    stopRecording,
  } = useVoiceNoteRecorder({
    onRecorded: async (attachment) => {
      setPendingAttachments((prev) => [...prev, attachment]);
    },
  });

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.technician_id === selectedConversationId) ?? null,
    [contacts, selectedConversationId],
  );

  const visibleMessages = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    if (!query) return messages;
    return messages.filter((message) => (
      (message.text || '').toLowerCase().includes(query)
      || message.attachments.some((attachment) => attachment.name.toLowerCase().includes(query))
    ));
  }, [historySearch, messages]);

  const totalUnreadCount = useMemo(
    () => contacts.reduce((sum, contact) => sum + contact.unread_count, 0),
    [contacts],
  );

  const syncUnreadBadge = (count: number) => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(CHAT_UNREAD_STORAGE_KEY, String(count));
    window.dispatchEvent(new CustomEvent('sm-chat-unread-count', { detail: { count } }));
  };

  const handleEnableNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('Browser notifications are not supported in this browser.');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setNotificationEnabled(true);
      toast.success('Browser notifications enabled.');
    } else {
      toast.info('Notification permission was not granted.');
    }
  };

  const fetchContacts = async (search = contactSearch, preserveSelection = true) => {
    const token = getStoredAdminToken();
    if (!token) {
      setContacts([]);
      setLoadingContacts(false);
      syncUnreadBadge(0);
      return;
    }

    const rows = await fetchAdminChatConversations(token, search.trim() || undefined);
    setContacts(rows);
    syncUnreadBadge(rows.reduce((sum, row) => sum + row.unread_count, 0));

    if (!preserveSelection || !selectedConversationId || !rows.some((row) => row.technician_id === selectedConversationId)) {
      setSelectedConversationId(rows[0]?.technician_id ?? '');
    }
  };

  const fetchThread = async (technicianId: string, silent = false) => {
    if (!technicianId) {
      setMessages([]);
      return;
    }

    const token = getStoredAdminToken();
    if (!token) {
      setMessages([]);
      return;
    }

    if (!silent) setLoadingMessages(true);

    const thread = await fetchAdminChatMessages(token, technicianId);
    setMessages(thread);
    await markAdminChatConversationRead(token, technicianId);

    const nextIds = new Set(thread.map((message) => message.id));
    const unseenIncoming = thread.filter((message) => (
      message.sender_role === 'technician' && !seenMessageIdsRef.current.has(message.id)
    ));

    if (unseenIncoming.length > 0) {
      const latest = unseenIncoming[unseenIncoming.length - 1];
      if (typeof document !== 'undefined' && document.hidden && notificationEnabled && 'Notification' in window) {
        new Notification(selectedContact?.technician_name ?? 'Technician', {
          body: latest.text || 'New attachment received',
        });
      } else if (seenMessageIdsRef.current.size > 0) {
        toast.message(`New message from ${selectedContact?.technician_name ?? 'technician'}`, {
          description: latest.text || latest.attachments[0]?.name || 'Attachment received',
        });
      }
    }

    seenMessageIdsRef.current = nextIds;
    setLoadingMessages(false);
  };

  useEffect(() => {
    void (async () => {
      setLoadingContacts(true);
      try {
        await fetchContacts('', false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load conversations.');
      } finally {
        setLoadingContacts(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedConversationId) return;
    void fetchThread(selectedConversationId);
  }, [selectedConversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages.length]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void fetchContacts(contactSearch, true);
      if (selectedConversationId) {
        void fetchThread(selectedConversationId, true);
      }
    }, 3000);
    const onFocus = () => {
      void fetchContacts(contactSearch, true);
      if (selectedConversationId) {
        void fetchThread(selectedConversationId, true);
      }
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
    };
  }, [contactSearch, notificationEnabled, selectedConversationId, selectedContact?.technician_name]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchContacts(contactSearch, true);
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [contactSearch]);

  useEffect(() => {
    syncUnreadBadge(totalUnreadCount);
  }, [totalUnreadCount]);

  const handleFileSelection = async (
    event: React.ChangeEvent<HTMLInputElement>,
    target: 'thread' | 'broadcast',
  ) => {
    const files = Array.from(event.target.files ?? []);
    const nextAttachments: BackendChatAttachment[] = [];

    for (const file of files) {
      const validationMessage = getChatAttachmentValidationMessage(file);
      if (validationMessage) {
        toast.error(validationMessage);
        continue;
      }
      nextAttachments.push(await fileToChatAttachment(file));
    }

    if (target === 'thread') {
      setPendingAttachments((prev) => [...prev, ...nextAttachments]);
    } else {
      setBroadcastAttachments((prev) => [...prev, ...nextAttachments]);
    }

    event.target.value = '';
  };

  const handleSendMessage = async () => {
    const token = getStoredAdminToken();
    const content = draftMessage.trim();
    if (!token || !selectedConversationId || (!content && pendingAttachments.length === 0)) return;

    try {
      const sent = await sendAdminChatMessage(token, selectedConversationId, {
        text: content || undefined,
        attachments: pendingAttachments,
      });
      setMessages((prev) => [...prev, sent]);
      seenMessageIdsRef.current.add(sent.id);
      setDraftMessage('');
      setPendingAttachments([]);
      await fetchContacts(contactSearch, true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send message.');
    }
  };

  const handleBroadcast = async () => {
    const token = getStoredAdminToken();
    const content = broadcastDraft.trim();
    if (!token || (!content && broadcastAttachments.length === 0)) return;

    try {
      await broadcastAdminChatMessage(token, {
        text: content || undefined,
        attachments: broadcastAttachments,
      });
      setBroadcastDraft('');
      setBroadcastAttachments([]);
      setBroadcastOpen(false);
      await fetchContacts(contactSearch, true);
      if (selectedConversationId) {
        await fetchThread(selectedConversationId, true);
      }
      toast.success('Broadcast sent to technicians.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send broadcast.');
    }
  };

  const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage();
    }
  };

  return (
    <div className="relative w-full pb-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[380px] rounded-[34px] bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),rgba(34,211,238,0)_34%),radial-gradient(circle_at_top_right,rgba(52,211,153,0.08),rgba(52,211,153,0)_30%)]" />
      <div className="relative space-y-6">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(7,25,42,0.98),rgba(6,18,32,0.98))] shadow-[0_34px_120px_rgba(0,0,0,0.34)]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:120px_120px] opacity-20" />
          <div className="relative flex flex-col gap-5 p-6 xl:flex-row xl:items-end xl:justify-between xl:p-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100">
                <MessageCircleMore className="h-3.5 w-3.5" />
                Platform Chat
              </div>
              <h1 className="mt-5 text-[2.35rem] font-semibold leading-none tracking-[-0.06em] text-white md:text-[2.8rem]">
                Messages
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-[15px]">
                Message technicians and send updates.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Badge variant="outline" className="border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-cyan-100">
                {contacts.length} technicians
              </Badge>
              <Badge variant="outline" className="border-amber-300/20 bg-amber-300/10 px-3 py-2 text-amber-100">
                {totalUnreadCount} unread
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEnableNotifications}
                className="h-10 gap-2 rounded-full border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
              >
                <Bell className="h-4 w-4" />
                {notificationEnabled ? 'Notifications On' : 'Enable Alerts'}
              </Button>
              <Button
                size="sm"
                className="h-10 gap-2 rounded-full bg-[#2F8E92] px-5 text-white shadow-[0_12px_30px_rgba(47,142,146,0.28)] hover:bg-[#267276]"
                onClick={() => setBroadcastOpen(true)}
              >
                <Megaphone className="h-4 w-4" />
                Broadcast
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.96),rgba(6,17,29,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="border-b border-white/8 p-5">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  value={contactSearch}
                  onChange={(event) => setContactSearch(event.target.value)}
                  placeholder="Search technicians"
                  className="h-12 rounded-full border-white/10 bg-white/[0.04] pl-11 text-white placeholder:text-slate-500"
                />
              </div>
            </div>
            <ScrollArea className="h-[920px]">
              <div className="space-y-1 p-3">
                {loadingContacts ? (
                  <div className="space-y-2 p-2">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div key={index} className="h-20 animate-pulse rounded-2xl bg-white/[0.05]" />
                    ))}
                  </div>
                ) : contacts.length === 0 ? (
                  <div className="px-5 py-12 text-center text-sm text-slate-400">
                    No technician conversations found yet.
                  </div>
                ) : contacts.map((contact) => (
                  <button
                    key={contact.technician_id}
                    type="button"
                    onClick={() => setSelectedConversationId(contact.technician_id)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition',
                      selectedConversationId === contact.technician_id
                        ? 'border-cyan-300/20 bg-cyan-300/10'
                        : 'border-transparent bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]',
                    )}
                  >
                    <div className="relative">
                      <Avatar className="h-11 w-11 border border-white/10">
                        <AvatarImage src={contact.technician_avatar || undefined} alt={contact.technician_name} />
                        <AvatarFallback className="bg-white/[0.06] text-slate-100">
                          {contact.technician_name.split(' ').map((chunk) => chunk[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-white">{contact.technician_name}</p>
                        <span className="shrink-0 text-xs text-slate-500">
                          {contact.last_message_at ? new Date(contact.last_message_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase() : '--'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="h-5 border-white/10 bg-white/[0.03] px-2 text-[10px] text-slate-300">
                          {contact.technician_status}
                        </Badge>
                        {contact.unread_count > 0 ? (
                          <Badge className="h-5 min-w-5 justify-center rounded-full bg-cyan-400 px-1.5 text-[10px] text-slate-950">
                            {contact.unread_count}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="truncate text-sm text-slate-400">
                        {contact.last_message_preview || 'No messages yet'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </Card>

          <Card className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.96),rgba(6,17,29,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="border-b border-white/8 p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12 border border-white/10">
                    <AvatarImage src={selectedContact?.technician_avatar || undefined} alt={selectedContact?.technician_name} />
                    <AvatarFallback className="bg-white/[0.06] text-slate-100">
                      {selectedContact?.technician_name.split(' ').map((chunk) => chunk[0]).join('').slice(0, 2) || 'TC'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold tracking-[-0.04em] text-white">{selectedContact?.technician_name || 'Select a technician'}</h2>
                      <span className="text-sm text-slate-400">{selectedContact?.technician_status || 'No active thread'}</span>
                    </div>
                    <p className="text-sm text-slate-400">
                      Full message history retained in-platform. Browser alerts can notify you when a technician replies.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[220px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      value={historySearch}
                      onChange={(event) => setHistorySearch(event.target.value)}
                      placeholder="Search message history"
                      className="h-10 rounded-full border-white/10 bg-white/[0.04] pl-9 text-white placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid min-h-[920px] grid-rows-[1fr_auto] bg-[linear-gradient(180deg,rgba(238,247,248,0.03),rgba(255,255,255,0.01))]">
              <ScrollArea className="h-full">
                <div className="space-y-4 px-5 py-6">
                  {loadingMessages ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={index}
                        className={cn(
                          'h-16 w-[65%] animate-pulse rounded-[24px] bg-white/[0.05]',
                          index % 2 === 0 ? 'ml-0' : 'ml-auto',
                        )}
                      />
                    ))
                  ) : visibleMessages.length === 0 ? (
                    <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-white/[0.05]">
                        <MessageCircleMore className="h-10 w-10 text-slate-500" />
                      </div>
                      <h3 className="text-xl font-semibold text-white">No conversation history yet</h3>
                      <p className="mt-2 max-w-md text-sm leading-7 text-slate-400">
                        Send the first real message to start this technician thread. Messages will persist and stay in sync across both sides.
                      </p>
                    </div>
                  ) : visibleMessages.map((message) => (
                    <div
                      key={message.id}
                      className={cn('flex', message.sender_role === 'admin' ? 'justify-end' : 'justify-start')}
                    >
                      <div className="max-w-[80%] space-y-2">
                        <div
                          className={cn(
                            'rounded-[24px] border px-4 py-3 shadow-[0_10px_25px_rgba(0,0,0,0.14)]',
                            message.sender_role === 'admin'
                              ? 'border-white/10 bg-white text-slate-900'
                              : message.is_broadcast
                                ? 'border-cyan-300/20 bg-cyan-300/12 text-cyan-50'
                                : 'border-white/10 bg-[#070f11] text-white',
                          )}
                        >
                          {message.text ? <p className="text-sm leading-6">{message.text}</p> : null}
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
                                <AttachmentCard key={attachment.id} attachment={attachment} />
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className={cn(
                          'flex items-center gap-2 px-1 text-xs text-slate-500',
                          message.sender_role === 'admin' ? 'justify-end' : 'justify-start',
                        )}>
                          <span>{new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()}</span>
                          {message.sender_role === 'admin' ? formatMessageStatus(message) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
              </ScrollArea>

              <div className="border-t border-white/8 bg-[rgba(6,17,29,0.9)] p-5">
                {pendingAttachments.length > 0 ? (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {pendingAttachments.map((attachment) => {
                      const AttachmentIcon = getAttachmentIcon(attachment.mime_type);
                      return (
                        <div key={attachment.id} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-200">
                          <AttachmentIcon className="h-3.5 w-3.5" />
                          <span>{attachment.name}</span>
                          <button
                            type="button"
                            onClick={() => setPendingAttachments((prev) => prev.filter((item) => item.id !== attachment.id))}
                            className="rounded-full p-0.5 text-slate-400 hover:bg-white/[0.08] hover:text-white"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {isRecording || isVoiceProcessing ? (
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs text-cyan-100">
                    {isRecording ? <Square className="h-3.5 w-3.5 fill-current" /> : <AudioLines className="h-3.5 w-3.5 animate-pulse" />}
                    <span>
                      {isRecording
                        ? `Recording voice note ${formatVoiceRecordingDuration(recordingSeconds)}`
                        : 'Saving voice note...'}
                    </span>
                  </div>
                ) : null}

                <div className="flex items-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-12 w-12 shrink-0 rounded-full border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
                    disabled={!selectedConversationId || isVoiceProcessing}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (isRecording) {
                        stopRecording();
                      } else {
                        void startRecording();
                      }
                    }}
                    className={cn(
                      'h-12 w-12 shrink-0 rounded-full border text-slate-100',
                      isRecording
                        ? 'border-red-400/40 bg-red-500/15 hover:bg-red-500/25'
                        : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.08]',
                    )}
                    disabled={!selectedConversationId || isVoiceProcessing || !voiceRecordingSupported}
                    aria-label={isRecording ? 'Stop recording voice note' : 'Record voice note'}
                    title={voiceRecordingSupported ? undefined : 'Voice recording is not supported in this browser'}
                  >
                    {isRecording ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={CHAT_ATTACHMENT_ACCEPT}
                    multiple
                    className="hidden"
                    onChange={(event) => void handleFileSelection(event, 'thread')}
                  />
                  <Textarea
                    value={draftMessage}
                    onChange={(event) => setDraftMessage(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    placeholder={selectedConversationId ? 'Write a message' : 'Select a technician to start chatting'}
                    className="min-h-[56px] resize-none rounded-[28px] border-white/10 bg-white/[0.04] px-5 py-4 text-white placeholder:text-slate-500"
                    disabled={!selectedConversationId || isVoiceProcessing}
                  />
                  <Button
                    type="button"
                    onClick={() => void handleSendMessage()}
                    className="h-12 w-12 shrink-0 rounded-full bg-[#070f11] text-white shadow-[0_12px_30px_rgba(0,0,0,0.3)] hover:bg-[#0b1418]"
                    disabled={!selectedConversationId || isVoiceProcessing}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </section>
      </div>

      <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
        <DialogContent className="border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.98),rgba(6,17,29,0.98))] text-slate-100 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-white">Broadcast Message</DialogTitle>
            <DialogDescription className="text-slate-300">
              Send one persisted announcement to every technician thread at once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Textarea
              value={broadcastDraft}
              onChange={(event) => setBroadcastDraft(event.target.value)}
              placeholder="Write your announcement"
              className="min-h-[160px] rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500"
            />
            {broadcastAttachments.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {broadcastAttachments.map((attachment) => {
                  const AttachmentIcon = getAttachmentIcon(attachment.mime_type);
                  return (
                    <div key={attachment.id} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-200">
                      <AttachmentIcon className="h-3.5 w-3.5" />
                      <span>{attachment.name}</span>
                      <button
                        type="button"
                        onClick={() => setBroadcastAttachments((prev) => prev.filter((item) => item.id !== attachment.id))}
                        className="rounded-full p-0.5 text-slate-400 hover:bg-white/[0.08] hover:text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] px-4 py-3 text-sm text-slate-400">
              <span>Attachments support images, audio, and PDFs up to 10MB each.</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 rounded-xl border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] px-4 text-slate-100 shadow-[0_14px_34px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.055)] hover:bg-[linear-gradient(180deg,rgba(24,38,64,0.98),rgba(12,20,34,0.98))] hover:text-white"
                onClick={() => broadcastInputRef.current?.click()}
              >
                <Paperclip className="mr-2 h-4 w-4" />
                Add File
              </Button>
              <input
                ref={broadcastInputRef}
                type="file"
                accept={CHAT_ATTACHMENT_ACCEPT}
                multiple
                className="hidden"
                onChange={(event) => void handleFileSelection(event, 'broadcast')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-11 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] px-5 text-slate-100 shadow-[0_14px_34px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.055)] hover:bg-[linear-gradient(180deg,rgba(24,38,64,0.98),rgba(12,20,34,0.98))] hover:text-white" onClick={() => setBroadcastOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleBroadcast()} className="h-11 rounded-2xl border border-[#7db0ff]/40 bg-[linear-gradient(135deg,#4f7cff,#22d3ee)] px-5 text-white shadow-[0_16px_34px_rgba(79,124,255,0.22)] hover:brightness-105">
              Send Broadcast
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
