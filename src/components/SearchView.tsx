import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
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
	const [filteredSessions, setFilteredSessions] = useState<Session[]>(sessions);

	// Set up fuzzy search
	useEffect(() => {
		if (!query.trim()) {
			setFilteredSessions(sessions);
			setSelectedIndex(0);
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
		setFilteredSessions(results.map(r => r.item));
		setSelectedIndex(0);
	}, [query, sessions]);

	useInput((input, key) => {
		if (key.return) {
			if (filteredSessions.length > 0) {
				onSelectSession(filteredSessions[selectedIndex]);
			}
		} else if (key.upArrow) {
			setSelectedIndex(prev => Math.max(0, prev - 1));
		} else if (key.downArrow) {
			setSelectedIndex(prev => Math.min(filteredSessions.length - 1, prev + 1));
		} else if (key.backspace || key.delete) {
			setQuery(prev => prev.slice(0, -1));
		} else if (input && !key.ctrl && !key.meta) {
			setQuery(prev => prev + input);
		}
	});

	const displaySessions = filteredSessions.slice(0, 20); // Show max 20 results

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
		const parts = path.split('/');
		if (parts.length <= 2) return path;

		// Show last 2-3 parts
		const lastParts = parts.slice(-3).join('/');
		if (lastParts.length <= maxLength) return '.../' + lastParts;

		const lastTwo = parts.slice(-2).join('/');
		if (lastTwo.length <= maxLength) return '.../' + lastTwo;

		return '.../' + parts[parts.length - 1];
	};

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

			<Box marginBottom={1}>
				<Text dimColor>
					{filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''} found
				</Text>
			</Box>

			{/* Header row */}
			<Box marginBottom={0}>
				<Text dimColor bold>
					{'  MESSAGE'.padEnd(67)} {'DIRECTORY'.padEnd(28)} {'TIME'}
				</Text>
			</Box>

			<Box flexDirection="column">
				{displaySessions.map((session, index) => {
					const isSelected = index === selectedIndex;
					const firstMessagePreview = session.firstMessage.slice(0, 60).replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
					const shortDir = shortenPath(session.directory, 25);
					const relTime = getRelativeTime(session.timestamp);

					const messageCol = (firstMessagePreview + (firstMessagePreview.length < session.firstMessage.length ? '...' : '')).padEnd(65);
					const dirCol = shortDir.padEnd(28);
					const timeCol = relTime.padEnd(8);

					return (
						<Box key={session.id}>
							<Text backgroundColor={isSelected ? 'blue' : undefined} color={isSelected ? 'white' : undefined}>
								{isSelected ? '> ' : '  '}{messageCol} <Text dimColor={!isSelected}>{dirCol}</Text> <Text color={isSelected ? 'white' : 'yellow'}>{timeCol}</Text>
							</Text>
						</Box>
					);
				})}
			</Box>

			{displaySessions.length > 0 && (
				<Box marginTop={1} flexDirection="column">
					<Text dimColor>
						Full path: {displaySessions[selectedIndex].directory}
					</Text>
					<Text dimColor>
						Date: {displaySessions[selectedIndex].timestamp.toLocaleString()}
					</Text>
				</Box>
			)}

			<Box marginTop={1}>
				<Text dimColor>
					↑/↓: Navigate | Enter: View Details | Ctrl+C: Exit
				</Text>
			</Box>
		</Box>
	);
}
