# Claude Session Search

A TUI (Terminal User Interface) tool for searching and navigating Claude Code sessions.

## Features

- 🔍 Full-text fuzzy search across all Claude sessions
- 📂 Shows session directories and prioritizes closer directories
- 📊 Interactive search results with keyboard navigation
- 📄 Detailed view of session conversations
- 🚀 Launch sessions directly with `--dangerously-skip-permissions`

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
- **Type**: Search sessions
- **↑/↓**: Navigate through results
- **Enter**: View session details
- **Ctrl+C**: Exit

#### Detail View
- **↑/↓**: Scroll through messages
- **Enter**: Launch session (drops into Claude with current session)
- **Esc**: Back to search
- **Ctrl+C**: Exit

## How it works

The tool scans `~/.claude/projects/` for all session files, indexes their content, and provides a fuzzy search interface. Sessions from directories closer to your current working directory are prioritized in the results.

## License

MIT
