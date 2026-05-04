import { ClipboardList } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function IntakeQueuePage() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
            Intake Queue
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Intake records that are not yet converted to dispatch jobs will appear here.
        </CardContent>
      </Card>
    </div>
  );
}
