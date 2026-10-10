"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { AdminPage } from "@/components/admin/AdminShell";
import { Empty, ErrorNote, Loading } from "@/components/admin/parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { num, useAdminData, type AdminUser, type Paged } from "@/lib/admin";
import { timeAgo } from "@/lib/bins";

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const users = useAdminData<Paged<AdminUser>>(`/admin/users?page=${page}&pageSize=25`);
  const data = users.data;

  return (
    <AdminPage title="Users" description="Everyone who has signed in, newest first, with what they've added and reported.">
      <ErrorNote error={users.error} />
      {!data ? (
        <Loading className="h-96" />
      ) : !data.items.length ? (
        <Empty>No users yet.</Empty>
      ) : (
        <div className={`overflow-hidden rounded-2xl border bg-card transition-opacity ${users.loading ? "opacity-60" : ""}`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">User</TableHead>
                <TableHead className="text-right">Bins added</TableHead>
                <TableHead className="hidden text-right sm:table-cell">On the map</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Missing reports</TableHead>
                <TableHead className="hidden md:table-cell">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="pl-4">
                    <span className="flex items-center gap-2">
                      <span className="max-w-64 truncate font-medium">{u.email ?? "No email"}</span>
                      {u.role === "ADMIN" && <Badge variant="secondary">Admin</Badge>}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{num(u.registrations)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{num(u.activeBins)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{num(u.missingReports)}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{timeAgo(u.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data && data.totalPages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {num(data.total)} users, page {data.page} of {data.totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="icon-lg" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeftIcon />
            </Button>
            <Button variant="secondary" size="icon-lg" aria-label="Next page" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRightIcon />
            </Button>
          </div>
        </nav>
      )}
    </AdminPage>
  );
}
