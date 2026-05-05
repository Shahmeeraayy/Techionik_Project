import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  File,
  Image as ImageIcon,
  MessageCircleMore,
  Paperclip,
  Search,
  Send,
  Users,
  Megaphone,
  X,
  Phone,
  Video,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
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

type Contact = {
  id: string;
  name: string;
  avatar?: string;
  jobStatus: 'Available' | 'In Progress' | 'Offline' | 'Out of Office';
  unreadCount: number;
  preview: string;
  lastMessageAt: string;
  online: boolean;
};

type AttachmentItem = {
  id: string;
  name: string;
  sizeLabel: string;
  kind: 'image' | 'document';
  previewUrl?: string;
};

type ChatMessage = {
  id: string;
  conversationId: string;
  sender: 'admin' | 'technician' | 'broadcast';
  text: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
  attachments?: AttachmentItem[];
};

const CHAT_UNREAD_STORAGE_KEY = 'sm_admin_chat_unread_count';

const sampleContacts: Contact[] = [
  {
    id: 'tech-1',
    name: 'John Doe',
    jobStatus: 'In Progress',
    unreadCount: 2,
    preview: 'I reached the dealership and started diagnostics.',
    lastMessageAt: '4:45 pm',
    online: true,
  },
  {
    id: 'tech-2',
    name: 'Travis Barker',
    jobStatus: 'Available',
    unreadCount: 0,
    preview: 'Ready for the next dispatch.',
    lastMessageAt: '3:18 pm',
    online: true,
  },
  {
    id: 'tech-3',
    name: 'Kate Rose',
    jobStatus: 'Out of Office',
    unreadCount: 1,
    preview: 'Returning tomorrow at 8:00 AM.',
    lastMessageAt: '1:22 pm',
    online: false,
  },
];

const sampleMessages: ChatMessage[] = [
  {
    id: 'm-1',
    conversationId: 'tech-1',
    sender: 'technician',
    text: "I'm on site now and working through the no-start issue.",
    timestamp: '10:37 am',
    status: 'read',
  },
  {
    id: 'm-2',
    conversationId: 'tech-1',
    sender: 'admin',
    text: 'Copy that. Keep me posted if you need approval for extra service lines.',
    timestamp: '10:41 am',
    status: 'read',
  },
  {
    id: 'm-3',
    conversationId: 'tech-1',
    sender: 'technician',
    text: 'Here are the photos from the inspection bay.',
    timestamp: '11:19 am',
    status: 'read',
    attachments: [
      {
        id: 'a-1',
        name: 'bay-01.jpg',
        sizeLabel: '1.2 MB',
        kind: 'image',
      },
      {
        id: 'a-2',
        name: 'bay-02.jpg',
        sizeLabel: '980 KB',
        kind: 'image',
      },
      {
        id: 'a-3',
        name: 'intake.pdf',
        sizeLabel: '340 KB',
        kind: 'document',
      },
    ],
  },
  {
    id: 'm-4',
    conversationId: 'tech-1',
    sender: 'admin',
    text: 'Looks good. Please complete the service notes once the battery test is finished.',
    timestamp: '12:25 pm',
    status: 'delivered',
  },
];

function formatMessageStatus(status: ChatMessage['status']) {
  if (status === 'read') {
    return <CheckCheck className="h-3.5 w-3.5 text-cyan-300" />;
  }
  if (status === 'delivered') {
    return <CheckCheck className="h-3.5 w-3.5 text-slate-400" />;
  }
  return <Check className="h-3.5 w-3.5 text-slate-500" />;
}

function getAttachmentIcon(kind: AttachmentItem['kind']) {
  return kind === 'image' ? ImageIcon : File;
}

