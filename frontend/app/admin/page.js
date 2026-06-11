"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

  const debounceRef = useRef(null);
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      setQuery(search.trim());
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

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

            <div className="admin-search">
              <input
                type="search"
                placeholder="Search by username, email, or name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search users"
              />
            </div>

            {error && <p className="auth-error" role="alert">{error}</p>}

            <div className="admin-content">
            {loading ? (
              <p>Loading users…</p>
            ) : users.length === 0 ? (
              <div className="admin-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/>
                </svg>
                <p>No users found.</p>
              </div>
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
            </div>}

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
