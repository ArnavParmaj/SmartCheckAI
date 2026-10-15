"""
Knowledge Base Module
Small synonym dictionary used by the local concept matcher so that common
abbreviations and alternate spellings count as covering a concept.
"""

from typing import Dict, List

SYNONYMS: Dict[str, List[str]] = {
    "mapreduce": ["map reduce", "map-reduce"],
    "hdfs": ["hadoop distributed file system"],
    "database": ["db"],
    "artificial intelligence": ["ai"],
    "machine learning": ["ml"],
}


def variants(term: str) -> List[str]:
    """Return the term plus any known synonyms, all lower-case."""
    term = term.lower().strip()
    out = [term]
    for key, alts in SYNONYMS.items():
        if term == key or term in alts:
            out.extend([key, *alts])
    return list(dict.fromkeys(out))
