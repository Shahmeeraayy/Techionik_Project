import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  BriefcaseBusiness,
  Check,
  CheckCheck,
  MessageCircleMore,
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
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { AttachmentCard } from '@/components/chat/AttachmentCard';
import { useVoiceNoteRecorder } from '@/hooks/use-voice-note-recorder';
import {
  CHAT_ATTACHMENT_ACCEPT,
  fileToChatAttachment,
  formatVoiceRecordingDuration,
  getChatAttachmentValidationMessage,
} from '@/lib/chat-attachments';
import {
  createAdminChatGroup,
  fetchAdminChatAuditLogs,
  fetchAdminChatConversations,
  fetchAdminChatThreadMessages,
  fetchAdminJobChatConversation,
  fetchAdminPinnedChatMessages,
  fetchAdminTechnicians,
  getStoredAdminToken,
  markAdminChatThreadRead,
  pinAdminChatMessage,
  sendAdminChatThreadMessage,
  type BackendAdminChatConversation,
  type BackendChatAttachment,
  type BackendChatAuditLog,
  type BackendChatMessage,
  type BackendTechnicianListItem,
  unpinAdminChatMessage,
} from '@/lib/backend-api';
import { cn } from '@/lib/utils';

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

function getConversationDisplayName(conversation: BackendAdminChatConversation | null) {
  if (!conversation) return 'technician';
  if (conversation.channel_kind === 'group') return conversation.title;
  return conversation.technician_name;
}

