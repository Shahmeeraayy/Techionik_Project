import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  BriefcaseBusiness,
  Check,
  CheckCheck,
  MessageSquareText,
  Mic,
  Paperclip,
  Pin,
  RefreshCw,
  Search,
  Send,
  Shield,
  Square,
  Users,
  X,
} from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import TechnicianBottomNav from '@/components/common/technician-bottom-nav';
import { AttachmentCard } from '@/components/chat/AttachmentCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useVoiceNoteRecorder } from '@/hooks/use-voice-note-recorder';
import {
  CHAT_ATTACHMENT_ACCEPT,
  fileToChatAttachment,
  formatVoiceRecordingDuration,
  getChatAttachmentValidationMessage,
} from '@/lib/chat-attachments';
import {
  fetchAdminChatConversations,
  fetchAdminChatThreadMessages,
  fetchAdminJobChatConversation,
  fetchAdminPinnedChatMessages,
  fetchTechnicianChatConversations,
  fetchTechnicianChatThreadMessages,
  fetchTechnicianJobChatConversation,
  fetchTechnicianPinnedChatMessages,
  getStoredAdminToken,
  getStoredTechnicianToken,
  markTechnicianChatThreadRead,
  sendTechnicianChatThreadMessage,
  type BackendChatAttachment,
  type BackendChatConversation,
  type BackendChatMessage,
} from '@/lib/backend-api';
import { cn } from '@/lib/utils';

function formatMessageStatus(message: BackendChatMessage) {
  if (message.read_at) {
    return <CheckCheck className="h-3.5 w-3.5 text-cyan-300" />;
  }
  if (message.delivered_at) {
    return <CheckCheck className="h-3.5 w-3.5 text-slate-400" />;
  }
  return <Check className="h-3.5 w-3.5 text-slate-500" />;
}

function getConversationSummaryLine(conversation: BackendChatConversation | null) {
  if (!conversation) {
    return 'Choose an authorized conversation to continue.';
  }
  if (conversation.channel_kind === 'group') {
    return `${conversation.member_count} technicians in this group`;
  }
  return `${conversation.technician_name} - ${conversation.technician_status}`;
}

