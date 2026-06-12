import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  BriefcaseBusiness,
  Check,
  CheckCheck,
  Image as ImageIcon,
  MapPin,
  MessageCircleMore,
  Mic,
  MoreVertical,
  Plus,
  Paperclip,
  Pin,
  RefreshCw,
  Search,
  Send,
  Star,
  Square,
  Users,
  X,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChatContextSidebar } from '@/components/chat/ChatContextSidebar';
import { ChatListItem } from '@/components/chat/ChatListItem';
import { ChatMessageTimeline } from '@/components/chat/ChatMessageTimeline';
import { SharedConversationPanel } from '@/components/chat/SharedConversationPanel';
import { useAuth } from '@/contexts/AuthContext';
import { useVoiceNoteRecorder } from '@/hooks/use-voice-note-recorder';
import {
  CHAT_ATTACHMENT_ACCEPT,
  fileToChatAttachment,
  formatVoiceRecordingDuration,
  getChatAttachmentValidationMessage,
} from '@/lib/chat-attachments';
import {
  filterConversationsByQuickFilter,
  formatConversationClock,
  formatMessageDayLabel,
  formatRelativeChatTime,
  getConversationStatusLine,
  getConversationPresenceTone,
  getConversationTypeLabel,
  isImportantChatMessage,
  shouldRenderMessageDayDivider,
  type ChatWorkspaceTab,
  type ChatQuickFilter,
} from '@/lib/chat-ui';
import {
  createAdminChatGroup,
  createChatterLocationRequest,
  fetchAdminChatConversations,
  fetchAdminChatThreadMessages,
  fetchAdminChatTypingStatus,
  fetchAdminJobChatConversation,
  fetchAdminPinnedChatMessages,
  fetchAdminTechnicians,
  getStoredAdminToken,
  markAdminChatThreadRead,
  pinAdminChatMessage,
  sendAdminChatThreadMessage,
  type BackendAdminChatConversation,
  type BackendChatAttachment,
  type BackendChatMessage,
  type BackendChatTypingParticipant,
  type BackendTechnicianListItem,
  unpinAdminChatMessage,
  updateAdminChatTypingStatus,
} from '@/lib/backend-api';
import { captureGps } from '@/lib/attendance-store';
import { cn } from '@/lib/utils';

const CHAT_UNREAD_STORAGE_KEY = 'sm_admin_chat_unread_count';
const CHAT_FAVORITES_STORAGE_KEY = 'sm_admin_chat_favorites_v1';
const CHAT_DRAFTS_STORAGE_KEY = 'sm_admin_chat_drafts_v1';

const QUICK_FILTERS: Array<{ key: ChatQuickFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'direct', label: 'Direct' },
  { key: 'group', label: 'Groups' },
  { key: 'job', label: 'Jobs' },
  { key: 'pinned', label: 'Pinned' },
];

function loadStoredArray(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function loadStoredDrafts(key: string): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string'),
    );
  } catch {
    return {};
  }
}

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

