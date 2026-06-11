"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

import { API_URL } from "../lib/api";
import { authFetch, useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import StarRating from "./StarRating";

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Interactive 1–5 star picker for the review form. */
function StarInput({ value, onChange }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div className="star-input" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star-input-btn${n <= active ? " on" : ""}`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          aria-pressed={value === n}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function ProductReviews({ productId }) {
  const { user } = useAuth();
  const toast = useToast();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/reviews/?product=${productId}`);
      const data = await res.json();
      setReviews(data.results ?? data);
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  const count = reviews.length;
  const avg = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;
  const alreadyReviewed = user && reviews.some((r) => r.username === user.username);

  async function submit(e) {
    e.preventDefault();
    if (rating < 1) {
      toast("Please pick a star rating", "info");
      return;
    }
    setSubmitting(true);
    try {
      await authFetch("/reviews/", {
        method: "POST",
        body: JSON.stringify({ product: productId, rating, title, body }),
      });
      toast("Thanks for your review!", "success");
      setRating(0);
      setTitle("");
      setBody("");
      await load();
    } catch (err) {
      toast(err.message || "Couldn't post your review", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="reviews" aria-label="Customer reviews">
      <div className="reviews-head">
        <h2>Reviews</h2>
        {count > 0 && <StarRating value={avg} count={count} size="1.15rem" />}
      </div>

      {/* Write-a-review form */}
      {user ? (
        alreadyReviewed ? (
          <p className="reviews-note">You&apos;ve already reviewed this product.</p>
        ) : (
          <form className="review-form" onSubmit={submit}>
            <StarInput value={rating} onChange={setRating} />
            <input
              type="text"
              className="input"
              placeholder="Title (optional)"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="input"
              placeholder="Share your thoughts (optional)"
              value={body}
              rows={3}
              onChange={(e) => setBody(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Posting…" : "Post review"}
            </button>
          </form>
        )
      ) : (
        <p className="reviews-note">
          <Link href="/login">Sign in</Link> to write a review.
        </p>
      )}

      {/* Review list */}
      {loading ? (
        <p className="reviews-note">Loading reviews…</p>
      ) : count === 0 ? (
        <p className="reviews-note">No reviews yet. Be the first to share your thoughts.</p>
      ) : (
        <ul className="review-list">
          {reviews.map((r) => (
            <li key={r.id} className="review-item">
              <div className="review-item-head">
                <StarRating value={r.rating} showCount={false} size="0.95rem" />
                <span className="review-author">{r.username}</span>
                <span className="review-date">{formatDate(r.created_at)}</span>
              </div>
              {r.title && <h4 className="review-title">{r.title}</h4>}
              {r.body && <p className="review-body">{r.body}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
