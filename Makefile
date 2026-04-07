BONFYRE_BIN ?= $(HOME)/.local/bin

.PHONY: setup build clean check

setup:
	@echo "Configuring git hooks…"
	git config core.hooksPath .githooks
	@echo "Verifying bonfyre binaries…"
	@for b in $(BONFYRE_BIN)/bonfyre-*; do echo "  ✓ $$(basename $$b)"; done
	@echo "Ready."

build:
	@echo "Running pipeline on input/ …"
	.githooks/post-commit

clean:
	rm -rf artifacts/*.json artifacts/*.md site/*.html

check:
	@echo "Checking binary availability…"
	@missing=0; \
	for b in bonfyre-emit bonfyre-transcribe bonfyre-brief bonfyre-tag; do \
	  command -v $$b >/dev/null 2>&1 || { echo "  ✗ $$b missing"; missing=1; }; \
	done; \
	[ $$missing -eq 0 ] && echo "All required binaries found."
