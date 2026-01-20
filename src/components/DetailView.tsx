import React, { useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { Session } from '../utils/sessionScanner.js';
import { spawn } from 'child_process';

interface DetailViewProps {
	session: Session;
	onBack: () => void;
	onLaunch: (session: Session) => void;
}

export function DetailView({ session, onBack, onLaunch }: DetailViewProps) {
	const [scrollOffset, setScrollOffset] = useState(0);
	const { stdout } = useStdout();

	// Helper function to check if a message has displayable text content
	const hasTextContent = (msg: any): boolean => {
		const content = msg.message?.content;
		if (!content) return false;

		if (typeof content === 'string') {
			return content.trim().length > 0;
		}

		if (Array.isArray(content)) {
			return content.some(item =>
				(item.text && item.text.trim().length > 0) ||
				(item.thinking && item.thinking.trim().length > 0)
			);
		}

		return false;
	};

	// Get user and assistant messages only (skip file-history-snapshot and other system messages)
	// Also filter out messages with no text content (tool-use-only messages)
	const conversationMessages = session.messages.filter(
		msg => (msg.type === 'user' || msg.type === 'assistant') && hasTextContent(msg)
	);

	// Calculate available space for messages
	const terminalHeight = stdout?.rows || 24;
	const terminalWidth = stdout?.columns || 120;
	const uiOverhead = 11; // Header, metadata, footer, etc.
	const maxVisibleMessages = Math.max(5, terminalHeight - uiOverhead);

	const maxScroll = Math.max(0, conversationMessages.length - maxVisibleMessages);

	useInput((input, key) => {
		if (key.escape) {
			onBack();
		} else if (key.return) {
			onLaunch(session);
		} else if (key.upArrow || (key.ctrl && input === 'k')) {
			setScrollOffset(prev => Math.max(0, prev - 1));
		} else if (key.downArrow || (key.ctrl && input === 'j')) {
			setScrollOffset(prev => Math.min(maxScroll, prev + 1));
		} else if (key.pageUp || (key.ctrl && input === 'u')) {
			setScrollOffset(prev => Math.max(0, prev - Math.floor(maxVisibleMessages / 2)));
		} else if (key.pageDown || (key.ctrl && input === 'd')) {
			setScrollOffset(prev => Math.min(maxScroll, prev + Math.floor(maxVisibleMessages / 2)));
		} else if (key.ctrl && input === 'g') {
			setScrollOffset(0);
		} else if (key.shift && input === 'G') {
			setScrollOffset(maxScroll);
		}
	});

	const visibleMessages = conversationMessages.slice(scrollOffset, scrollOffset + maxVisibleMessages);

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
								if ('thinking' in item) return `[thinking]`;
								return '';
							})
							.filter(Boolean)
							.join(' ');
					}

					// Clean up the text content
					const cleanText = textContent.replace(/\s+/g, ' ').trim();

					// Skip messages with no text content
					if (!cleanText) {
						return null;
					}

					const maxPreviewLength = Math.min(terminalWidth - 15, 150);
					const preview = cleanText.slice(0, maxPreviewLength).replace(/\n/g, ' ');
					const roleColor = role === 'user' ? 'yellow' : role === 'assistant' ? 'blue' : 'gray';

					return (
						<Box key={msg.uuid || index} marginBottom={0}>
							<Text color={roleColor} bold>{role.padEnd(10)}</Text>
							<Text> {preview}{preview.length < cleanText.length && '...'}</Text>
						</Box>
					);
				})}
			</Box>

			{conversationMessages.length > maxVisibleMessages && (
				<Box marginBottom={1}>
					<Text dimColor>
						Showing {scrollOffset + 1}-{Math.min(scrollOffset + maxVisibleMessages, conversationMessages.length)} of {conversationMessages.length} messages
					</Text>
				</Box>
			)}

			<Box marginTop={1}>
				<Text dimColor>
					↑/↓: Scroll | Ctrl+U/D: Half-page | g/G: Top/Bottom | Enter: Launch | Esc: Back | Ctrl+C: Exit
				</Text>
			</Box>
		</Box>
	);
}
