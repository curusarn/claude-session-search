import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Session } from '../utils/sessionScanner.js';
import { spawn } from 'child_process';

interface DetailViewProps {
	session: Session;
	onBack: () => void;
	onLaunch: (session: Session) => void;
}

export function DetailView({ session, onBack, onLaunch }: DetailViewProps) {
	const [scrollOffset, setScrollOffset] = useState(0);

	// Get user and assistant messages only (skip file-history-snapshot and other system messages)
	const conversationMessages = session.messages.filter(
		msg => msg.type === 'user' || msg.type === 'assistant'
	);

	const maxScroll = Math.max(0, conversationMessages.length - 10);

	useInput((input, key) => {
		if (key.escape) {
			onBack();
		} else if (key.return) {
			onLaunch(session);
		} else if (key.upArrow) {
			setScrollOffset(prev => Math.max(0, prev - 1));
		} else if (key.downArrow) {
			setScrollOffset(prev => Math.min(maxScroll, prev + 1));
		}
	});

	const visibleMessages = conversationMessages.slice(scrollOffset, scrollOffset + 10);

	return (
		<Box flexDirection="column" padding={1}>
			<Box marginBottom={1}>
				<Text bold color="cyan">Session Details</Text>
			</Box>

			<Box marginBottom={1} flexDirection="column">
				<Text>
					<Text bold>Directory: </Text>
					<Text color="green">{session.directory}</Text>
				</Text>
				<Text>
					<Text bold>Date: </Text>
					<Text>{session.timestamp.toLocaleString()}</Text>
				</Text>
				<Text>
					<Text bold>Session ID: </Text>
					<Text dimColor>{session.id}</Text>
				</Text>
				<Text>
					<Text bold>Messages: </Text>
					<Text>{conversationMessages.length}</Text>
				</Text>
			</Box>

			<Box marginBottom={1}>
				<Text bold>Conversation:</Text>
			</Box>

			<Box flexDirection="column" marginBottom={1}>
				{visibleMessages.map((msg, index) => {
					const role = msg.message?.role || msg.type;
					const content = msg.message?.content;
					let textContent = '';

					if (typeof content === 'string') {
						textContent = content;
					} else if (Array.isArray(content)) {
						textContent = content
							.map(item => {
								if ('text' in item) return item.text;
								if ('thinking' in item) return `[thinking: ${item.thinking?.slice(0, 100)}...]`;
								return '';
							})
							.filter(Boolean)
							.join(' ');
					}

					const preview = textContent.slice(0, 120).replace(/\n/g, ' ');
					const roleColor = role === 'user' ? 'yellow' : role === 'assistant' ? 'blue' : 'gray';

					return (
						<Box key={msg.uuid || index} marginBottom={0}>
							<Text color={roleColor} bold>{role.padEnd(10)}</Text>
							<Text> {preview}{preview.length < textContent.length && '...'}</Text>
						</Box>
					);
				})}
			</Box>

			{conversationMessages.length > 10 && (
				<Box marginBottom={1}>
					<Text dimColor>
						Showing {scrollOffset + 1}-{Math.min(scrollOffset + 10, conversationMessages.length)} of {conversationMessages.length} messages
					</Text>
				</Box>
			)}

			<Box marginTop={1}>
				<Text dimColor>
					↑/↓: Scroll | Enter: Launch Session | Esc: Back to Search | Ctrl+C: Exit
				</Text>
			</Box>
		</Box>
	);
}