export default function PlatformChatPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedConversationId = searchParams.get('conversationId');
  const requestedJobId = searchParams.get('jobId');
  const [conversations, setConversations] = useState<BackendAdminChatConversation[]>([]);
  const [messages, setMessages] = useState<BackendChatMessage[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<BackendChatMessage[]>([]);
  const [technicians, setTechnicians] = useState<BackendTechnicianListItem[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [favorites, setFavorites] = useState<string[]>(() => loadStoredArray(CHAT_FAVORITES_STORAGE_KEY));
  const [draftsByConversation, setDraftsByConversation] = useState<Record<string, string>>(() => loadStoredDrafts(CHAT_DRAFTS_STORAGE_KEY));
  const [activeFilter, setActiveFilter] = useState<ChatQuickFilter>('all');
  const [contactSearch, setContactSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [draftMessage, setDraftMessage] = useState('');
  const [replyTarget, setReplyTarget] = useState<BackendChatMessage | null>(null);
  const [pendingAttachmentsByConversation, setPendingAttachmentsByConversation] = useState<Record<string, BackendChatAttachment[]>>({});
  const [showGroupComposer, setShowGroupComposer] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [savingGroup, setSavingGroup] = useState(false);
  const [requestingLocation, setRequestingLocation] = useState(false);
  const [importantNextMessage, setImportantNextMessage] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [typingParticipants, setTypingParticipants] = useState<BackendChatTypingParticipant[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isContextSidebarOpen, setIsContextSidebarOpen] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<ChatWorkspaceTab>('chat');
  const attachInputRef = useRef<HTMLInputElement | null>(null);
  const sitePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const typingStopTimeoutRef = useRef<number | null>(null);
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
      if (!selectedConversationId) {
        return;
      }
      setPendingAttachmentsByConversation((prev) => ({
        ...prev,
        [selectedConversationId]: [...(prev[selectedConversationId] ?? []), attachment],
      }));
    },
  });

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );

  const favoriteConversations = useMemo(
    () => conversations.filter((conversation) => favorites.includes(conversation.id)),
    [conversations, favorites],
  );

  const totalUnreadCount = useMemo(
    () => conversations.reduce((sum, conversation) => sum + conversation.unread_count, 0),
    [conversations],
  );

  const filteredConversations = useMemo(
    () => filterConversationsByQuickFilter(conversations, activeFilter),
    [activeFilter, conversations],
  );

  const groupedConversations = useMemo(() => ({
    direct: filteredConversations.filter((conversation) => conversation.channel_kind === 'direct'),
    group: filteredConversations.filter((conversation) => conversation.channel_kind === 'group'),
    job: filteredConversations.filter((conversation) => conversation.channel_kind === 'job'),
  }), [filteredConversations]);

  const conversationSections = useMemo(() => ([
    { key: 'direct', label: 'Direct Chats', items: groupedConversations.direct },
    { key: 'group', label: 'Technician Groups', items: groupedConversations.group },
    { key: 'job', label: 'Job Chats', items: groupedConversations.job },
  ]), [groupedConversations]);

  const recentConversations = useMemo(
    () => filteredConversations.filter((conversation) => !favorites.includes(conversation.id)),
    [favorites, filteredConversations],
  );

  const selectedConversationDraft = selectedConversationId ? (draftsByConversation[selectedConversationId] ?? '') : '';
  const selectedConversationPendingAttachments = selectedConversationId
    ? (pendingAttachmentsByConversation[selectedConversationId] ?? [])
    : [];

  const typingLabel = typingParticipants.length > 0
    ? `${typingParticipants.map((participant) => participant.display_name).join(', ')} ${typingParticipants.length === 1 ? 'is' : 'are'} typing...`
    : '';

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

    if (requestedConversationId && preserveSelection) {
      const matchedConversation = next.find((row) => row.id === requestedConversationId);
      if (matchedConversation) {
        setSelectedConversationId(matchedConversation.id);
        return;
      }
    }

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
      const [thread, pinned] = await Promise.all([
        fetchAdminChatThreadMessages(token, conversationId, search.trim() || undefined),
        fetchAdminPinnedChatMessages(token, conversationId),
      ]);
      setMessages(thread);
      setPinnedMessages(pinned.items);
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
        void loadTypingStatus(selectedConversationId);
      }
    }, 5000);
    const onFocus = () => {
      void loadConversations(contactSearch, true);
      if (selectedConversationId) {
        void loadThread(selectedConversationId, historySearch, true);
        void loadTypingStatus(selectedConversationId);
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
    setDraftMessage(selectedConversationDraft);
  }, [selectedConversationDraft, selectedConversationId]);

  useEffect(() => {
    setWorkspaceTab('chat');
    setImportantNextMessage(false);
    setTypingParticipants([]);
    if (typingStopTimeoutRef.current) {
      window.clearTimeout(typingStopTimeoutRef.current);
      typingStopTimeoutRef.current = null;
    }
    if (selectedConversationId) {
      void loadTypingStatus(selectedConversationId);
    }
  }, [selectedConversationId]);

  useEffect(() => {
    return () => {
      if (typingStopTimeoutRef.current) {
        window.clearTimeout(typingStopTimeoutRef.current);
      }
      if (selectedConversationId) {
        void updateTypingStatus(false, selectedConversationId);
      }
    };
  }, [selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) return;
    setDraftsByConversation((prev) => {
      const current = prev[selectedConversationId] ?? '';
      if (draftMessage.trim().length === 0) {
        if (!current) return prev;
        const next = { ...prev };
        delete next[selectedConversationId];
        return next;
      }
      if (current === draftMessage) return prev;
      return {
        ...prev,
        [selectedConversationId]: draftMessage,
      };
    });
  }, [draftMessage, selectedConversationId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CHAT_FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CHAT_DRAFTS_STORAGE_KEY, JSON.stringify(draftsByConversation));
  }, [draftsByConversation]);

  useEffect(() => {
    syncUnreadBadge(totalUnreadCount);
  }, [totalUnreadCount]);

  const toggleFavoriteConversation = (conversationId: string) => {
    setFavorites((prev) => (
      prev.includes(conversationId)
        ? prev.filter((item) => item !== conversationId)
        : [...prev, conversationId]
    ));
  };

  const loadTypingStatus = async (conversationId = selectedConversationId) => {
    if (!token || !conversationId) {
      setTypingParticipants([]);
      return;
    }
    try {
      const status = await fetchAdminChatTypingStatus(token, conversationId);
      setTypingParticipants(status.participants);
    } catch {
      setTypingParticipants([]);
    }
  };

  const updateTypingStatus = async (isTyping: boolean, conversationId = selectedConversationId) => {
    if (!token || !conversationId) return;
    try {
      const status = await updateAdminChatTypingStatus(token, conversationId, isTyping);
      setTypingParticipants(status.participants);
    } catch {
      // Typing is best-effort presence; message sending should never depend on it.
    }
  };

  const handleDraftMessageChange = (value: string) => {
    setDraftMessage(value);
    if (!selectedConversationId) return;
    void updateTypingStatus(value.trim().length > 0);
    if (typingStopTimeoutRef.current) {
      window.clearTimeout(typingStopTimeoutRef.current);
    }
    typingStopTimeoutRef.current = window.setTimeout(() => {
      void updateTypingStatus(false);
    }, 1800);
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

  const buildOutgoingMetadata = (metadata?: Record<string, unknown> | null) => {
    const next = metadata ? { ...metadata } : {};
    if (replyTarget) {
      next.reply_to_message_id = replyTarget.id;
      next.reply_to_sender_name = replyTarget.sender_role === 'admin'
        ? 'Admin Dispatch'
        : (selectedConversation?.channel_kind === 'group'
          ? (selectedConversation.title || 'Technician Group')
          : (selectedConversation?.technician_name || 'Technician'));
      next.reply_to_text = replyTarget.text || replyTarget.attachments[0]?.name || '';
    }
    if (importantNextMessage) {
      next.important = true;
      if (!next.kind) {
        next.kind = 'important';
      }
    }
    return Object.keys(next).length > 0 ? next : undefined;
  };

  const clearPendingAttachments = (conversationId: string) => {
    if (!conversationId) {
      return;
    }
    setPendingAttachmentsByConversation((prev) => {
      const next = { ...prev };
      delete next[conversationId];
      return next;
    });
  };

  const sendChatMessage = async (
    payload: {
      text?: string;
      attachments?: BackendChatAttachment[];
      metadata?: Record<string, unknown> | null;
      clearDraft?: boolean;
      clearAttachments?: boolean;
    },
  ) => {
    const conversationId = selectedConversationId;
    const attachments = payload.attachments ?? selectedConversationPendingAttachments;
    const content = payload.text?.trim();
    if (!token || !conversationId || (!content && attachments.length === 0)) {
      return null;
    }

    const sent = await sendAdminChatThreadMessage(token, conversationId, {
      text: content || undefined,
      attachments,
      metadata: buildOutgoingMetadata(payload.metadata),
    });

    setMessages((prev) => [...prev, sent]);
    void updateTypingStatus(false, conversationId);
    setDraftMessage((current) => (payload.clearDraft ? '' : current));
    if (payload.clearAttachments ?? true) {
      clearPendingAttachments(conversationId);
    }
    setReplyTarget(null);
    setImportantNextMessage(false);
    seenMessageIdsRef.current.add(sent.id);
    await loadConversations(contactSearch, true);
    await loadThread(conversationId, historySearch, true);
    return sent;
  };

  const handleOpenAttachFiles = () => {
    attachInputRef.current?.click();
  };

  const handleOpenSitePhotoPicker = () => {
    sitePhotoInputRef.current?.click();
  };

  const handleFileSelection = async (event: React.ChangeEvent<HTMLInputElement>, source: 'attach' | 'site_photo') => {
    const files = Array.from(event.target.files ?? []);
    const nextAttachments: BackendChatAttachment[] = [];
    for (const file of files) {
      const isSitePhoto = source === 'site_photo';
      const isImageFile = file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic|heif)$/i.test(file.name);
      const validationMessage = isSitePhoto
        ? (isImageFile ? null : `${file.name} must be an image for site photo uploads.`)
        : getChatAttachmentValidationMessage(file);
      if (validationMessage) {
        toast.error(validationMessage);
        continue;
      }
      nextAttachments.push(await fileToChatAttachment(file));
    }
    if (selectedConversationId && nextAttachments.length > 0) {
      setPendingAttachmentsByConversation((prev) => ({
        ...prev,
        [selectedConversationId]: [
          ...(prev[selectedConversationId] ?? []),
          ...nextAttachments,
        ],
      }));
      setWorkspaceTab('chat');
    }
    event.target.value = '';
  };

  const handleSend = async () => {
    const content = draftMessage.trim();
    if (!content && selectedConversationPendingAttachments.length === 0) return;

    try {
      await sendChatMessage({
        text: content || undefined,
        attachments: selectedConversationPendingAttachments,
        clearDraft: true,
        clearAttachments: true,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send message.');
    }
  };

  const handleRequestLocation = async () => {
    if (!token || !selectedConversation) return;
    if (selectedConversation.channel_kind === 'group') {
      toast.error('Location requests are only available in direct or job conversations.');
      return;
    }
    try {
      setRequestingLocation(true);
      await createChatterLocationRequest(token, {
        technician_id: selectedConversation.technician_id,
        conversation_id: selectedConversation.id,
      });
      toast.success('Location request sent.', {
        description: 'The technician can share once or decline from Chatter.',
      });
      await sendChatMessage({
        text: 'Location request sent. Please share your current location when available.',
        attachments: [],
        metadata: { kind: 'location_request' },
        clearDraft: false,
        clearAttachments: false,
      }).catch(() => undefined);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to request location.');
    } finally {
      setRequestingLocation(false);
    }
  };

  const handleShareLiveLocation = async () => {
    if (!token || !selectedConversation) return;
    try {
      const gps = await captureGps();
      if (!gps) {
        toast.error('Location access is required to share your current location.');
        return;
      }
      await sendChatMessage({
        text: `Shared live location: ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)} (${Math.round(gps.accuracy)}m accuracy).`,
        attachments: [],
        metadata: {
          kind: 'live_location',
          latitude: gps.lat,
          longitude: gps.lng,
          accuracy: gps.accuracy,
        },
        clearDraft: false,
        clearAttachments: false,
      });
      toast.success('Live location shared.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to share location.');
    }
  };

  const handleShareJobDetails = async () => {
    if (!token || !selectedConversation || selectedConversation.channel_kind !== 'job' || !selectedConversation.job_id) {
      toast.error('Job details are only available in job-linked chats.');
      return;
    }
    try {
      await sendChatMessage({
        text: `Shared job details for ${selectedConversation.job_code || 'this job'}.`,
        attachments: [],
        metadata: {
          kind: 'job_details',
        },
        clearDraft: false,
        clearAttachments: false,
      });
      toast.success('Job details shared.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to share job details.');
    }
  };

  const handleRequestStatusUpdate = async () => {
    if (!token || !selectedConversation || selectedConversation.channel_kind === 'group') {
      toast.error('Status update requests are only available in direct or job conversations.');
      return;
    }
    try {
      await sendChatMessage({
        text: 'Please send a status update when you can.',
        attachments: [],
        metadata: {
          kind: 'status_request',
        },
        clearDraft: false,
        clearAttachments: false,
      });
      toast.success('Status update request sent.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to request a status update.');
    }
  };

  const toggleImportantNextMessage = () => {
    setImportantNextMessage((prev) => !prev);
  };

  const handleReplyToMessage = (message: BackendChatMessage) => {
    setReplyTarget(message);
    setImportantNextMessage(false);
  };

  const handleMarkImportantMessage = (message: BackendChatMessage) => {
    setReplyTarget(message);
    setImportantNextMessage(true);
    toast.info('The next reply will be marked important.');
  };

  const handleOpenJob = (jobId: string) => {
    navigate(`/admin/jobs/${encodeURIComponent(jobId)}`);
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
    <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 rounded-[34px] bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),rgba(34,211,238,0)_34%),radial-gradient(circle_at_top_right,rgba(52,211,153,0.08),rgba(52,211,153,0)_30%)]" />
      <div className="relative flex min-h-0 flex-1 flex-col gap-4">
        <section className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
            <Card className="flex min-h-0 flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.96),rgba(6,17,29,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
              <div className="shrink-0 border-b border-white/8 p-5">
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
                <div className="flex flex-wrap gap-2">
                  {QUICK_FILTERS.map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => setActiveFilter(filter.key)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs font-medium transition',
                        activeFilter === filter.key
                          ? 'border-cyan-300/30 bg-cyan-300/12 text-cyan-100'
                          : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white',
                      )}
                    >
                      {filter.label}
                    </button>
                  ))}
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
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-3 px-2.5 py-2">
                {favoriteConversations.length > 0 ? (
                  <section className="space-y-2">
                    <div className="px-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Favorites
                    </div>
                    <div className="space-y-2">
                      {favoriteConversations.map((conversation) => (
                        <ChatListItem
                          key={`favorite-${conversation.id}`}
                          title={conversation.title}
                          preview={conversation.last_message_preview || getConversationTypeLabel(conversation)}
                          timestamp={formatRelativeChatTime(conversation.last_message_at)}
                          statusLabel={`${getConversationTypeLabel(conversation)} · ${conversation.channel_kind === 'group'
                            ? `${conversation.member_count} member${conversation.member_count === 1 ? '' : 's'}`
                            : conversation.channel_kind === 'job'
                              ? (conversation.job_status || 'Active job')
                              : (conversation.technician_status || 'Offline')}`}
                          statusTone={getConversationPresenceTone(conversation)}
                          initials={getConversationInitials(conversation)}
                          avatarUrl={conversation.technician_avatar || undefined}
                          active={selectedConversationId === conversation.id}
                          unreadCount={conversation.unread_count}
                          favorite
                          onClick={() => setSelectedConversationId(conversation.id)}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}

                {recentConversations.length > 0 ? (
                  <section className="space-y-2">
                    <div className="px-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Recent
                    </div>
                    <div className="space-y-1">
                      {recentConversations.slice(0, 6).map((conversation) => (
                        <ChatListItem
                          key={`recent-${conversation.id}`}
                          title={conversation.channel_kind === 'group' ? conversation.title : conversation.technician_name}
                          preview={conversation.last_message_preview || (conversation.channel_kind === 'group' ? conversation.member_names.join(', ') : 'No messages yet')}
                          timestamp={formatRelativeChatTime(conversation.last_message_at)}
                          statusLabel={`${getConversationTypeLabel(conversation)} · ${conversation.channel_kind === 'group'
                            ? `${conversation.member_count} member${conversation.member_count === 1 ? '' : 's'}`
                            : conversation.channel_kind === 'job'
                              ? (conversation.job_status || 'Active job')
                              : (conversation.technician_status || 'Offline')}`}
                          statusTone={getConversationPresenceTone(conversation)}
                          initials={getConversationInitials(conversation)}
                          avatarUrl={conversation.channel_kind === 'group' ? undefined : (conversation.technician_avatar || undefined)}
                          active={selectedConversationId === conversation.id}
                          unreadCount={conversation.unread_count}
                          favorite={favorites.includes(conversation.id)}
                          onClick={() => setSelectedConversationId(conversation.id)}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}

                {loadingConversations ? (
                  <div className="space-y-2 p-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="h-16 animate-pulse rounded-[14px] bg-white/[0.05]" />
                    ))}
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-slate-400">
                    {contactSearch.trim().length > 0
                      ? 'No chats matched that search. Try a technician name, group, or job code.'
                      : activeFilter === 'all'
                        ? 'No direct chats, technician groups, or job chats have started yet.'
                        : `No ${activeFilter} conversations are available right now.`}
                  </div>
                ) : conversationSections.map((section) => (
                  section.items.length > 0 ? (
                    <section key={section.key} className="space-y-2">
                      <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                        {section.label}
                      </div>
                      <div className="space-y-1">
                        {section.items.map((conversation) => (
                          <ChatListItem
                            key={conversation.id}
                            title={conversation.channel_kind === 'group' ? conversation.title : conversation.technician_name}
                            preview={conversation.last_message_preview || (conversation.channel_kind === 'group' ? conversation.member_names.join(', ') : conversation.title)}
                            timestamp={formatRelativeChatTime(conversation.last_message_at)}
                            statusLabel={`${getConversationTypeLabel(conversation)} · ${conversation.channel_kind === 'group'
                              ? `${conversation.member_count} member${conversation.member_count === 1 ? '' : 's'}`
                              : conversation.channel_kind === 'job'
                                ? (conversation.job_status || 'Active job')
                                : (conversation.technician_status || 'Offline')}`}
                            statusTone={getConversationPresenceTone(conversation)}
                            initials={getConversationInitials(conversation)}
                            avatarUrl={conversation.channel_kind === 'group' ? undefined : (conversation.technician_avatar || undefined)}
                            active={selectedConversationId === conversation.id}
                            unreadCount={conversation.unread_count}
                            favorite={favorites.includes(conversation.id)}
                            onClick={() => setSelectedConversationId(conversation.id)}
                          />
                        ))}
                      </div>
                    </section>
                  ) : null
                ))}
              </div>
            </ScrollArea>
          </Card>

          <Card className="flex min-h-0 flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.96),rgba(6,17,29,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="shrink-0 border-b border-white/8 p-5">
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
                      <Badge className={cn(
                        'rounded-full',
                        selectedConversation?.channel_kind === 'job'
                          ? 'bg-emerald-400/15 text-emerald-100'
                          : selectedConversation?.channel_kind === 'group'
                            ? 'bg-cyan-400/15 text-cyan-100'
                            : 'bg-slate-300/10 text-slate-100',
                      )}>
                        {selectedConversation?.channel_kind === 'job' ? (
                          <BriefcaseBusiness className="mr-1 h-3.5 w-3.5" />
                        ) : selectedConversation?.channel_kind === 'group' ? (
                          <Users className="mr-1 h-3.5 w-3.5" />
                        ) : (
                          <MessageCircleMore className="mr-1 h-3.5 w-3.5" />
                        )}
                        {getConversationTypeLabel(selectedConversation)}
                      </Badge>
                      {selectedConversation && favorites.includes(selectedConversation.id) ? (
                        <Badge className="rounded-full bg-amber-300/15 text-amber-100">
                          <Star className="mr-1 h-3.5 w-3.5 fill-current" />
                          Favorite
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-slate-400">{getConversationStatusLine(selectedConversation)}</p>
                    {selectedConversation ? (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{selectedConversation.unread_count} unread</span>
                        <span>&middot;</span>
                        <span>{selectedConversation.pinned_count} pinned</span>
                        <span>&middot;</span>
                        <span>{formatRelativeChatTime(selectedConversation.last_message_at)}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="grid min-w-[280px] gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      value={historySearch}
                      onChange={(event) => setHistorySearch(event.target.value)}
                      placeholder="Search this thread"
                      className="h-10 rounded-full border-white/10 bg-white/[0.04] pl-9 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => selectedConversation && toggleFavoriteConversation(selectedConversation.id)}
                      disabled={!selectedConversation}
                      className="h-9 gap-2 rounded-full border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.08]"
                    >
                      <Star className={cn('h-4 w-4', selectedConversation && favorites.includes(selectedConversation.id) && 'fill-current text-amber-300')} />
                      Favorite
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setIsContextSidebarOpen(true)}
                      disabled={!selectedConversation}
                      className="h-9 w-9 rounded-full border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.08]"
                      aria-label="Open conversation sidebar"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-b border-white/8 px-5 pt-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setWorkspaceTab('chat')}
                  className={cn(
                    'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                    workspaceTab === 'chat'
                      ? 'border-sky-400 text-white'
                      : 'border-transparent text-slate-500 hover:text-slate-300',
                  )}
                >
                  Chat
                </button>
                <button
                  type="button"
                  onClick={() => setWorkspaceTab('shared')}
                  className={cn(
                    'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                    workspaceTab === 'shared'
                      ? 'border-sky-400 text-white'
                      : 'border-transparent text-slate-500 hover:text-slate-300',
                  )}
                >
                  Shared
                </button>
              </div>
            </div>

            {workspaceTab === 'chat' ? (
              <div className="flex min-h-0 flex-1 flex-col bg-transparent">
                <ScrollArea className="min-h-0 flex-1">
                  <div className="space-y-4 px-5 py-5">
                    {loadingMessages ? (
                      Array.from({ length: 4 }).map((_, index) => (
                        <div
                          key={index}
                          className={cn(
                            'h-14 w-[min(64%,39rem)] animate-pulse rounded-[18px] bg-white/[0.05]',
                            index % 2 === 0 ? 'ml-0' : 'ml-auto',
                          )}
                        />
                      ))
                    ) : messages.length === 0 ? (
                      <div className="flex min-h-[260px] flex-col items-center justify-center py-10 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.04]">
                          <MessageCircleMore className="h-8 w-8 text-slate-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-white">
                          {historySearch.trim() ? 'No messages matched this search' : 'No messages yet'}
                        </h3>
                        <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
                          {historySearch.trim()
                            ? 'Try a different keyword, sender, or job code.'
                            : 'Send a message, attach a file, or record a voice note to start this secure conversation.'}
                        </p>
                      </div>
                    ) : (
                      <ChatMessageTimeline
                        messages={messages}
                        conversation={selectedConversation}
                        token={token}
                        viewerRole="admin"
                        outgoingRole="admin"
                        getSenderLabel={(message) => (
                          message.sender_role === 'admin'
                            ? 'Admin Dispatch'
                            : (selectedConversation?.channel_kind === 'group'
                              ? (selectedConversation.title || 'Technician Group')
                              : (selectedConversation?.technician_name || 'Technician'))
                        )}
                        onOpenJob={handleOpenJob}
                        onReply={handleReplyToMessage}
                        onTogglePin={handleTogglePin}
                        onMarkImportant={handleMarkImportantMessage}
                      />
                    )}
                    <div ref={bottomRef} />
                  </div>
                </ScrollArea>

                <div className="shrink-0 border-t border-white/8 bg-[#0b1220] px-4 py-4">
                  {typingLabel ? (
                    <div className="mb-2 px-2 text-xs font-medium text-sky-300">
                      {typingLabel}
                    </div>
                  ) : null}
                  {replyTarget ? (
                    <div className="mb-3 flex items-start justify-between gap-3 rounded-2xl border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs text-sky-50">
                      <div className="min-w-0">
                        <p className="font-semibold">Replying to {replyTarget.sender_role === 'admin' ? 'Admin Dispatch' : (selectedConversation?.technician_name || 'Technician')}</p>
                        <p className="mt-1 line-clamp-2 text-sky-100/80">
                          {replyTarget.text || replyTarget.attachments[0]?.name || 'Message'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReplyTarget(null)}
                        className="rounded-full p-1 text-sky-100/80 hover:bg-sky-100/10 hover:text-white"
                        aria-label="Clear reply target"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                  {selectedConversationPendingAttachments.length > 0 ? (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {selectedConversationPendingAttachments.map((attachment) => (
                        <div key={attachment.id} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-200">
                          <span>{attachment.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (!selectedConversationId) {
                                return;
                              }
                              setPendingAttachmentsByConversation((prev) => {
                                const current = prev[selectedConversationId] ?? [];
                                const next = current.filter((item) => item.id !== attachment.id);
                                if (next.length === 0) {
                                  const nextState = { ...prev };
                                  delete nextState[selectedConversationId];
                                  return nextState;
                                }
                                return {
                                  ...prev,
                                  [selectedConversationId]: next,
                                };
                              });
                            }}
                            className="rounded-full p-0.5 text-slate-400 hover:bg-white/[0.08] hover:text-white"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {isRecording || isVoiceProcessing ? (
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1.5 text-xs text-sky-100">
                      {isRecording ? <Square className="h-3.5 w-3.5 fill-current" /> : <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                      <span>
                        {isRecording
                          ? `Recording voice note ${formatVoiceRecordingDuration(recordingSeconds)}`
                          : 'Securing voice note...'}
                      </span>
                    </div>
                  ) : null}

                  {importantNextMessage ? (
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs font-medium text-amber-100">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      Important next message
                      <button
                        type="button"
                        onClick={toggleImportantNextMessage}
                        className="rounded-full p-0.5 text-amber-100/80 hover:bg-amber-200/10 hover:text-amber-50"
                        aria-label="Clear important message flag"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : null}

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleOpenAttachFiles()}
                      disabled={!selectedConversationId || isVoiceProcessing}
                      className="h-10 w-10 shrink-0 rounded-full border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
                      aria-label="Attach files"
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
                        'h-10 w-10 shrink-0 rounded-full border text-slate-100',
                        isRecording
                          ? 'border-red-400/40 bg-red-500/15 hover:bg-red-500/25'
                          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.08]',
                      )}
                      disabled={!selectedConversationId || isVoiceProcessing || !voiceRecordingSupported}
                      aria-label={isRecording ? 'Stop recording voice note' : 'Record voice note'}
                    >
                      {isRecording ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}
                    </Button>
                    <div className="min-w-0 flex-1">
                      <Textarea
                        value={draftMessage}
                        onChange={(event) => handleDraftMessageChange(event.target.value)}
                        onKeyDown={handleComposerKeyDown}
                        placeholder={selectedConversationId ? 'Write a secure message' : 'Select a thread to start chatting'}
                        className="min-h-[46px] resize-none rounded-full border-white/10 bg-white/[0.04] px-4 py-3 text-[14px] text-white placeholder:text-slate-500"
                        disabled={!selectedConversationId || isVoiceProcessing}
                      />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 shrink-0 rounded-full border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
                          disabled={!selectedConversationId || isVoiceProcessing}
                          aria-label="More actions"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="border-white/10 bg-[#091827] text-slate-100">
                        <DropdownMenuItem onSelect={() => handleOpenSitePhotoPicker()} disabled={!selectedConversationId || isVoiceProcessing}>
                          <ImageIcon className="h-4 w-4" />
                          Upload Site Photo
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => void handleShareLiveLocation()} disabled={!selectedConversationId || isVoiceProcessing}>
                          <MapPin className="h-4 w-4" />
                          Send Live Location
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => void handleRequestLocation()} disabled={!selectedConversation || selectedConversation.channel_kind === 'group' || requestingLocation || isVoiceProcessing}>
                          <MapPin className="h-4 w-4" />
                          Request Location
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => void handleRequestStatusUpdate()} disabled={!selectedConversation || selectedConversation.channel_kind === 'group' || isVoiceProcessing}>
                          <MessageCircleMore className="h-4 w-4" />
                          Request Status Update
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => void handleShareJobDetails()} disabled={!selectedConversation || selectedConversation.channel_kind !== 'job' || isVoiceProcessing}>
                          <BriefcaseBusiness className="h-4 w-4" />
                          Share Job Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuCheckboxItem
                          checked={importantNextMessage}
                          onCheckedChange={() => toggleImportantNextMessage()}
                          disabled={!selectedConversationId || isVoiceProcessing}
                        >
                          <Star className="h-4 w-4" />
                          Mark as Important
                        </DropdownMenuCheckboxItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      type="button"
                      onClick={() => void handleSend()}
                      className="h-10 w-10 shrink-0 rounded-full bg-sky-500 text-white hover:bg-sky-600"
                      disabled={!selectedConversationId || isVoiceProcessing}
                      aria-label="Send message"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col bg-transparent">
                <SharedConversationPanel
                  conversation={selectedConversation}
                  messages={messages}
                  token={token}
                  viewerRole="admin"
                  canUpload={Boolean(selectedConversationId && !isVoiceProcessing)}
                  onUploadFiles={handleOpenAttachFiles}
                  className="h-full rounded-none border-0 bg-transparent shadow-none"
                />
              </div>
            )}
          </Card>

        </section>
      </div>

      <ChatContextSidebar
        open={isContextSidebarOpen}
        onOpenChange={setIsContextSidebarOpen}
        conversation={selectedConversation}
        messages={messages}
        token={token}
        viewerRole="admin"
        currentUserName={user?.name ?? null}
        canUpload={Boolean(selectedConversationId && !isVoiceProcessing)}
        onUploadFiles={handleOpenAttachFiles}
      />
    </div>
  );
}
