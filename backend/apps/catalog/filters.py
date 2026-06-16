from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank, TrigramSimilarity
from django.db import connection
from django.db.models import Q
from rest_framework.filters import BaseFilterBackend


class PostgresSearchFilter(BaseFilterBackend):
    """Product search backend with graceful cross-database degradation.

    On PostgreSQL it uses full-text search (stemming + weighted fields) and
    trigram similarity for typo tolerance, ranked by relevance.

    On any other backend (e.g. SQLite, used for quick local/test runs) the
    Postgres-only SQL functions ``to_tsvector`` and ``SIMILARITY`` don't exist
    and would raise an OperationalError (500). There we fall back to a plain
    case-insensitive substring match so ``?search=`` keeps working everywhere.
    """

    def filter_queryset(self, request, queryset, view):
        search_query = request.query_params.get("search", "").strip()
        if not search_query:
            return queryset

        # connection.vendor reflects the configured engine ("postgresql",
        # "sqlite", ...) without needing an open connection.
        if connection.vendor != "postgresql":
            return self._fallback_search(queryset, search_query)

        return self._postgres_search(queryset, search_query)

    def _fallback_search(self, queryset, search_query):
        """Case-insensitive substring match for non-Postgres backends.

        No stemming or typo tolerance — those require PostgreSQL — but it never
        errors and covers exact/substring matches on name, SKU and description.
        """
        return queryset.filter(
            Q(name__icontains=search_query)
            | Q(sku__icontains=search_query)
            | Q(description__icontains=search_query)
        ).order_by("-created_at", "id")

    def _postgres_search(self, queryset, search_query):
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
