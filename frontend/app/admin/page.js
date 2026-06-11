"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

import AdminTabs from "../components/AdminTabs";
import Reveal from "../components/Reveal";
import ConfirmDialog from "../components/ConfirmDialog";
import { useAuth, authFetch, extractError } from "../lib/auth";

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return "—";
  }
}

export default function AdminUsersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const isAdmin = !!user?.is_staff;
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  // Gate the page: only signed-in staff may view it.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login?next=/admin");
    } else if (!user.is_staff) {
      router.replace("/");
    }
  }, [user, authLoading, router]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (query) params.set("search", query);
      const data = await authFetch(`/auth/admin/users/?${params.toString()}`);
      const results = data.results ?? data;
      setUsers(results);
      setCount(data.count ?? results.length);
    } catch (err) {
      setError(extractError(err.data, err.message));
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin, loadUsers]);

  async function patchUser(target, body) {
    setBusyId(target.id);
    setError(null);
    try {
      const updated = await authFetch(`/auth/admin/users/${target.id}/`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err) {
      setError(extractError(err.data, err.message));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    const target = toDelete;
    setToDelete(null);
    if (!target) return;
    setBusyId(target.id);
    setError(null);
    try {
      await authFetch(`/auth/admin/users/${target.id}/`, { method: "DELETE" });
      // Reload to keep pagination counts accurate.
      await loadUsers();
    } catch (err) {
      setError(extractError(err.data, err.message));
    } finally {
      setBusyId(null);
    }
  }

  function onSearchSubmit(e) {
    e.preventDefault();
    setPage(1);
    setQuery(search.trim());
  }

  if (authLoading || !user || !user.is_staff) return null;

  return (
    <>
      <main>
        <section className="features">
          <div className="container">
            <Reveal>
              <div className="section-head">
                <span className="eyebrow">Admin</span>
                <h2>Account management</h2>
                <p>Manage user accounts: search, activate or deactivate, grant or revoke admin access, and remove accounts.</p>
              </div>
            </Reveal>

            <AdminTabs />

            <form onSubmit={onSearchSubmit} className="admin-search" style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", maxWidth: 480 }}>
              <input
                type="search"
                placeholder="Search by username, email, or name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: 1 }}
                aria-label="Search users"
              />
              <button type="submit" className="btn btn-ghost">Search</button>
            </form>

            {error && <p className="auth-error" role="alert">{error}</p>}

            {loading ? (
              <p>Loading users…</p>
            ) : users.length === 0 ? (
              <p>No users found.</p>
            ) : (
              <div className="admin-table-wrap" style={{ overflowX: "auto" }}>
                <table className="admin-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "0.6rem" }}>User</th>
                      <th style={{ textAlign: "left", padding: "0.6rem" }}>Email</th>
                      <th style={{ textAlign: "left", padding: "0.6rem" }}>Joined</th>
                      <th style={{ textAlign: "left", padding: "0.6rem" }}>Status</th>
                      <th style={{ textAlign: "right", padding: "0.6rem" }}>Controls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const isSelf = u.id === user.id;
                      const busy = busyId === u.id;
                      const lockedSuper = u.is_superuser && !user.is_superuser;
                      const disabled = busy || isSelf || lockedSuper;
                      const fullName = [u.first_name, u.last_name].filter(Boolean).join(" ");
                      return (
                        <tr key={u.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
                          <td style={{ padding: "0.6rem" }}>
                            <strong>{u.username}</strong>
                            {fullName && <div style={{ fontSize: "0.85em", opacity: 0.7 }}>{fullName}</div>}
                            {isSelf && <span style={{ fontSize: "0.8em", opacity: 0.6 }}> (you)</span>}
                          </td>
                          <td style={{ padding: "0.6rem" }}>{u.email || "—"}</td>
                          <td style={{ padding: "0.6rem" }}>{formatDate(u.date_joined)}</td>
                          <td style={{ padding: "0.6rem" }}>
                            <span className={u.is_active ? "product-stock" : "product-stock out"}>
                              {u.is_active ? "Active" : "Inactive"}
                            </span>
                            {u.is_superuser ? (
                              <span style={{ marginLeft: 6 }}>· Superuser</span>
                            ) : u.is_staff ? (
                              <span style={{ marginLeft: 6 }}>· Admin</span>
                            ) : null}
                          </td>
                          <td style={{ padding: "0.6rem", textAlign: "right", whiteSpace: "nowrap" }}>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              disabled={disabled}
                              onClick={() => patchUser(u, { is_active: !u.is_active })}
                            >
                              {u.is_active ? "Deactivate" : "Activate"}
                            </button>{" "}
                            <button
                              type="button"
                              className="btn btn-ghost"
                              disabled={disabled}
                              onClick={() => patchUser(u, { is_staff: !u.is_staff })}
                            >
                              {u.is_staff ? "Revoke admin" : "Make admin"}
                            </button>{" "}
                            <button
                              type="button"
                              className="btn btn-danger"
                              disabled={disabled}
                              onClick={() => setToDelete(u)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {totalPages > 1 && (
              <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginTop: "1.5rem" }}>
                <button type="button" className="btn btn-ghost" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </button>
                <span>Page {page} of {totalPages}</span>
                <button type="button" className="btn btn-ghost" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
                  Next
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete user?"
        message={toDelete ? `Permanently delete "${toDelete.username}"? This cannot be undone.` : ""}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
