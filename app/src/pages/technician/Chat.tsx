import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  File,
  Image as ImageIcon,
  MessageSquareText,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  Shield,
  X,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import TechnicianBottomNav from '@/components/common/technician-bottom-nav';
import {
  fetchAdminChatMessages,
  fetchTechnicianChatMessages,
  getStoredAdminToken,
  getStoredTechnicianToken,
  markTechnicianChatRead,
  sendTechnicianChatMessage,
  type BackendChatAttachment,
  type BackendChatMessage,
} from '@/lib/backend-api';

async function fileToAttachment(file: File): Promise<BackendChatAttachment> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });

  return {
    id: `${file.name}-${file.size}-${Date.now()}`,
    name: file.name,
    mime_type: file.type || 'application/octet-stream',
    size_bytes: file.size,
    data_url: dataUrl,
  };
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

function AttachmentCard({ attachment }: { attachment: BackendChatAttachment }) {
  const sizeLabel = attachment.size_bytes >= 1024 * 1024
    ? `${(attachment.size_bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(attachment.size_bytes / 1024))} KB`;

  return (
    <a
      href={attachment.data_url}
      target="_blank"
      rel="noreferrer"
      className="overflow-hidden rounded-2xl border border-black/10 bg-white/95"
    >
      {attachment.mime_type.startsWith('image/') ? (
        <div className="aspect-[1/0.9] overflow-hidden bg-slate-950">
          <img src={attachment.data_url} alt={attachment.name} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="flex aspect-[1/0.9] items-center justify-center bg-slate-100 text-slate-700">
          <File className="h-7 w-7" />
        </div>
      )}
      <div className="space-y-1 px-3 py-2">
        <p className="truncate text-xs font-medium text-slate-800">{attachment.name}</p>
        <p className="text-[11px] text-slate-500">{sizeLabel}</p>
      </div>
    </a>
  );
}

