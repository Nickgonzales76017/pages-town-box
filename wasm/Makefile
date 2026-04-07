# ── Bonfyre WASM Builds ──────────────────────────────────────────────────────
#
# Compiles light Bonfyre binaries to WebAssembly for client-side processing.
# Currently: bonfyre-brief (pure C, no external deps)
#
# Requirements: Emscripten (emcc)
#   brew install emscripten   # macOS
#   apt install emscripten    # Ubuntu

EMCC       ?= emcc
WASM_FLAGS  = -O2 -s WASM=1 -s MODULARIZE=1 \
              -s EXPORT_NAME='BonfyreBrief' \
              -s EXPORTED_FUNCTIONS='["_brief_process","_malloc","_free"]' \
              -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","UTF8ToString","stringToUTF8","lengthBytesUTF8"]' \
              -s ALLOW_MEMORY_GROWTH=1 \
              -s TOTAL_MEMORY=2097152 \
              -s NO_EXIT_RUNTIME=1
OUT_DIR    = ../site/wasm

.PHONY: all clean test

all: $(OUT_DIR)/bonfyre-brief.js $(OUT_DIR)/bonfyre-brief.wasm

$(OUT_DIR)/bonfyre-brief.js $(OUT_DIR)/bonfyre-brief.wasm: brief.c
	@mkdir -p $(OUT_DIR)
	$(EMCC) $(WASM_FLAGS) -o $(OUT_DIR)/bonfyre-brief.js brief.c
	@echo "Built: bonfyre-brief.wasm ($(shell wc -c < $(OUT_DIR)/bonfyre-brief.wasm | tr -d ' ') bytes)"

# Native test build (for development without emcc)
test: brief.c
	cc -std=c11 -O2 -Wall -Wextra -o brief-test brief.c
	@echo "=== Test 1: basic transcript ==="
	./brief-test "The kitchen is backed up. We need to restock the fridge. Table 5 has been waiting 30 minutes. The new server should check on table 12. The fryer needs to be cleaned before close."
	@echo ""
	@echo "=== Test 2: urgent ==="
	./brief-test "Heads up the walk-in cooler is broken. We called the repair guy, he should arrive by 8pm. Must keep the door closed. The ice machine is also running low, need to order more bags tomorrow."
	@rm -f brief-test

clean:
	rm -f $(OUT_DIR)/bonfyre-brief.js $(OUT_DIR)/bonfyre-brief.wasm brief-test
