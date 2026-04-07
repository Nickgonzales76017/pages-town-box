/*
 * bonfyre-brief WASM wrapper
 *
 * Extracts the core sentence-scoring and brief-generation logic from
 * BonfyreBrief/src/main.c for compilation to WebAssembly via Emscripten.
 *
 * No file I/O — operates on in-memory strings.
 * Exported: brief_process(const char *text) -> const char *markdown
 */
#include <ctype.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#define EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define EXPORT
#endif

#define MAX_SENTENCES 1024
#define MAX_LINE 8192
#define MAX_BULLETS 6
#define BRIEF_BUF_SIZE (64 * 1024)

typedef struct {
    char *text;
    int score;
    int is_action;
} Sentence;

/* ── Helpers ── */

static char *trim_copy(const char *src) {
    while (*src && isspace((unsigned char)*src)) src++;
    size_t len = strlen(src);
    while (len > 0 && isspace((unsigned char)src[len - 1])) len--;
    char *out = malloc(len + 1);
    if (!out) return NULL;
    memcpy(out, src, len);
    out[len] = '\0';
    return out;
}

static int contains_any(const char *text, const char *words[]) {
    for (int i = 0; words[i]; i++) {
        if (strstr(text, words[i])) return 1;
    }
    return 0;
}

static int sentence_score(const char *text) {
    static const char *summary_words[] = {
        "problem", "customer", "market", "revenue", "pricing", "workflow",
        "decision", "learned", "traction", "focus", "strategy", "validation",
        "founder", "operator", "pain", "channel", "segment",
        /* handoff-specific additions */
        "issue", "broken", "waiting", "check", "urgent", "left off",
        "handed off", "heads up", "watch out", "note", "important",
        NULL
    };
    static const char *action_words[] = {
        "should", "need to", "must", "next", "plan", "test", "focus", "send",
        "build", "validate", "launch", "review", "write", "ship",
        /* handoff actions */
        "check on", "follow up", "call back", "restock", "clean",
        "replace", "fix", "order", "tell", "remind", "ask",
        NULL
    };
    int score = 0;
    size_t len = strlen(text);
    if (len > 30) score += 1;
    if (len > 80) score += 1;
    if (contains_any(text, summary_words)) score += 3;
    if (contains_any(text, action_words)) score += 2;
    if (strchr(text, '$') || strstr(text, "percent")) score += 2;
    if (strstr(text, "I think") || strstr(text, "yeah") || strstr(text, "like")) score -= 2;
    return score;
}

static int is_action(const char *text) {
    static const char *action_words[] = {
        "should", "need to", "must", "next", "plan", "test", "focus", "send",
        "build", "validate", "launch", "review", "write", "ship",
        "check on", "follow up", "call back", "restock", "clean",
        "replace", "fix", "order", "tell", "remind", "ask",
        NULL
    };
    return contains_any(text, action_words);
}

static int cmp_desc(const void *a, const void *b) {
    return ((const Sentence *)b)->score - ((const Sentence *)a)->score;
}

static int split_sentences(const char *text, Sentence *out, int max) {
    int count = 0;
    const char *start = text;
    for (const char *p = text; ; p++) {
        if (*p == '.' || *p == '!' || *p == '?' || *p == '\n' || *p == '\0') {
            size_t len = (size_t)(p - start + (*p ? 1 : 0));
            if (len > 1 && count < max) {
                char buf[MAX_LINE];
                if (len >= sizeof(buf)) len = sizeof(buf) - 1;
                memcpy(buf, start, len);
                buf[len] = '\0';
                char *trimmed = trim_copy(buf);
                if (trimmed && trimmed[0]) {
                    out[count].text = trimmed;
                    out[count].score = sentence_score(trimmed);
                    out[count].is_action = is_action(trimmed);
                    count++;
                } else {
                    free(trimmed);
                }
            }
            if (*p == '\0') break;
            start = p + 1;
        }
    }
    return count;
}

/* ── Result buffer (static, returned to JS) ── */
static char result_buf[BRIEF_BUF_SIZE];

/*
 * brief_process — main WASM export
 *
 * Takes raw transcript text, returns a Markdown brief string.
 * The returned pointer is valid until the next call.
 */
EXPORT
const char *brief_process(const char *text) {
    if (!text || !text[0]) return "# Brief\n\n- No content to summarize.\n";

    Sentence sentences[MAX_SENTENCES] = {0};
    int count = split_sentences(text, sentences, MAX_SENTENCES);
    if (count == 0) return "# Brief\n\n- No sentences found.\n";

    /* Sort a copy by score for ranked extraction */
    Sentence ranked[MAX_SENTENCES];
    memcpy(ranked, sentences, sizeof(Sentence) * (size_t)count);
    qsort(ranked, (size_t)count, sizeof(Sentence), cmp_desc);

    /* Build brief in result buffer */
    int pos = 0;
    pos += snprintf(result_buf + pos, BRIEF_BUF_SIZE - (size_t)pos,
                    "# Shift Handoff Brief\n\n## Key Points\n");

    int summary_n = 0;
    for (int i = 0; i < count && summary_n < MAX_BULLETS; i++) {
        if (ranked[i].score < 2 || ranked[i].is_action) continue;
        pos += snprintf(result_buf + pos, BRIEF_BUF_SIZE - (size_t)pos,
                        "- %s\n", ranked[i].text);
        summary_n++;
    }
    if (!summary_n)
        pos += snprintf(result_buf + pos, BRIEF_BUF_SIZE - (size_t)pos,
                        "- No key points extracted.\n");

    pos += snprintf(result_buf + pos, BRIEF_BUF_SIZE - (size_t)pos,
                    "\n## Action Items\n");
    int action_n = 0;
    for (int i = 0; i < count && action_n < MAX_BULLETS; i++) {
        if (!ranked[i].is_action) continue;
        pos += snprintf(result_buf + pos, BRIEF_BUF_SIZE - (size_t)pos,
                        "- %s\n", ranked[i].text);
        action_n++;
    }
    if (!action_n)
        pos += snprintf(result_buf + pos, BRIEF_BUF_SIZE - (size_t)pos,
                        "- No action items detected.\n");

    pos += snprintf(result_buf + pos, BRIEF_BUF_SIZE - (size_t)pos,
                    "\n## Stats\n- Sentences: %d\n- Scored items: %d\n- Actions: %d\n",
                    count, summary_n, action_n);

    /* Cleanup */
    for (int i = 0; i < count; i++) free(sentences[i].text);

    return result_buf;
}

/* ── For non-WASM testing ── */
#ifndef __EMSCRIPTEN__
int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "Usage: brief-wasm-test <text>\n");
        return 1;
    }
    printf("%s\n", brief_process(argv[1]));
    return 0;
}
#endif
