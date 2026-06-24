import Link from "next/link";
import { notFound } from "next/navigation";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { posts, getAllSlugs } from "../../../blog/posts";

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const p = await params;
  const post = posts.find((post) => post.slug === p.slug);
  if (!post) return {};
  return {
    title: `${post.title} — Cartivo Blog`,
    description: post.excerpt,
  };
}

export default async function BlogPostPage({ params }) {
  const p = await params;
  const post = posts.find((post) => post.slug === p.slug);
  if (!post) notFound();

  const rawHtml = marked(post.content, { async: false });
  const html = sanitizeHtml(rawHtml, {
    // Only allow tags that markdown-rendered content produces.
    // Intentionally excludes div, span, nav, iframe, form, script, style,
    // and other non-markdown elements as defense-in-depth against XSS.
    allowedTags: [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "a", "ul", "ol", "li",
      "em", "strong", "code", "pre",
      "blockquote", "hr", "br",
      "img",
      "table", "thead", "tbody", "tr", "th", "td",
      "del", "s", "ins",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      th: ["align"],
      td: ["align"],
      code: ["class"],
      "*": ["class"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
  });

  return (
    <main>
      <article className="features blog-post">
        <div className="container blog-post-container">
          <div className="blog-post-head">
            <Link href="/blog" className="blog-post-back">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
              </svg>
              Back to blog
            </Link>
            <div className="blog-post-meta">
              <time dateTime={post.date}>
                {new Date(post.date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
              <span> · </span>
              <span>{post.author}</span>
              {post.tags?.length > 0 && (
                <span className="blog-card-tags">
                  {post.tags.map((t) => (
                    <span key={t} className="tag">{t}</span>
                  ))}
                </span>
              )}
            </div>
            <h1>{post.title}</h1>
            <p className="blog-post-excerpt">{post.excerpt}</p>
          </div>

          <div
            className="blog-post-content"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </article>
    </main>
  );
}
