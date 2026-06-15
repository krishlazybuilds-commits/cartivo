import Link from "next/link";
import { posts } from "../../blog/posts";

export const metadata = {
  title: "Blog — Cartivo",
  description: "Style guides, sustainability tips, and stories from the Cartivo team.",
};

export default function BlogPage() {
  return (
    <main>
      <section className="features">
        <div className="container">
          <div className="section-head center">
            <span className="eyebrow">Blog</span>
            <h2>Stories &amp; ideas</h2>
            <p>Style guides, sustainability tips, and updates from the Cartivo team.</p>
          </div>

          <div className="blog-grid">
            {posts.map((post) => (
              <article key={post.slug} className="blog-card">
                <Link href={`/blog/${post.slug}`}>
                  <div className="blog-card-body">
                    <div className="blog-card-meta">
                      <time dateTime={post.date}>
                        {new Date(post.date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </time>
                      {post.tags?.length > 0 && (
                        <span className="blog-card-tags">
                          {post.tags.map((t) => (
                            <span key={t} className="tag">{t}</span>
                          ))}
                        </span>
                      )}
                    </div>
                    <h3>{post.title}</h3>
                    <p>{post.excerpt}</p>
                    <span className="blog-card-cta">
                      Read more
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
