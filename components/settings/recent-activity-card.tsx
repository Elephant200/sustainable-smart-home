'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AuditLog {
  id: string;
  action: string;
  device_id: string | null;
  actor_ip: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  'device.create': 'Device added',
  'device.update': 'Device updated',
  'device.delete': 'Device removed',
  'credential.write': 'Credentials saved',
  'oauth.connect': 'Provider connected',
  'oauth.disconnect': 'Provider disconnected',
  'location.update': 'Location updated',
};

const ACTION_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  'device.create': 'default',
  'device.update': 'secondary',
  'device.delete': 'destructive',
  'credential.write': 'secondary',
  'oauth.connect': 'default',
  'oauth.disconnect': 'destructive',
  'location.update': 'outline',
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatMeta(log: AuditLog): string {
  const m = log.metadata;
  const parts: string[] = [];
  if (m.name && typeof m.name === 'string') parts.push(m.name);
  if (m.type && typeof m.type === 'string') parts.push(m.type.replace('_', ' '));
  if (m.provider_type && typeof m.provider_type === 'string' && m.provider_type !== 'simulated') {
    parts.push(m.provider_type);
  }
  if (m.city && m.state) parts.push(`${m.city}, ${m.state}`);
  return parts.join(' · ');
}

export function RecentActivityCard() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/audit-log?limit=20')
      .then((r) => r.json())
      .then((data) => {
        setLogs(data.logs ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError('Could not load activity');
        setLoading(false);
      });
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Account and device changes from the past 30 days</CardDescription>
      </CardHeader>
      <CardContent>
        {loading && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        {!loading && !error && logs.length === 0 && (
          <p className="text-sm text-muted-foreground">No recent activity.</p>
        )}
        {!loading && !error && logs.length > 0 && (
          <ul className="space-y-3">
            {logs.map((log) => (
              <li key={log.id} className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={ACTION_VARIANTS[log.action] ?? 'outline'} className="text-xs shrink-0">
                      {ACTION_LABELS[log.action] ?? log.action}
                    </Badge>
                    {formatMeta(log) && (
                      <span className="text-sm text-muted-foreground truncate">
                        {formatMeta(log)}
                      </span>
                    )}
                  </div>
                  {log.actor_ip && log.actor_ip !== 'unknown' && (
                    <p className="text-xs text-muted-foreground mt-0.5">IP: {log.actor_ip}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  {formatRelativeTime(log.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
