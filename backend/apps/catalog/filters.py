from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank, TrigramSimilarity
from django.db.models import Q
from rest_framework.filters import BaseFilterBackend


class PostgresSearchFilter(BaseFilterBackend):
    """Advanced PostgreSQL Full-Text Search with Typo Tolerance and Relevance Ranking.

    Provides fuzzy matching (via trigram similarity), stemmed full-text search,
    and fallback substring matching for SKUs and short terms.
    """

    def filter_queryset(self, request, queryset, view):
        search_query = request.query_params.get("search", "").strip()
        if not search_query:
            return queryset

        # 1. Stemmed Full-Text Search Vector with weighted fields
        # Name is highest importance (A), SKU is medium (B), Description is lower (C)
        vector = (
            SearchVector("name", weight="A")
            + SearchVector("sku", weight="B")
            + SearchVector("description", weight="C")
        )
        query = SearchQuery(search_query)

        # 2. Fuzzy Matching (Trigram Similarity) on name for typo tolerance
        similarity = TrigramSimilarity("name", search_query)

        # Annotate rank and similarity
        queryset = queryset.annotate(
            rank=SearchRank(vector, query),
            similarity=similarity,
        )

        # Filter: match if FTS rank is high, trigram similarity is high,
        # or as a fallback, if name/SKU contains the query string (for short terms or exact SKUs)
        queryset = queryset.filter(
            Q(rank__gte=0.05)
            | Q(similarity__gt=0.15)
            | Q(name__icontains=search_query)
            | Q(sku__icontains=search_query)
        )

        # Order by FTS rank first, then trigram similarity, then newest first
        return queryset.order_by("-rank", "-similarity", "-created_at", "id")
