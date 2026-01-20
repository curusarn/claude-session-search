# Claude Session Search

A TUI (Terminal User Interface) tool for searching and navigating Claude Code sessions.

## Features

- 🔍 Full-text fuzzy search across all Claude sessions
- 📂 Shows session directories and prioritizes closer directories
- 📊 Interactive search results with keyboard navigation
- 📄 Detailed view of session conversations
- 🚀 Launch sessions directly with `--dangerously-skip-permissions`
- 📐 Responsive to terminal size - automatically adjusts display
- 🧹 Smart filtering - removes warmup sessions and system messages
- 📈 Message counts - see conversation length at a glance
- ⌨️ Vim-style keybindings (hjkl, Ctrl+U/D, gg/G)

## Installation

```bash
npm install -g claude-session-search
```

Or run locally:

```bash
npm install
npm run build
npm start
```

## Usage

Simply run:

```bash
claude-sessions
```

### Keyboard Shortcuts

#### Search View
- **Type**: Search sessions (fuzzy search on message content and directory)
- **↑/↓ or Ctrl+K/J**: Navigate through results
- **Ctrl+U/D**: Half-page up/down
- **Ctrl+G / Shift+G**: Jump to top/bottom
- **Ctrl+W**: Delete last word in search
- **Backspace**: Delete last character
- **Enter**: View session details
- **Ctrl+C**: Exit

#### Detail View
- **↑/↓ or Ctrl+K/J**: Scroll through messages
- **Ctrl+U/D**: Half-page up/down
- **Ctrl+G / Shift+G**: Jump to top/bottom
- **Enter**: Launch session (drops into Claude with current session)
- **Esc**: Back to search
- **Ctrl+C**: Exit

## How it works

The tool scans `~/.claude/projects/` for all session files, indexes their content, and provides a fuzzy search interface.

### Smart Scoring Algorithm

Results are ranked using a combined score that considers three factors:
- **Search relevance (70%)**: How well the content matches your query
- **Directory proximity (20%)**: Distance from your current working directory
- **Recency (10%)**: How recent the session is

This ensures the most relevant results appear first, with nearby and recent sessions getting a slight boost.

### Output Columns

- **MESSAGE**: First message from the session (truncated to fit)
- **MSGS**: Number of conversation messages in the session
- **DIRECTORY**: Shortened directory path (last 2-3 segments)
- **TIME**: Relative time (e.g., "2d ago", "3h ago")

### Filtering

System messages like "Warmup", "claim", and command invocations are automatically filtered out.

## License

MIT
