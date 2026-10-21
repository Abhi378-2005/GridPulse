'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import type { AdminHouse, AdminUser, Notify } from './types';

interface Props {
  token: string;
  selfId: string;
  onNotify: Notify;
  onChanged: () => void;
}

const selectClass =
  'h-8 rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50';

export function UsersCard({ token, selfId, onNotify, onChanged }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [houses, setHouses] = useState<AdminHouse[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ users: AdminUser[]; houses: AdminHouse[] }>('/api/admin/users', token);
      setUsers(data.users);
      setHouses(data.houses);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setLoaded(true);
    }
  }, [token, onNotify]);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (user: AdminUser, change: { role?: 'user' | 'admin'; nodeId?: string | null }) => {
    setSavingId(user.id);
    try {
      await apiFetch(`/api/admin/users/${user.id}`, token, { method: 'PATCH', body: JSON.stringify(change) });
      onNotify(`Updated ${user.email}`, 'success');
      onChanged();
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      await load(); // Always re-sync, so a rejected change snaps the dropdown back
      setSavingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Users</CardTitle>
      </CardHeader>
      <CardContent>
        {!loaded ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : users.length === 0 ? (
          <p className="text-xs text-muted-foreground">No users yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">User</th>
                  <th className="pb-2 pr-3 font-medium">Role</th>
                  <th className="pb-2 font-medium">House</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map(u => {
                  const isSelf = u.id === selfId;
                  const saving = savingId === u.id;
                  return (
                    <tr key={u.id}>
                      <td className="py-2 pr-3">
                        <div className="font-medium">
                          {u.name}
                          {isSelf && <span className="ml-1.5 text-[10px] text-muted-foreground">(you)</span>}
                        </div>
                        <div className="text-muted-foreground">{u.email}</div>
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          className={selectClass}
                          value={u.role}
                          disabled={saving || isSelf}
                          title={isSelf ? 'You cannot change your own role' : undefined}
                          aria-label={`Role for ${u.email}`}
                          onChange={e => update(u, { role: e.target.value as 'user' | 'admin' })}
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="py-2">
                        <select
                          className={selectClass}
                          value={u.nodeId ?? ''}
                          disabled={saving}
                          aria-label={`House for ${u.email}`}
                          onChange={e => update(u, { nodeId: e.target.value || null })}
                        >
                          <option value="">No house</option>
                          {houses.map(h => {
                            const takenByOther = h.ownerId !== null && h.ownerId !== u.id;
                            return (
                              <option key={h.id} value={h.id} disabled={takenByOther}>
                                {h.emoji} {h.name}{takenByOther ? ' (taken)' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-3">
          Role and house changes apply immediately, even to people who are already logged in.
        </p>
      </CardContent>
    </Card>
  );
}
