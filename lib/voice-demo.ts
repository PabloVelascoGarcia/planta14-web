// Presentation data adapter; replace this boundary with Payload later.
import news from "./demo/data/news.json";
import authors from "./demo/data/authors.json";
import type { Article, Author } from "./mock-data";
export const voiceArticles = news as Article[];
export const voiceAuthors = authors as Author[];
