import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import Fuse from 'fuse.js';
import { Session, getAllText } from '../utils/sessionScanner.js';

interface SearchViewProps {
	sessions: Session[];
	onSelectSession: (session: Session) => void;
	initialQuery?: string;
}

export function SearchView({ sessions, onSelectSession, initialQuery = '' }: SearchViewProps) {
	const [query, setQuery] = useState(initialQuery);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [scrollOffset, setScrollOffset] = useState(0);
	const [filteredSessions, setFilteredSessions] = useState<Session[]>(sessions);
	const { stdout } = useStdout();

	// Set up fuzzy search with combined scoring
	useEffect(() => {
		if (!query.trim()) {
			setFilteredSessions(sessions);
			setSelectedIndex(0);
			setScrollOffset(0);
			return;
		}

		const fuse = new Fuse(sessions, {
			keys: [
				{ name: 'firstMessage', weight: 2 },
				{ name: 'directory', weight: 1 },
				{ name: 'cwd', weight: 1 },
			],
			threshold: 0.4,
			includeScore: true,
			getFn: (obj, path) => {
				if (path[0] === 'firstMessage') {
					return getAllText(obj as Session);
				}
				return (obj as any)[path[0]];
			},
		});

		const results = fuse.search(query);

		// Calculate combined score: search (70%) + distance (20%) + recency (10%)
		const now = Date.now();
		const maxDistance = Math.max(...sessions.map(s => s.distance || 0), 1);
		const maxAge = Math.max(...sessions.map(s => now - s.timestamp.getTime()), 1);

		const scoredResults = results.map(result => {
			const searchScore = result.score || 0; // 0 = perfect match, 1 = worst match
			const distanceScore = (result.item.distance || 0) / maxDistance; // 0 = same dir, 1 = farthest
			const ageScore = (now - result.item.timestamp.getTime()) / maxAge; // 0 = newest, 1 = oldest

			// Combined score (lower is better)
			const combinedScore = (searchScore * 0.7) + (distanceScore * 0.2) + (ageScore * 0.1);

			return { ...result, combinedScore };
		});

		// Sort by combined score
		scoredResults.sort((a, b) => a.combinedScore - b.combinedScore);

		setFilteredSessions(scoredResults.map(r => r.item));
		setSelectedIndex(0);
		setScrollOffset(0);
	}, [query, sessions]);

	// Ensure selectedIndex is always within bounds
	useEffect(() => {
		if (selectedIndex >= filteredSessions.length && filteredSessions.length > 0) {
			setSelectedIndex(filteredSessions.length - 1);
		}
	}, [filteredSessions, selectedIndex]);

	// Calculate available space for results
	const terminalHeight = stdout?.rows || 24;
	const terminalWidth = stdout?.columns || 120;
	const uiOverhead = 8; // Header, search box, status, footer, etc.
	const maxVisibleRows = Math.max(5, terminalHeight - uiOverhead);

	// Calculate responsive column widths with safety margin
	const minWidth = 80;
	const isNarrow = terminalWidth < 100;
	const safetyMargin = 5; // Extra buffer to prevent wrapping
	const fixedWidth = 2 + 1 + 6 + 1 + 1 + 8 + safetyMargin; // selector + spaces + msgCount + time + margin
	const availableWidth = Math.max(45, terminalWidth - fixedWidth);

	// Distribute available width between message and directory
	const messageWidth = isNarrow
		? Math.max(25, Math.floor(availableWidth * 0.65))
		: Math.max(35, Math.min(58, Math.floor(availableWidth * 0.65)));
	const dirWidth = Math.max(12, availableWidth - messageWidth);
	const msgCountWidth = 6;
	const timeWidth = 8;

	// Update scroll offset when selection changes
	useEffect(() => {
		if (selectedIndex < scrollOffset) {
			setScrollOffset(selectedIndex);
		} else if (selectedIndex >= scrollOffset + maxVisibleRows) {
			setScrollOffset(selectedIndex - maxVisibleRows + 1);
		}
	}, [selectedIndex, maxVisibleRows]);

	useInput((input, key) => {
		if (key.return) {
			if (filteredSessions.length > 0) {
				onSelectSession(filteredSessions[selectedIndex]);
			}
		} else if (key.upArrow || (key.ctrl && input === 'k')) {
			setSelectedIndex(prev => Math.max(0, prev - 1));
		} else if (key.downArrow || (key.ctrl && input === 'j')) {
			setSelectedIndex(prev => Math.min(filteredSessions.length - 1, prev + 1));
		} else if (key.pageUp || (key.ctrl && input === 'u')) {
			setSelectedIndex(prev => Math.max(0, prev - Math.floor(maxVisibleRows / 2)));
		} else if (key.pageDown || (key.ctrl && input === 'd')) {
			setSelectedIndex(prev => Math.min(filteredSessions.length - 1, prev + Math.floor(maxVisibleRows / 2)));
		} else if (key.ctrl && input === 'g') {
			setSelectedIndex(0);
		} else if (key.shift && input === 'G') {
			setSelectedIndex(filteredSessions.length - 1);
		} else if (key.backspace || key.delete) {
			setQuery(prev => prev.slice(0, -1));
		} else if (key.ctrl && input === 'w') {
			// Delete word
			setQuery(prev => prev.replace(/\s*\S+\s*$/, ''));
		} else if (input && !key.ctrl && !key.meta && !key.shift) {
			setQuery(prev => prev + input);
		} else if (key.shift && input && input.length === 1) {
			// Handle uppercase letters
			setQuery(prev => prev + input);
		}
	});

	const displaySessions = filteredSessions.slice(scrollOffset, scrollOffset + maxVisibleRows);

	// Helper function to get relative time
	const getRelativeTime = (date: Date): string => {
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
		if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
		return `${Math.floor(diffDays / 365)}y ago`;
	};

	// Helper function to shorten directory path
	const shortenPath = (path: string, maxLength: number = 25): string => {
		if (path.length <= maxLength) return path;
		const parts = path.split('/').filter(p => p);
		if (parts.length <= 2) return path;

		// Show last 2-3 parts
		const lastParts = parts.slice(-3).join('/');
		if (lastParts.length <= maxLength) return '.../' + lastParts;

		const lastTwo = parts.slice(-2).join('/');
		if (lastTwo.length <= maxLength) return '.../' + lastTwo;

		return '.../' + parts[parts.length - 1];
	};

	// Get message count for a session
	const getMessageCount = (session: Session): number => {
		return session.messages.filter(m => m.type === 'user' || m.type === 'assistant').length;
	};

	// Warn about very narrow terminals
	if (terminalWidth < 80) {
		return (
			<Box flexDirection="column" padding={1}>
				<Box marginBottom={1}>
					<Text bold color="yellow">Terminal too narrow</Text>
				</Box>
				<Box>
					<Text>
						Please resize your terminal to at least 80 columns wide.
						Current width: {terminalWidth} columns.
					</Text>
				</Box>
			</Box>
		);
	}

	if (filteredSessions.length === 0) {
		return (
			<Box flexDirection="column" padding={1}>
				<Box marginBottom={1}>
					<Text bold color="cyan">Claude Session Search</Text>
				</Box>

				<Box marginBottom={1}>
					<Text>Search: </Text>
					<Text color="yellow">{query}</Text>
					<Text color="gray">_</Text>
				</Box>

				<Box marginTop={1}>
					<Text color="red">No sessions found{query ? ' matching your search' : ''}.</Text>
				</Box>

				<Box marginTop={1}>
					<Text dimColor>
						Type to search | Ctrl+C: Exit
					</Text>
				</Box>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" padding={1} height={terminalHeight}>
			<Box marginBottom={1}>
				<Text bold color="cyan">Claude Session Search</Text>
				<Text> </Text>
				<Text dimColor>({filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''})</Text>
			</Box>

			<Box marginBottom={1}>
				<Text>Search: </Text>
				<Text color="yellow">{query || '(showing all)'}</Text>
				<Text color="gray">{query ? '_' : ''}</Text>
			</Box>

			{/* Header row */}
			<Box marginBottom={0}>
				<Text dimColor bold>
					{'  MESSAGE'.padEnd(messageWidth + 2)} {'MSGS'.padEnd(msgCountWidth)} {'DIRECTORY'.padEnd(dirWidth)} {'TIME'}
				</Text>
			</Box>

			<Box flexDirection="column" minHeight={maxVisibleRows}>
				{displaySessions.map((session, displayIndex) => {
					const actualIndex = scrollOffset + displayIndex;
					const isSelected = actualIndex === selectedIndex;
					const firstMessagePreview = session.firstMessage.slice(0, messageWidth - 5).replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
					const shortDir = shortenPath(session.directory, dirWidth - 2);
					const relTime = getRelativeTime(session.timestamp);
					const msgCount = getMessageCount(session);

					const messageCol = (firstMessagePreview + (firstMessagePreview.length < session.firstMessage.length ? '...' : '')).padEnd(messageWidth);
					const msgCountCol = msgCount.toString().padEnd(msgCountWidth);
					const dirCol = shortDir.padEnd(dirWidth);
					const timeCol = relTime.padEnd(timeWidth);

					return (
						<Box key={session.id} flexWrap="nowrap">
							<Text backgroundColor={isSelected ? 'blue' : undefined} color={isSelected ? 'white' : undefined} wrap="truncate-end">
								{isSelected ? '> ' : '  '}{messageCol} <Text dimColor={!isSelected}>{msgCountCol}</Text> <Text dimColor={!isSelected}>{dirCol}</Text> <Text color={isSelected ? 'white' : 'yellow'}>{timeCol}</Text>
							</Text>
						</Box>
					);
				})}
				{/* Fill empty space to clear old content */}
				{displaySessions.length < maxVisibleRows && Array.from({ length: maxVisibleRows - displaySessions.length }).map((_, i) => (
					<Box key={`empty-${i}`}>
						<Text> </Text>
					</Box>
				))}
			</Box>

			{displaySessions.length > 0 && filteredSessions[selectedIndex] && (
				<Box marginTop={1} flexDirection="column">
					<Box flexWrap="wrap">
						<Text dimColor>Full path: </Text>
						<Text color="green">{filteredSessions[selectedIndex].directory}</Text>
					</Box>
					<Box marginBottom={1} flexWrap="wrap">
						<Text dimColor>Date: </Text>
						<Text>{filteredSessions[selectedIndex].timestamp.toLocaleString()}</Text>
						<Text dimColor> • </Text>
						<Text>{getMessageCount(filteredSessions[selectedIndex])} messages</Text>
					</Box>
				</Box>
			)}

			{/* Scroll indicator */}
			{filteredSessions.length > maxVisibleRows && (
				<Box marginTop={1}>
					<Text dimColor>
						Showing {scrollOffset + 1}-{Math.min(scrollOffset + maxVisibleRows, filteredSessions.length)} of {filteredSessions.length}
					</Text>
				</Box>
			)}

			<Box marginTop={1}>
				<Text dimColor>
					↑/↓: Navigate | Ctrl+U/D: Half-page | g/G: Top/Bottom | Enter: Details | Ctrl+W: Delete word | Ctrl+C: Exit
				</Text>
			</Box>
		</Box>
	);
}