export default function TechnicianChatPage() {
  const { techId: previewTechId } = useParams();
  const [searchParams] = useSearchParams();
  const requestedJobId = searchParams.get('jobId');
  const isPreviewMode = Boolean(previewTechId);
  const routeBase = isPreviewMode ? `/admin/tech-preview/${previewTechId}` : '/tech';
  const token = isPreviewMode ? (getStoredAdminToken() || '') : (getStoredTechnicianToken() || '');
  const [conversations, setConversations] = useState<BackendChatConversation[]>([]);
  const [messages, setMessages] = useState<BackendChatMessage[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<BackendChatMessage[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [draftMessage, setDraftMessage] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<BackendChatAttachment[]>([]);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );

  const groupedConversations = useMemo(() => ({
    direct: conversations.filter((conversation) => conversation.channel_kind === 'direct'),
    group: conversations.filter((conversation) => conversation.channel_kind === 'group'),
    job: conversations.filter((conversation) => conversation.channel_kind === 'job'),
  }), [conversations]);

  const conversationSections = useMemo(() => ([
    { key: 'direct', label: 'Direct Chats', items: groupedConversations.direct },
    { key: 'group', label: 'Technician Groups', items: groupedConversations.group },
    { key: 'job', label: 'Job Chats', items: groupedConversations.job },
  ]), [groupedConversations]);

  const loadConversations = async (search = contactSearch, preserveSelection = true) => {
    if (!token) {
      setConversations([]);
      return;
    }

    const next = isPreviewMode
      ? (await fetchAdminChatConversations(token, search.trim() || undefined)).filter((row) => row.technician_id === previewTechId)
      : await fetchTechnicianChatConversations(token, search.trim() || undefined);
    setConversations(next);

    if (requestedJobId && preserveSelection) {
      const matchedJobConversation = next.find((row) => row.job_id === requestedJobId);
      if (matchedJobConversation) {
        setSelectedConversationId(matchedJobConversation.id);
        return;
      }
    }

    if (!preserveSelection || !selectedConversationId || !next.some((row) => row.id === selectedConversationId)) {
      setSelectedConversationId(next[0]?.id ?? '');
    }
  };

  const loadThread = async (conversationId: string, search = historySearch, silent = false) => {
    if (!conversationId || !token) {
      setMessages([]);
      setPinnedMessages([]);
      return;
    }
    if (!silent) setLoadingMessages(true);
    try {
      const [thread, pinned] = isPreviewMode
        ? await Promise.all([
          fetchAdminChatThreadMessages(token, conversationId, search.trim() || undefined),
          fetchAdminPinnedChatMessages(token, conversationId),
        ])
        : await Promise.all([
          fetchTechnicianChatThreadMessages(token, conversationId, search.trim() || undefined),
          fetchTechnicianPinnedChatMessages(token, conversationId),
        ]);

      setMessages(thread);
      setPinnedMessages(pinned.items);
      if (!isPreviewMode) {
        await markTechnicianChatThreadRead(token, conversationId);
      }

      const nextIds = new Set(thread.map((message) => message.id));
      const incomingRole = isPreviewMode ? 'technician' : 'admin';
      const unseenIncoming = thread.filter((message) => (
        message.sender_role === incomingRole && !seenMessageIdsRef.current.has(message.id)
      ));
      if (unseenIncoming.length > 0) {
        const latest = unseenIncoming[unseenIncoming.length - 1];
        if (typeof document !== 'undefined' && document.hidden && notificationEnabled && 'Notification' in window) {
          new Notification(isPreviewMode ? 'Technician reply' : 'Admin Dispatch', {
            body: latest.text || latest.attachments[0]?.name || 'New secure attachment received',
          });
        } else if (seenMessageIdsRef.current.size > 0) {
          toast.message(isPreviewMode ? 'Technician reply received' : 'New admin message', {
            description: latest.text || latest.attachments[0]?.name || 'New secure attachment received',
          });
        }
      }
      seenMessageIdsRef.current = nextIds;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load thread.');
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  };

  useEffect(() => {
    void (async () => {
      setLoadingConversations(true);
      try {
        if (requestedJobId && token) {
          const resolved = isPreviewMode
            ? await fetchAdminJobChatConversation(token, requestedJobId)
            : await fetchTechnicianJobChatConversation(token, requestedJobId);
          if (!previewTechId || resolved.conversation.technician_id === previewTechId) {
            setSelectedConversationId(resolved.conversation.id);
          }
        }
        await loadConversations('', false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load Chatter.');
      } finally {
        setLoadingConversations(false);
      }
    })();
  }, [isPreviewMode, previewTechId, requestedJobId, token]);

  useEffect(() => {
    if (!selectedConversationId) return;
    const timeoutId = window.setTimeout(() => {
      void loadThread(selectedConversationId, historySearch);
    }, historySearch.trim() ? 250 : 0);
    return () => window.clearTimeout(timeoutId);
  }, [historySearch, selectedConversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadConversations(contactSearch, true);
      if (selectedConversationId) {
        void loadThread(selectedConversationId, historySearch, true);
      }
    }, 5000);
    const onFocus = () => {
      void loadConversations(contactSearch, true);
      if (selectedConversationId) {
        void loadThread(selectedConversationId, historySearch, true);
      }
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
    };
  }, [contactSearch, historySearch, notificationEnabled, selectedConversationId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadConversations(contactSearch, true);
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [contactSearch]);

  const handleEnableNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('Browser notifications are not supported in this browser.');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setNotificationEnabled(true);
      toast.success('Browser notifications enabled.');
    }
  };

  const handleFileSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
    setPendingAttachments((prev) => [...prev, ...nextAttachments]);
    event.target.value = '';
  };

  const handleSend = async () => {
    const content = draftMessage.trim();
    if (isPreviewMode || !token || !selectedConversationId || (!content && pendingAttachments.length === 0)) return;

    try {
      const sent = await sendTechnicianChatThreadMessage(token, selectedConversationId, {
        text: content || undefined,
        attachments: pendingAttachments,
      });
      setMessages((prev) => [...prev, sent]);
      seenMessageIdsRef.current.add(sent.id);
      setDraftMessage('');
      setPendingAttachments([]);
      await loadConversations(contactSearch, true);
      await loadThread(selectedConversationId, historySearch, true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send message.');
    }
  };

  const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="tech-shell pb-24 text-white">
      <div className="relative w-full pb-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),rgba(34,211,238,0)_32%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.1),rgba(16,185,129,0)_28%)]" />
        <div className="relative mx-auto w-full max-w-[1500px] space-y-6 px-4 pt-4 sm:px-6 lg:px-8">
          <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(7,25,42,0.98),rgba(6,18,32,0.98))] shadow-[0_34px_120px_rgba(0,0,0,0.34)]">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:120px_120px] opacity-20" />
            <div className="relative flex flex-col gap-5 p-5 lg:flex-row lg:items-end lg:justify-between lg:p-7">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-white">
                  <MessageSquareText className="h-3.5 w-3.5" />
                  Chatter
                </div>
                <h1 className="mt-5 text-[clamp(2rem,3.4vw,3.15rem)] font-semibold leading-[0.94] tracking-[-0.07em] text-white">
                  Dispatch Chat
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-[15px]">
                  Secure admin communication for direct dispatch and assigned job threads.
                </p>
                {isPreviewMode ? (
                  <p className="mt-3 text-xs font-medium text-white/80">Preview mode is read-only for technician Chatter.</p>
                ) : null}
              </div>
              <div className="flex items-center gap-3 self-start lg:self-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEnableNotifications}
                  className="h-11 gap-2 rounded-2xl border border-white/12 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(8,12,20,0.98))] px-4 text-slate-100 shadow-[0_14px_34px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.055)] hover:bg-[linear-gradient(180deg,rgba(24,38,64,0.98),rgba(12,20,34,0.98))] hover:text-white"
                >
                  <Bell className="h-4 w-4" />
                  {notificationEnabled ? 'Notifications On' : 'Enable Alerts'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void loadConversations(contactSearch, true);
                    if (selectedConversationId) {
                      void loadThread(selectedConversationId, historySearch);
                    }
                  }}
                  className="h-11 gap-2 rounded-2xl border border-white/12 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(8,12,20,0.98))] px-4 text-slate-100 shadow-[0_14px_34px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.055)] hover:bg-[linear-gradient(180deg,rgba(24,38,64,0.98),rgba(12,20,34,0.98))] hover:text-white"
                >
                  <RefreshCw className={cn('h-4 w-4', (loadingConversations || loadingMessages) && 'animate-spin')} />
                  Refresh
                </Button>
              </div>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <Card className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.96),rgba(6,17,29,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
              <div className="border-b border-white/8 p-5">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    value={contactSearch}
                    onChange={(event) => setContactSearch(event.target.value)}
                    placeholder="Search chats, groups or jobs"
                    className="h-12 rounded-full border-white/10 bg-white/[0.04] pl-11 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>
              <ScrollArea className="h-[760px]">
                <div className="space-y-4 p-3">
                  {loadingConversations ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="h-20 animate-pulse rounded-2xl bg-white/[0.05]" />
                    ))
                  ) : conversations.length === 0 ? (
                    <div className="px-5 py-12 text-center text-sm text-slate-400">
                      No authorized Chatter threads were found.
                    </div>
                  ) : conversationSections.map((section) => (
                    section.items.length > 0 ? (
                      <section key={section.key} className="space-y-2">
                        <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                          {section.label}
                        </div>
                        <div className="space-y-2">
                          {section.items.map((conversation) => (
                            <button
                              key={conversation.id}
                              type="button"
                              onClick={() => setSelectedConversationId(conversation.id)}
                              className={cn(
                                'flex w-full flex-col items-start gap-2 rounded-2xl border px-4 py-3 text-left transition',
                                selectedConversationId === conversation.id
                                  ? 'border-cyan-300/20 bg-cyan-300/10'
                                  : 'border-transparent bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]',
                              )}
                            >
                              <div className="flex w-full items-center justify-between gap-2">
                                <p className="truncate text-sm font-semibold text-white">{conversation.title}</p>
                                {conversation.unread_count > 0 ? (
                                  <Badge className="rounded-full bg-cyan-400 px-1.5 text-[10px] text-slate-950">
                                    {conversation.unread_count}
                                  </Badge>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className={cn(
                                  'h-5 px-2 text-[10px]',
                                  conversation.channel_kind === 'job'
                                    ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                                    : conversation.channel_kind === 'group'
                                      ? 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100'
                                      : 'border-slate-300/20 bg-slate-300/10 text-slate-200',
                                )}>
                                  {conversation.channel_kind === 'job'
                                    ? conversation.job_code || 'Job chat'
                                    : conversation.channel_kind === 'group'
                                      ? `${conversation.member_count} techs`
                                      : 'Dispatch'}
                                </Badge>
                                {conversation.pinned_count > 0 ? (
                                  <Badge variant="outline" className="h-5 border-cyan-300/20 bg-cyan-300/10 px-2 text-[10px] text-cyan-100">
                                    <Pin className="mr-1 h-3 w-3" />
                                    {conversation.pinned_count}
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="truncate text-xs text-slate-400">
                                {conversation.last_message_preview
                                  || (conversation.channel_kind === 'group' ? conversation.member_names.join(', ') : 'No messages yet')}
                              </p>
                            </button>
                          ))}
                        </div>
                      </section>
                    ) : null
                  ))}
                </div>
              </ScrollArea>
            </Card>

            <Card className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.96),rgba(6,17,29,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
              <div className="border-b border-white/8 p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold tracking-[-0.04em] text-white">
                        {selectedConversation?.title || 'Select a thread'}
                      </h2>
                      {selectedConversation?.channel_kind === 'job' ? (
                        <Badge className="rounded-full bg-emerald-400/15 text-emerald-100">
                          <BriefcaseBusiness className="mr-1 h-3.5 w-3.5" />
                          Job-linked
                        </Badge>
                      ) : selectedConversation?.channel_kind === 'group' ? (
                        <Badge className="rounded-full bg-cyan-400/15 text-cyan-100">
                          <Users className="mr-1 h-3.5 w-3.5" />
                          Technician Group
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-slate-400">
                      {getConversationSummaryLine(selectedConversation)}
                    </p>
                  </div>
                  <div className="grid min-w-[220px] gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <Input
                        value={historySearch}
                        onChange={(event) => setHistorySearch(event.target.value)}
                        placeholder="Search this thread"
                        className="h-10 rounded-full border-white/10 bg-white/[0.04] pl-9 text-white placeholder:text-slate-500"
                      />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
                      <div className="mb-1 flex items-center gap-2 font-semibold uppercase tracking-[0.18em] text-slate-300">
                        <Shield className="h-3.5 w-3.5" />
                        Access
                      </div>
                      {isPreviewMode ? 'Admin preview only. Sending is disabled.' : 'Only your tenant and assigned-job threads are visible here.'}
                    </div>
                  </div>
                </div>
              </div>

              {pinnedMessages.length > 0 ? (
                <div className="border-b border-white/8 px-5 py-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                    <Pin className="h-4 w-4 text-cyan-300" />
                    Pinned Messages
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {pinnedMessages.map((message) => (
                      <div key={`pin-${message.id}`} className="min-w-[240px] rounded-2xl border border-cyan-300/15 bg-cyan-300/10 p-3 text-sm text-cyan-50">
                        <p className="line-clamp-3 leading-6">{message.text || message.attachments[0]?.name || 'Pinned secure attachment'}</p>
                        <p className="mt-2 text-[11px] text-cyan-200/80">
                          {new Date(message.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid min-h-[760px] grid-rows-[1fr_auto] bg-[linear-gradient(180deg,rgba(238,247,248,0.03),rgba(255,255,255,0.01))]">
                <ScrollArea className="h-full">
                  <div className="space-y-4 px-5 py-6">
                    {loadingMessages ? (
                      Array.from({ length: 4 }).map((_, index) => (
                        <div
                          key={index}
                          className={cn(
                            'h-16 w-[72%] animate-pulse rounded-[24px] bg-white/[0.05]',
                            index % 2 === 0 ? 'ml-0' : 'ml-auto',
                          )}
                        />
                      ))
                    ) : messages.length === 0 ? (
                      <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-white/[0.05]">
                          <MessageSquareText className="h-10 w-10 text-slate-500" />
                        </div>
                        <h3 className="text-xl font-semibold text-white">No messages yet</h3>
                        <p className="mt-2 max-w-md text-sm leading-7 text-slate-400">
                          Start a secure conversation with the admin team here. Job-linked chats stay attached to the assigned job.
                        </p>
                      </div>
                    ) : messages.map((message) => (
                      <div
                        key={message.id}
                        className={cn('flex', message.sender_role === 'technician' ? 'justify-end' : 'justify-start')}
                      >
                        <div className="max-w-[82%] space-y-2">
                          <div
                            className={cn(
                              'rounded-[24px] border px-4 py-3 shadow-[0_10px_25px_rgba(0,0,0,0.14)]',
                              message.sender_role === 'technician'
                                ? 'border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] text-white'
                                : 'border-white/10 bg-[#070f11] text-white',
                            )}
                          >
                            <div className="mb-2 flex items-center gap-2">
                              {message.is_pinned ? <Pin className="h-3.5 w-3.5 text-cyan-300" /> : null}
                              {message.conversation_type === 'job' && selectedConversation?.job_code ? (
                                <Badge variant="outline" className="border-emerald-300/20 bg-emerald-300/10 text-[10px] text-emerald-100">
                                  {selectedConversation.job_code}
                                </Badge>
                              ) : null}
                            </div>
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
                                  <AttachmentCard key={attachment.id} attachment={attachment} token={token} tone="dark" />
                                ))}
                              </div>
                            ) : null}
                          </div>
                          <div className={cn(
                            'flex items-center gap-2 px-1 text-xs text-slate-500',
                            message.sender_role === 'technician' ? 'justify-end' : 'justify-start',
                          )}>
                            <span>{new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()}</span>
                            {message.sender_role === 'technician' ? formatMessageStatus(message) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={bottomRef} />
                  </div>
                </ScrollArea>

                <div className="border-t border-slate-200 bg-white p-5 dark:border-white/8 dark:bg-[rgba(6,17,29,0.9)]">
                  {pendingAttachments.length > 0 ? (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {pendingAttachments.map((attachment) => (
                        <div key={attachment.id} className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200">
                          <span>{attachment.name}</span>
                          <button
                            type="button"
                            onClick={() => setPendingAttachments((prev) => prev.filter((item) => item.id !== attachment.id))}
                            className="rounded-full p-0.5 text-slate-600 hover:bg-slate-200 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/[0.08] dark:hover:text-white"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {isRecording || isVoiceProcessing ? (
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs text-cyan-100">
                      {isRecording ? <Square className="h-3.5 w-3.5 fill-current" /> : <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                      <span>
                        {isRecording
                          ? `Recording voice note ${formatVoiceRecordingDuration(recordingSeconds)}`
                          : 'Securing voice note...'}
                      </span>
                    </div>
                  ) : null}

                  <div className="flex items-end gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      className="tech-chat-attach-button h-12 w-12 shrink-0 rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-100 hover:text-slate-950 disabled:bg-slate-100 disabled:text-slate-400 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(8,12,20,0.98))] dark:text-slate-100 dark:shadow-[0_12px_30px_rgba(0,0,0,0.24)] dark:hover:bg-[linear-gradient(180deg,rgba(24,38,64,0.98),rgba(12,20,34,0.98))] dark:hover:text-white"
                      disabled={isPreviewMode || !selectedConversationId || isVoiceProcessing}
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (isRecording) {
                          stopRecording();
                        } else {
                          void startRecording();
                        }
                      }}
                      className={cn(
                        'h-12 w-12 shrink-0 rounded-full border shadow-sm',
                        isRecording
                          ? 'border-red-400/50 bg-red-500/15 text-red-100 hover:bg-red-500/25'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(8,12,20,0.98))] dark:text-slate-100 dark:hover:bg-[linear-gradient(180deg,rgba(24,38,64,0.98),rgba(12,20,34,0.98))] dark:hover:text-white',
                      )}
                      disabled={isPreviewMode || !selectedConversationId || isVoiceProcessing || !voiceRecordingSupported}
                      aria-label={isRecording ? 'Stop recording voice note' : 'Record voice note'}
                    >
                      {isRecording ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={CHAT_ATTACHMENT_ACCEPT}
                      multiple
                      className="hidden"
                      onChange={(event) => void handleFileSelection(event)}
                    />
                    <Textarea
                      value={draftMessage}
                      onChange={(event) => setDraftMessage(event.target.value)}
                      onKeyDown={handleComposerKeyDown}
                      placeholder={isPreviewMode ? 'Preview mode is read-only' : 'Write a secure message'}
                      className="min-h-[56px] resize-none rounded-[28px] border border-slate-300 bg-white px-5 py-4 text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-slate-500"
                      disabled={isPreviewMode || !selectedConversationId || isVoiceProcessing}
                    />
                    <Button
                      type="button"
                      onClick={() => void handleSend()}
                      className="tech-chat-send-button h-12 w-12 shrink-0 rounded-full border border-blue-700 bg-blue-600 text-white shadow-[0_16px_34px_rgba(37,99,235,0.22)] hover:bg-blue-700 disabled:border-blue-200 disabled:bg-blue-100 disabled:text-blue-500 dark:border-transparent dark:bg-[linear-gradient(135deg,#4f7cff,#7aa2ff)] dark:shadow-[0_18px_40px_rgba(79,124,255,0.24)] dark:hover:bg-[linear-gradient(135deg,#5d88ff,#89adff)]"
                      disabled={isPreviewMode || !selectedConversationId || isVoiceProcessing}
                      aria-label="Send message"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <TechnicianBottomNav activeTab="chat" routeBase={routeBase} />
    </div>
  );
}
