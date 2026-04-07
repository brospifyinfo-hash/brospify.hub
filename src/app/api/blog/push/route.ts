import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey } from "@/lib/sheets";
import { shopifyFetch } from "@/lib/shopify";

export const dynamic = "force-dynamic";

interface BlogsResponse {
  blogs: { id: number; title: string }[];
}

interface ArticleResponse {
  article: {
    id: number;
    title: string;
    handle: string;
    published_at: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.lizenzschluessel) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde || !kunde.shopifyToken || !kunde.shopDomain) {
      return NextResponse.json(
        { error: "Shop nicht verbunden. Bitte verbinde deinen Shop unter Einstellungen." },
        { status: 400 }
      );
    }

    const domain = kunde.shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const token = kunde.shopifyToken;

    const { title, body_html, tags, seo_title, seo_description, blogId } = await req.json();

    if (!title || !body_html) {
      return NextResponse.json({ error: "Titel und Inhalt erforderlich." }, { status: 400 });
    }

    // If no blogId provided, get the default blog
    let targetBlogId = blogId;
    if (!targetBlogId) {
      const blogsData = await shopifyFetch<BlogsResponse>({
        domain,
        token,
        path: "/blogs.json",
      });

      if (!blogsData.blogs || blogsData.blogs.length === 0) {
        return NextResponse.json(
          { error: "Kein Blog im Shop gefunden. Bitte erstelle zuerst einen Blog in Shopify." },
          { status: 400 }
        );
      }
      targetBlogId = blogsData.blogs[0].id;
    }

    // Create the article with full HTML including images
    const articleData = await shopifyFetch<ArticleResponse>({
      domain,
      token,
      path: `/blogs/${targetBlogId}/articles.json`,
      method: "POST",
      body: {
        article: {
          title,
          body_html,
          tags: tags || "",
          published: true,
          metafields_global_title_tag: seo_title || title,
          metafields_global_description_tag: seo_description || "",
        },
      },
    });

    return NextResponse.json({
      success: true,
      article: {
        id: articleData.article.id,
        title: articleData.article.title,
        handle: articleData.article.handle,
        url: `https://${domain}/blogs/news/${articleData.article.handle}`,
      },
    });
  } catch (error) {
    console.error("[Blog Push] Error:", error);
    const message = error instanceof Error ? error.message : "Fehler beim Veröffentlichen.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