function getConversationInitials(conversation: BackendAdminChatConversation | null) {
  const source = conversation?.channel_kind === 'group'
    ? conversation.title
    : (conversation?.technician_name || 'TC');
  return source
    .split(' ')
    .map((chunk) => chunk[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function getConversationSummaryLine(conversation: BackendAdminChatConversation | null) {
  if (!conversation) {
    return 'Open a technician thread to chat securely.';
  }
  if (conversation.channel_kind === 'group') {
    return `${conversation.member_count} technicians in this operational group`;
  }
  return `${conversation.technician_name} - ${conversation.technician_status}`;
}

export default function PlatformChatPage() {
  const [searchParams] = useSearchParams();
  const requestedJobId = searchParams.get('jobId');
  const [conversations, setConversations] = useState<BackendAdminChatConversation[]>([]);
  const [messages, setMessages] = useState<BackendChatMessage[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<BackendChatMessage[]>([]);
  const [auditRows, setAuditRows] = useState<BackendChatAuditLog[]>([]);
  const [technicians, setTechnicians] = useState<BackendTechnicianListItem[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [draftMessage, setDraftMessage] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<BackendChatAttachment[]>([]);
  const [showGroupComposer, setShowGroupComposer] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [savingGroup, setSavingGroup] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const token = getStoredAdminToken() || '';
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

  const totalUnreadCount = useMemo(
    () => conversations.reduce((sum, conversation) => sum + conversation.unread_count, 0),
    [conversations],
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

  const syncUnreadBadge = (count: number) => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(CHAT_UNREAD_STORAGE_KEY, String(count));
    window.dispatchEvent(new CustomEvent('sm-chat-unread-count', { detail: { count } }));
  };

  const loadConversations = async (search = contactSearch, preserveSelection = true) => {
    if (!token) {
      setConversations([]);
      syncUnreadBadge(0);
      return;
    }
    const next = await fetchAdminChatConversations(token, search.trim() || undefined);
    setConversations(next);
    syncUnreadBadge(next.reduce((sum, row) => sum + row.unread_count, 0));

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
      setAuditRows([]);
      return;
    }
    if (!silent) setLoadingMessages(true);
    try {
      const [thread, pinned, audit] = await Promise.all([
        fetchAdminChatThreadMessages(token, conversationId, search.trim() || undefined),
        fetchAdminPinnedChatMessages(token, conversationId),
        fetchAdminChatAuditLogs(token, conversationId),
      ]);
      setMessages(thread);
      setPinnedMessages(pinned.items);
      setAuditRows(audit.slice(0, 5));
      await markAdminChatThreadRead(token, conversationId);

      const nextIds = new Set(thread.map((message) => message.id));
      const unseenIncoming = thread.filter((message) => (
        message.sender_role === 'technician' && !seenMessageIdsRef.current.has(message.id)
      ));
      if (unseenIncoming.length > 0) {
        const latest = unseenIncoming[unseenIncoming.length - 1];
        if (typeof document !== 'undefined' && document.hidden && notificationEnabled && 'Notification' in window) {
          new Notification(getConversationDisplayName(selectedConversation), {
            body: latest.text || latest.attachments[0]?.name || 'New secure attachment received',
          });
        } else if (seenMessageIdsRef.current.size > 0) {
          toast.message(`New message from ${getConversationDisplayName(selectedConversation)}`, {
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
        if (token) {
          const technicianRows = await fetchAdminTechnicians(token);
          setTechnicians(technicianRows.filter((row) => row.status === 'active'));
        }
        if (requestedJobId && token) {
          const resolved = await fetchAdminJobChatConversation(token, requestedJobId);
          setSelectedConversationId(resolved.conversation.id);
        }
        await loadConversations('', false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load chat conversations.');
      } finally {
        setLoadingConversations(false);
      }
    })();
  }, [requestedJobId, token]);

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

  useEffect(() => {
    syncUnreadBadge(totalUnreadCount);
  }, [totalUnreadCount]);

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

  const toggleGroupMember = (technicianId: string) => {
    setGroupMemberIds((prev) => (
      prev.includes(technicianId)
        ? prev.filter((item) => item !== technicianId)
        : [...prev, technicianId]
    ));
  };

  const resetGroupComposer = () => {
    setShowGroupComposer(false);
    setGroupTitle('');
    setGroupMemberIds([]);
  };

  const handleCreateGroup = async () => {
    if (!token) return;
    if (groupTitle.trim().length < 2) {
      toast.error('Group name must be at least 2 characters.');
      return;
    }
    if (groupMemberIds.length < 2) {
      toast.error('Select at least 2 technicians for a technician group.');
      return;
    }
    try {
      setSavingGroup(true);
      const resolved = await createAdminChatGroup(token, {
        title: groupTitle.trim(),
        technician_ids: groupMemberIds,
      });
      await loadConversations(contactSearch, false);
      setSelectedConversationId(resolved.conversation.id);
      resetGroupComposer();
      toast.success('Technician group created.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create technician group.');
    } finally {
      setSavingGroup(false);
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
    if (!token || !selectedConversationId || (!content && pendingAttachments.length === 0)) return;

    try {
      const sent = await sendAdminChatThreadMessage(token, selectedConversationId, {
        text: content || undefined,
        attachments: pendingAttachments,
      });
      setMessages((prev) => [...prev, sent]);
      setDraftMessage('');
      setPendingAttachments([]);
      seenMessageIdsRef.current.add(sent.id);
      await loadConversations(contactSearch, true);
      await loadThread(selectedConversationId, historySearch, true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send message.');
    }
  };

  const handleTogglePin = async (message: BackendChatMessage) => {
    if (!token) return;
    try {
      if (message.is_pinned) {
        await unpinAdminChatMessage(token, message.id);
      } else {
        await pinAdminChatMessage(token, message.id);
      }
      await loadThread(selectedConversationId, historySearch, true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update pin status.');
    }
  };

  const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
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
                Chatter
              </div>
              <h1 className="mt-5 text-[2.35rem] font-semibold leading-none tracking-[-0.06em] text-white md:text-[2.8rem]">
                Admin to Technician Threads
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-[15px]">
                Tenant-isolated conversations with secure files, voice notes, read status, and job-linked threads.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Badge variant="outline" className="border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-cyan-100">
                {conversations.length} threads
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
                variant="outline"
                size="sm"
                onClick={() => {
                  void loadConversations(contactSearch, true);
                  if (selectedConversationId) {
                    void loadThread(selectedConversationId, historySearch);
                  }
                }}
                className="h-10 gap-2 rounded-full border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
              >
                <RefreshCw className={cn('h-4 w-4', (loadingConversations || loadingMessages) && 'animate-spin')} />
                Refresh
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.96),rgba(6,17,29,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="border-b border-white/8 p-5">
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    value={contactSearch}
                    onChange={(event) => setContactSearch(event.target.value)}
                    placeholder="Search technicians, groups or job codes"
                    className="h-12 rounded-full border-white/10 bg-white/[0.04] pl-11 text-white placeholder:text-slate-500"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowGroupComposer((prev) => !prev)}
                  className="h-10 w-full rounded-full border-cyan-300/20 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/15 hover:text-cyan-50"
                >
                  <Users className="mr-2 h-4 w-4" />
                  {showGroupComposer ? 'Close Group Builder' : 'Create Technician Group'}
                </Button>
                {showGroupComposer ? (
                  <div className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                    <Input
                      value={groupTitle}
                      onChange={(event) => setGroupTitle(event.target.value)}
                      placeholder="Group name"
                      className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500"
                    />
                    <ScrollArea className="h-40 rounded-2xl border border-white/10 bg-[#08131d]">
                      <div className="space-y-2 p-2">
                        {technicians.map((technician) => {
                          const checked = groupMemberIds.includes(technician.id);
                          return (
                            <button
                              key={technician.id}
                              type="button"
                              onClick={() => toggleGroupMember(technician.id)}
                              className={cn(
                                'flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-left transition',
                                checked
                                  ? 'border-cyan-300/25 bg-cyan-300/10'
                                  : 'border-white/8 bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.05]',
                              )}
                            >
                              <div>
                                <p className="text-sm font-medium text-white">{technician.full_name || technician.name}</p>
                                <p className="text-xs text-slate-400">{technician.email}</p>
                              </div>
                              <Badge className={cn(
                                'rounded-full px-2 text-[10px]',
                                checked ? 'bg-cyan-300 text-slate-950' : 'bg-white/10 text-slate-300',
                              )}>
                                {checked ? 'Added' : 'Add'}
                              </Badge>
                            </button>
                          );
                        })}
                      </div>
                    </ScrollArea>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={() => void handleCreateGroup()}
                        disabled={savingGroup}
                        className="flex-1 rounded-full bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                      >
                        {savingGroup ? 'Creating...' : `Create Group (${groupMemberIds.length})`}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={resetGroupComposer}
                        className="rounded-full text-slate-300 hover:text-white"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <ScrollArea className="h-[920px]">
              <div className="space-y-4 p-3">
                {loadingConversations ? (
                  <div className="space-y-2 p-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="h-20 animate-pulse rounded-2xl bg-white/[0.05]" />
                    ))}
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="px-5 py-12 text-center text-sm text-slate-400">
                    No Chatter threads matched your filters.
                  </div>
                ) : conversationSections.map((section) => (
                  section.items.length > 0 ? (
                    <section key={section.key} className="space-y-2">
                      <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                        {section.label}
                      </div>
                      <div className="space-y-1">
                        {section.items.map((conversation) => (
                          <button
                            key={conversation.id}
                            type="button"
                            onClick={() => setSelectedConversationId(conversation.id)}
                            className={cn(
                              'flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition',
                              selectedConversationId === conversation.id
                                ? 'border-cyan-300/20 bg-cyan-300/10'
                                : 'border-transparent bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]',
                            )}
                          >
                            <Avatar className="h-11 w-11 border border-white/10">
                              <AvatarImage
                                src={conversation.channel_kind === 'group' ? undefined : (conversation.technician_avatar || undefined)}
                                alt={conversation.channel_kind === 'group' ? conversation.title : conversation.technician_name}
                              />
                              <AvatarFallback className="bg-white/[0.06] text-slate-100">
                                {getConversationInitials(conversation)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="truncate text-sm font-semibold text-white">
                                  {conversation.channel_kind === 'group' ? conversation.title : conversation.technician_name}
                                </p>
                                <span className="shrink-0 text-xs text-slate-500">
                                  {conversation.last_message_at
                                    ? new Date(conversation.last_message_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()
                                    : '--'}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {conversation.channel_kind === 'group' ? (
                                  <Badge variant="outline" className="h-5 border-cyan-300/20 bg-cyan-300/10 px-2 text-[10px] text-cyan-100">
                                    <Users className="mr-1 h-3 w-3" />
                                    {conversation.member_count} techs
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="h-5 border-white/10 bg-white/[0.03] px-2 text-[10px] text-slate-300">
                                    {conversation.technician_status}
                                  </Badge>
                                )}
                                <Badge variant="outline" className={cn(
                                  'h-5 px-2 text-[10px]',
                                  conversation.channel_kind === 'job'
                                    ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                                    : conversation.channel_kind === 'group'
                                      ? 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100'
                                      : 'border-slate-300/20 bg-slate-300/10 text-slate-200',
                                )}>
                                  {conversation.channel_kind === 'job'
                                    ? conversation.job_code || 'Job thread'
                                    : conversation.channel_kind === 'group'
                                      ? 'Technician Group'
                                      : 'Dispatch'}
                                </Badge>
                                {conversation.unread_count > 0 ? (
                                  <Badge className="h-5 min-w-5 justify-center rounded-full bg-cyan-400 px-1.5 text-[10px] text-slate-950">
                                    {conversation.unread_count}
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="truncate text-sm text-slate-400">
                                {conversation.last_message_preview
                                  || (conversation.channel_kind === 'group'
                                    ? conversation.member_names.join(', ')
                                    : conversation.title)}
                              </p>
                            </div>
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
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12 border border-white/10">
                    <AvatarImage
                      src={selectedConversation?.channel_kind === 'group' ? undefined : (selectedConversation?.technician_avatar || undefined)}
                      alt={selectedConversation?.channel_kind === 'group' ? selectedConversation?.title : selectedConversation?.technician_name}
                    />
                    <AvatarFallback className="bg-white/[0.06] text-slate-100">
                      {getConversationInitials(selectedConversation)}
                    </AvatarFallback>
                  </Avatar>
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
                </div>
                <div className="grid min-w-[260px] gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      value={historySearch}
                      onChange={(event) => setHistorySearch(event.target.value)}
                      placeholder="Search this thread"
                      className="h-10 rounded-full border-white/10 bg-white/[0.04] pl-9 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400">
                    <div className="mb-2 flex items-center gap-2 font-semibold uppercase tracking-[0.18em] text-slate-300">
                      <Shield className="h-3.5 w-3.5" />
                      Recent Audit
                    </div>
                    {auditRows.length === 0 ? (
                      <p>No chat audit events yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {auditRows.map((row) => (
                          <div key={row.id} className="rounded-xl border border-white/8 bg-black/10 px-3 py-2">
                            <p className="text-[11px] font-semibold text-white">{row.action}</p>
                            <p className="mt-1 text-[11px] text-slate-400">
                              {new Date(row.created_at).toLocaleString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
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
                    <div key={`pin-${message.id}`} className="min-w-[260px] rounded-2xl border border-cyan-300/15 bg-cyan-300/10 p-3 text-sm text-cyan-50">
                      <p className="line-clamp-3 leading-6">{message.text || message.attachments[0]?.name || 'Pinned secure attachment'}</p>
                      <p className="mt-2 text-[11px] text-cyan-200/80">
                        {new Date(message.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

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
                  ) : messages.length === 0 ? (
                    <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-white/[0.05]">
                        <MessageCircleMore className="h-10 w-10 text-slate-500" />
                      </div>
                      <h3 className="text-xl font-semibold text-white">No conversation history yet</h3>
                      <p className="mt-2 max-w-md text-sm leading-7 text-slate-400">
                        Start the thread here. Attachments and voice notes are stored privately and checked server-side.
                      </p>
                    </div>
                  ) : messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn('flex', message.sender_role === 'admin' ? 'justify-end' : 'justify-start')}
                    >
                      <div className="max-w-[82%] space-y-2">
                        <div
                          className={cn(
                            'rounded-[24px] border px-4 py-3 shadow-[0_10px_25px_rgba(0,0,0,0.14)]',
                            message.sender_role === 'admin'
                              ? 'border-white/10 bg-white text-slate-900'
                              : 'border-white/10 bg-[#070f11] text-white',
                          )}
                        >
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              {message.is_pinned ? <Pin className="h-3.5 w-3.5 text-cyan-400" /> : null}
                              {message.conversation_type === 'job' && message.job_id ? (
                                <Badge variant="outline" className="border-emerald-300/20 bg-emerald-300/10 text-[10px] text-emerald-100">
                                  {selectedConversation?.job_code || 'Job'}
                                </Badge>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleTogglePin(message)}
                              className={cn(
                                'rounded-full p-1 transition',
                                message.sender_role === 'admin'
                                  ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                                  : 'text-slate-500 hover:bg-white/[0.08] hover:text-white',
                              )}
                              aria-label={message.is_pinned ? 'Unpin message' : 'Pin message'}
                            >
                              <Pin className="h-3.5 w-3.5" />
                            </button>
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
                                <AttachmentCard
                                  key={attachment.id}
                                  attachment={attachment}
                                  token={token}
                                  tone={message.sender_role === 'admin' ? 'light' : 'dark'}
                                />
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
                    {pendingAttachments.map((attachment) => (
                      <div key={attachment.id} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-200">
                        <span>{attachment.name}</span>
                        <button
                          type="button"
                          onClick={() => setPendingAttachments((prev) => prev.filter((item) => item.id !== attachment.id))}
                          className="rounded-full p-0.5 text-slate-400 hover:bg-white/[0.08] hover:text-white"
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
                    placeholder={selectedConversationId ? 'Write a secure message' : 'Select a thread to start chatting'}
                    className="min-h-[56px] resize-none rounded-[28px] border-white/10 bg-white/[0.04] px-5 py-4 text-white placeholder:text-slate-500"
                    disabled={!selectedConversationId || isVoiceProcessing}
                  />
                  <Button
                    type="button"
                    onClick={() => void handleSend()}
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
    </div>
  );
}
