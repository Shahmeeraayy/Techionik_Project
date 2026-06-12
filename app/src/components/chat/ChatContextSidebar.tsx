import { ChatContextPanel } from '@/components/chat/ChatContextPanel';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import type { BackendChatConversation, BackendChatMessage } from '@/lib/backend-api';

type ViewerRole = 'admin' | 'technician';

type ChatContextSidebarProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: BackendChatConversation | null;
  messages: BackendChatMessage[];
  token: string;
  viewerRole: ViewerRole;
  currentUserName?: string | null;
  canUpload: boolean;
  onUploadFiles: () => void;
};

export function ChatContextSidebar({
  open,
  onOpenChange,
  conversation,
  messages,
  token,
  viewerRole,
  currentUserName,
  canUpload,
  onUploadFiles,
}: ChatContextSidebarProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[min(100vw-0.75rem,28rem)] border-l border-white/10 bg-[#07111f] p-3 text-slate-100 sm:max-w-[28rem] lg:max-w-[30rem]"
      >
        <div className="flex h-full min-h-0 flex-col pt-8">
          <ChatContextPanel
            conversation={conversation}
            messages={messages}
            token={token}
            viewerRole={viewerRole}
            currentUserName={currentUserName}
            canUpload={canUpload}
            onUploadFiles={onUploadFiles}
            className="min-h-0 flex-1"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