export default function PlatformChatPage() {
  const { technicianAccounts } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>(sampleMessages);
  const [selectedConversationId, setSelectedConversationId] = useState<string>('tech-1');
  const [contactSearch, setContactSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [draftMessage, setDraftMessage] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentItem[]>([]);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastDraft, setBroadcastDraft] = useState('');
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (technicianAccounts.length > 0) {
      const seeded = technicianAccounts.map((account, index) => ({
        id: account.id,
        name: account.name,
        avatar: account.avatar,
        jobStatus: (['Available', 'In Progress', 'Offline', 'Out of Office'] as const)[index % 4],
        unreadCount: index === 0 ? 2 : 0,
        preview: index === 0 ? 'I reached the dealership and started diagnostics.' : 'No unread messages.',
        lastMessageAt: index === 0 ? '4:45 pm' : '1:15 pm',
        online: index % 3 !== 2,
      }));
      setContacts(seeded);
      setSelectedConversationId(seeded[0]?.id ?? 'tech-1');
      return;
    }

    setContacts(sampleContacts);
  }, [technicianAccounts]);

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedConversationId) ?? contacts[0] ?? sampleContacts[0],
    [contacts, selectedConversationId],
  );

  const filteredContacts = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    if (!query) {
      return contacts;
    }
    return contacts.filter((contact) => contact.name.toLowerCase().includes(query));
  }, [contactSearch, contacts]);

  const visibleMessages = useMemo(() => {
    const thread = messages.filter((message) => message.conversationId === selectedConversationId);
    const query = historySearch.trim().toLowerCase();
    if (!query) {
      return thread;
    }
    return thread.filter((message) => (
      message.text.toLowerCase().includes(query)
      || message.attachments?.some((attachment) => attachment.name.toLowerCase().includes(query))
    ));
  }, [historySearch, messages, selectedConversationId]);

  const totalUnreadCount = useMemo(
    () => contacts.reduce((sum, contact) => sum + contact.unreadCount, 0),
    [contacts],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(CHAT_UNREAD_STORAGE_KEY, String(totalUnreadCount));
    window.dispatchEvent(new CustomEvent('sm-chat-unread-count', { detail: { count: totalUnreadCount } }));
  }, [totalUnreadCount]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages.length, selectedConversationId]);

  useEffect(() => {
    if (!selectedContact) return;
    setContacts((prev) => prev.map((contact) => (
      contact.id === selectedContact.id ? { ...contact, unreadCount: 0 } : contact
    )));
  }, [selectedContact?.id]);

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

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const nextAttachments: AttachmentItem[] = [];

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} exceeds the 10MB limit.`);
        continue;
      }

      const isImage = file.type.startsWith('image/');
      nextAttachments.push({
        id: `${file.name}-${file.size}-${Date.now()}`,
        name: file.name,
        sizeLabel: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        kind: isImage ? 'image' : 'document',
        previewUrl: isImage ? URL.createObjectURL(file) : undefined,
      });
    }

    setPendingAttachments((prev) => [...prev, ...nextAttachments]);
    if (event.target) {
      event.target.value = '';
    }
  };

  const pushSimulatedReply = (conversationId: string) => {
    window.setTimeout(() => {
      const reply: ChatMessage = {
        id: `reply-${Date.now()}`,
        conversationId,
        sender: 'technician',
        text: 'Received. I’ll update the job thread once this step is complete.',
        timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase(),
        status: 'read',
      };

      setMessages((prev) => [...prev, reply]);
      setContacts((prev) => prev.map((contact) => (
        contact.id === conversationId
          ? {
              ...contact,
              preview: reply.text,
              lastMessageAt: reply.timestamp,
              unreadCount: conversationId === selectedConversationId ? 0 : contact.unreadCount + 1,
            }
          : contact
      )));

      if (typeof document !== 'undefined' && document.hidden && notificationEnabled && 'Notification' in window) {
        new Notification(selectedContact?.name ?? 'Technician', {
          body: reply.text,
        });
      } else {
        toast.message(`New message from ${selectedContact?.name ?? 'technician'}`, {
          description: reply.text,
        });
      }
    }, 1200);
  };

  const handleSendMessage = () => {
    const content = draftMessage.trim();
    if (!content && pendingAttachments.length === 0) {
      return;
    }

    const nextMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      conversationId: selectedConversationId,
      sender: 'admin',
      text: content,
      timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase(),
      status: 'sent',
      attachments: pendingAttachments.length > 0 ? pendingAttachments : undefined,
    };

    setMessages((prev) => [...prev, nextMessage]);
    setContacts((prev) => prev.map((contact) => (
      contact.id === selectedConversationId
        ? { ...contact, preview: content || `${pendingAttachments.length} attachment${pendingAttachments.length === 1 ? '' : 's'}`, lastMessageAt: nextMessage.timestamp }
        : contact
    )));
    setDraftMessage('');
    setPendingAttachments([]);
    pushSimulatedReply(selectedConversationId);
  };

  const handleBroadcast = () => {
    const content = broadcastDraft.trim();
    if (!content) return;

    const timeLabel = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
    const broadcastMessages = contacts.map((contact) => ({
      id: `broadcast-${contact.id}-${Date.now()}`,
      conversationId: contact.id,
      sender: 'broadcast' as const,
      text: content,
      timestamp: timeLabel,
      status: 'delivered' as const,
    }));

    setMessages((prev) => [...prev, ...broadcastMessages]);
    setContacts((prev) => prev.map((contact) => ({
      ...contact,
      preview: content,
      lastMessageAt: timeLabel,
    })));
    setBroadcastDraft('');
    setBroadcastOpen(false);
    toast.success(`Broadcast sent to ${contacts.length} technician${contacts.length === 1 ? '' : 's'}.`);
  };

  const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
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
                Admin chat
                <span className="block bg-gradient-to-r from-white via-cyan-100 to-emerald-100 bg-clip-text text-transparent">
                  command channel
                </span>
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-[15px]">
                Real-time admin to technician messaging, broadcast announcements, and thread history without leaving the platform.
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
                {filteredContacts.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => setSelectedConversationId(contact.id)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition',
                      selectedConversationId === contact.id
                        ? 'border-cyan-300/20 bg-cyan-300/10'
                        : 'border-transparent bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]',
                    )}
                  >
                    <div className="relative">
                      <Avatar className="h-11 w-11 border border-white/10">
                        <AvatarImage src={contact.avatar} alt={contact.name} />
                        <AvatarFallback className="bg-white/[0.06] text-slate-100">
                          {contact.name.split(' ').map((chunk) => chunk[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <span className={cn(
                        'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#091827]',
                        contact.online ? 'bg-emerald-400' : 'bg-slate-500',
                      )} />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-white">{contact.name}</p>
                        <span className="shrink-0 text-xs text-slate-500">{contact.lastMessageAt}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="h-5 border-white/10 bg-white/[0.03] px-2 text-[10px] text-slate-300">
                          {contact.jobStatus}
                        </Badge>
                        {contact.unreadCount > 0 ? (
                          <Badge className="h-5 min-w-5 justify-center rounded-full bg-cyan-400 px-1.5 text-[10px] text-slate-950">
                            {contact.unreadCount}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="truncate text-sm text-slate-400">{contact.preview}</p>
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
                    <AvatarImage src={selectedContact?.avatar} alt={selectedContact?.name} />
                    <AvatarFallback className="bg-white/[0.06] text-slate-100">
                      {selectedContact?.name.split(' ').map((chunk) => chunk[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold tracking-[-0.04em] text-white">{selectedContact?.name}</h2>
                      <span className={cn(
                        'h-2.5 w-2.5 rounded-full',
                        selectedContact?.online ? 'bg-emerald-400' : 'bg-slate-500',
                      )} />
                      <span className="text-sm text-slate-400">{selectedContact?.jobStatus}</span>
                    </div>
                    <p className="text-sm text-slate-400">
                      Full message history retained in-platform. Email digest follows Settings if unread for 30 minutes.
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
                  <Button variant="outline" size="icon" className="h-10 w-10 rounded-full border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]">
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-10 w-10 rounded-full border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]">
                    <Video className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid min-h-[920px] grid-rows-[1fr_auto] bg-[linear-gradient(180deg,rgba(238,247,248,0.03),rgba(255,255,255,0.01))]">
              <ScrollArea className="h-full">
                <div className="space-y-4 px-5 py-6">
                  {visibleMessages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        'flex',
                        message.sender === 'admin' ? 'justify-end' : 'justify-start',
                      )}
                    >
                      <div className={cn(
                        'max-w-[80%] space-y-2',
                        message.sender === 'admin' ? 'items-end' : 'items-start',
                      )}>
                        <div
                          className={cn(
                            'rounded-[24px] border px-4 py-3 shadow-[0_10px_25px_rgba(0,0,0,0.14)]',
                            message.sender === 'admin'
                              ? 'border-white/10 bg-white text-slate-900'
                              : message.sender === 'broadcast'
                                ? 'border-cyan-300/20 bg-cyan-300/12 text-cyan-50'
                                : 'border-white/10 bg-[#070f11] text-white',
                          )}
                        >
                          {message.text ? <p className="text-sm leading-6">{message.text}</p> : null}
                          {message.attachments?.length ? (
                            <div className={cn(
                              'mt-3 grid gap-2',
                              message.attachments.length >= 3 ? 'grid-cols-3' : 'grid-cols-2',
                            )}>
                              {message.attachments.map((attachment) => {
                                const AttachmentIcon = getAttachmentIcon(attachment.kind);
                                return (
                                  <div key={attachment.id} className="overflow-hidden rounded-2xl border border-black/10 bg-white/95">
                                    {attachment.kind === 'image' ? (
                                      <div className="flex aspect-[1/0.9] items-center justify-center bg-[linear-gradient(135deg,#1e293b,#334155)] text-white">
                                        <ImageIcon className="h-7 w-7" />
                                      </div>
                                    ) : (
                                      <div className="flex aspect-[1/0.9] items-center justify-center bg-slate-100 text-slate-700">
                                        <AttachmentIcon className="h-7 w-7" />
                                      </div>
                                    )}
                                    <div className="space-y-1 px-3 py-2">
                                      <p className="truncate text-xs font-medium text-slate-800">{attachment.name}</p>
                                      <p className="text-[11px] text-slate-500">{attachment.sizeLabel}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                        <div className={cn(
                          'flex items-center gap-2 px-1 text-xs',
                          message.sender === 'admin' ? 'justify-end text-slate-500' : 'justify-start text-slate-500',
                        )}>
                          <span>{message.timestamp}</span>
                          {message.sender === 'admin' ? formatMessageStatus(message.status) : null}
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
                        {attachment.kind === 'image' ? <ImageIcon className="h-3.5 w-3.5" /> : <File className="h-3.5 w-3.5" />}
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

                <div className="flex items-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-12 w-12 shrink-0 rounded-full border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileSelection}
                  />
                  <Textarea
                    value={draftMessage}
                    onChange={(event) => setDraftMessage(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    placeholder="Write a message"
                    className="min-h-[56px] resize-none rounded-[28px] border-white/10 bg-white/[0.04] px-5 py-4 text-white placeholder:text-slate-500"
                  />
                  <Button
                    type="button"
                    onClick={handleSendMessage}
                    className="h-12 w-12 shrink-0 rounded-full bg-[#070f11] text-white shadow-[0_12px_30px_rgba(0,0,0,0.3)] hover:bg-[#0b1418]"
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
              Send a system-wide announcement to every technician conversation at once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Textarea
              value={broadcastDraft}
              onChange={(event) => setBroadcastDraft(event.target.value)}
              placeholder="Write your announcement"
              className="min-h-[160px] border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500"
            />
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-400">
              Delivery notes: in-app badges update immediately, browser push can alert admins on other tabs, and unread email digest follows Settings preferences.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]" onClick={() => setBroadcastOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBroadcast} className="bg-[#2F8E92] hover:bg-[#267276]">
              Send Broadcast
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
