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

	return (
		<Box flexDirection="column" padding={1}>
			<Box marginBottom={1}>
				<Text bold>Claude Session Search</Text>
			</Box>

			<Box marginBottom={1}>
				<Text>Search: </Text>
				<Text color="cyan">{query}</Text>
				<Text color="gray">_</Text>
			</Box>

			<Box marginBottom={1}>
				<Text dimColor>
					{filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''} found
				</Text>
			</Box>

			<Box flexDirection="column">
				{displaySessions.map((session, index) => {
					const isSelected = index === selectedIndex;
					const firstMessagePreview = session.firstMessage.slice(0, 80).replace(/\n/g, ' ');
					const relativeDir = session.directory;

					return (
						<Box key={session.id} marginBottom={0}>
							<Text backgroundColor={isSelected ? 'blue' : undefined} color={isSelected ? 'white' : undefined}>
								{isSelected ? '> ' : '  '}
								<Text bold>{firstMessagePreview}</Text>
								{firstMessagePreview.length < session.firstMessage.length && '...'}
							</Text>
						</Box>
					);
				})}
			</Box>

			{displaySessions.length > 0 && (
				<Box marginTop={1} flexDirection="column">
					<Text dimColor>
						Directory: {displaySessions[selectedIndex].directory}
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