export default function TechnicianChatPage() {
  const { techId: previewTechId } = useParams();
  const navigate = useNavigate();
  const isPreviewMode = Boolean(previewTechId);
  const routeBase = isPreviewMode ? `/admin/tech-preview/${previewTechId}` : '/tech';
  const [messages, setMessages] = useState<BackendChatMessage[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [draftMessage, setDraftMessage] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<BackendChatAttachment[]>([]);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());

  const visibleMessages = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    if (!query) return messages;
    return messages.filter((message) => (
      (message.text || '').toLowerCase().includes(query)
      || message.attachments.some((attachment) => attachment.name.toLowerCase().includes(query))
    ));
  }, [historySearch, messages]);

  const fetchThread = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const thread = isPreviewMode
        ? await fetchAdminChatMessages(getStoredAdminToken() || '', previewTechId as string)
        : await fetchTechnicianChatMessages(getStoredTechnicianToken() || '');
      setMessages(thread);

      const nextIds = new Set(thread.map((message) => message.id));
      const incoming = thread.filter((message) => message.sender_role === 'admin' && !seenMessageIdsRef.current.has(message.id));
      if (incoming.length > 0 && seenMessageIdsRef.current.size > 0) {
        const latest = incoming[incoming.length - 1];
        if (typeof document !== 'undefined' && document.hidden && notificationEnabled && 'Notification' in window) {
          new Notification('Admin Dispatch', {
            body: latest.text || 'New attachment received',
          });
        } else {
          toast.message('New admin message', {
            description: latest.text || latest.attachments[0]?.name || 'Attachment received',
          });
        }
      }

      seenMessageIdsRef.current = nextIds;
      if (!isPreviewMode) {
        const token = getStoredTechnicianToken();
        if (token) {
          await markTechnicianChatRead(token);
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load chat history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchThread();
  }, [isPreviewMode, previewTechId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages.length]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void fetchThread(true);
    }, 3000);
    const onFocus = () => { void fetchThread(true); };
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
    };
  }, [isPreviewMode, notificationEnabled, previewTechId]);

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
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} exceeds the 10MB limit.`);
        continue;
      }
      if (!(file.type.startsWith('image/') || file.type === 'application/pdf')) {
        toast.error(`${file.name} must be an image or PDF file.`);
        continue;
      }
      nextAttachments.push(await fileToAttachment(file));
    }
    setPendingAttachments((prev) => [...prev, ...nextAttachments]);
    event.target.value = '';
  };

  const handleSend = async () => {
    if (isPreviewMode) return;
    const token = getStoredTechnicianToken();
    const content = draftMessage.trim();
    if (!token || (!content && pendingAttachments.length === 0)) return;

    try {
      const sent = await sendTechnicianChatMessage(token, {
        text: content || undefined,
        attachments: pendingAttachments,
      });
      setMessages((prev) => [...prev, sent]);
      seenMessageIdsRef.current.add(sent.id);
      setDraftMessage('');
      setPendingAttachments([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send message.');
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-100">
                  <MessageSquareText className="h-3.5 w-3.5" />
                  Technician Chat
                </div>
                <h1 className="mt-5 text-[clamp(2rem,3.4vw,3.15rem)] font-semibold leading-[0.94] tracking-[-0.07em] text-white">
                  Direct dispatch
                  <br />
                  messaging with admin.
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-[15px]">
                  Real persisted messages between field technicians and the admin team, with delivery and read states built into the platform.
                </p>
                {isPreviewMode ? (
                  <p className="mt-3 text-xs font-medium text-amber-300">Preview mode is read-only for technician chat.</p>
                ) : null}
              </div>
              <div className="flex items-center gap-3 self-start lg:self-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEnableNotifications}
                  className="h-11 gap-2 rounded-2xl border-white/10 bg-white/[0.03] px-4 text-slate-100 hover:bg-white/[0.08]"
                >
                  <Bell className="h-4 w-4" />
                  {notificationEnabled ? 'Notifications On' : 'Enable Alerts'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void fetchThread()}
                  className="h-11 gap-2 rounded-2xl border border-white/12 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(8,12,20,0.98))] px-4 text-slate-100 shadow-[0_14px_34px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.055)] hover:bg-[linear-gradient(180deg,rgba(24,38,64,0.98),rgba(12,20,34,0.98))] hover:text-white disabled:border-white/10 disabled:bg-[linear-gradient(180deg,rgba(24,34,52,0.88),rgba(12,20,34,0.88))] disabled:text-slate-400 disabled:opacity-100"
                  disabled={loading}
                >
                  <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                  Refresh
                </Button>
              </div>
            </div>
          </section>

          <Card className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.96),rgba(6,17,29,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="border-b border-white/8 p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-cyan-200" />
                    <h2 className="text-xl font-semibold tracking-[-0.04em] text-white">Admin Dispatch</h2>
                  </div>
                  <p className="text-sm text-slate-400">Use this channel for updates, clarifications, and job support without leaving the technician portal.</p>
                </div>
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

            <div className="grid min-h-[760px] grid-rows-[1fr_auto] bg-[linear-gradient(180deg,rgba(238,247,248,0.03),rgba(255,255,255,0.01))]">
              <ScrollArea className="h-full">
                <div className="space-y-4 px-5 py-6">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={index}
                        className={cn(
                          'h-16 w-[72%] animate-pulse rounded-[24px] bg-white/[0.05]',
                          index % 2 === 0 ? 'ml-0' : 'ml-auto',
                        )}
                      />
                    ))
                  ) : visibleMessages.length === 0 ? (
                    <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-white/[0.05]">
                        <MessageSquareText className="h-10 w-10 text-slate-500" />
                      </div>
                      <h3 className="text-xl font-semibold text-white">No messages yet</h3>
                      <p className="mt-2 max-w-md text-sm leading-7 text-slate-400">
                        Start a real conversation with the admin team here. Messages persist and stay synced after refresh.
                      </p>
                    </div>
                  ) : visibleMessages.map((message) => (
                    <div
                      key={message.id}
                      className={cn('flex', message.sender_role === 'technician' ? 'justify-end' : 'justify-start')}
                    >
                      <div className="max-w-[80%] space-y-2">
                        <div
                          className={cn(
                            'rounded-[24px] border px-4 py-3 shadow-[0_10px_25px_rgba(0,0,0,0.14)]',
                            message.sender_role === 'technician'
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
                              message.attachments.length >= 3 ? 'grid-cols-3' : 'grid-cols-2',
                            )}>
                              {message.attachments.map((attachment) => (
                                <AttachmentCard key={attachment.id} attachment={attachment} />
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

              <div className="border-t border-white/8 bg-[rgba(6,17,29,0.9)] p-5">
                {pendingAttachments.length > 0 ? (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {pendingAttachments.map((attachment) => (
                      <div key={attachment.id} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-200">
                        {attachment.mime_type.startsWith('image/') ? <ImageIcon className="h-3.5 w-3.5" /> : <File className="h-3.5 w-3.5" />}
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
                    disabled={isPreviewMode}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => void handleFileSelection(event)}
                  />
                  <Textarea
                    value={draftMessage}
                    onChange={(event) => setDraftMessage(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isPreviewMode ? 'Preview mode is read-only' : 'Write a message'}
                    className="min-h-[56px] resize-none rounded-[28px] border-white/10 bg-white/[0.04] px-5 py-4 text-white placeholder:text-slate-500"
                    disabled={isPreviewMode}
                  />
                  <Button
                    type="button"
                    onClick={() => void handleSend()}
                    className="h-12 w-12 shrink-0 rounded-full bg-[#070f11] text-white shadow-[0_12px_30px_rgba(0,0,0,0.3)] hover:bg-[#0b1418]"
                    disabled={isPreviewMode}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <TechnicianBottomNav activeTab="chat" routeBase={routeBase} />
    </div>
  );
}
