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
	const [selectedMessageIndex, setSelectedMessageIndex] = useState(0);
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
				(item.text && item.text.trim().length > 0)
				// Skip thinking blocks - only count actual text content
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
	// Overhead: Header (2) + metadata (5) + "Conversation:" (2) + scroll indicator (2) + preview section (14) + footer (2) + padding (2)
	const uiOverhead = 29;
	const maxVisibleMessages = Math.max(3, terminalHeight - uiOverhead);
	const previewMaxLines = 10; // Show up to 10 lines in preview

	const maxScroll = Math.max(0, conversationMessages.length - maxVisibleMessages);

	useInput((input, key) => {
		if (key.escape) {
			onBack();
		} else if (key.return) {
			onLaunch(session);
		} else if (key.upArrow || (key.ctrl && input === 'k')) {
			setSelectedMessageIndex(prev => {
				const newIndex = Math.max(0, prev - 1);
				// Scroll up if needed
				if (newIndex < scrollOffset) {
					setScrollOffset(newIndex);
				}
				return newIndex;
			});
		} else if (key.downArrow || (key.ctrl && input === 'j')) {
			setSelectedMessageIndex(prev => {
				const newIndex = Math.min(conversationMessages.length - 1, prev + 1);
				// Scroll down if needed
				if (newIndex >= scrollOffset + maxVisibleMessages) {
					setScrollOffset(newIndex - maxVisibleMessages + 1);
				}
				return newIndex;
			});
		} else if (key.pageUp || (key.ctrl && input === 'u')) {
			setSelectedMessageIndex(prev => {
				const newIndex = Math.max(0, prev - Math.floor(maxVisibleMessages / 2));
				setScrollOffset(Math.max(0, newIndex));
				return newIndex;
			});
		} else if (key.pageDown || (key.ctrl && input === 'd')) {
			setSelectedMessageIndex(prev => {
				const newIndex = Math.min(conversationMessages.length - 1, prev + Math.floor(maxVisibleMessages / 2));
				setScrollOffset(Math.min(maxScroll, newIndex));
				return newIndex;
			});
		} else if (key.ctrl && input === 'g') {
			setSelectedMessageIndex(0);
			setScrollOffset(0);
		} else if (key.shift && input === 'G') {
			setSelectedMessageIndex(conversationMessages.length - 1);
			setScrollOffset(maxScroll);
		}
	});

	const visibleMessages = conversationMessages.slice(scrollOffset, scrollOffset + maxVisibleMessages);

	// Helper to extract full text content from a message
	const getFullTextContent = (msg: any): string => {
		const content = msg.message?.content;
		let textContent = '';

		if (typeof content === 'string') {
			textContent = content;
		} else if (Array.isArray(content)) {
			textContent = content
				.map(item => {
					if ('text' in item) return item.text;
					return '';
				})
				.filter(Boolean)
				.join('\n\n');
		}

		return textContent.trim();
	};

	const selectedMessage = conversationMessages[selectedMessageIndex];

	return (
		<Box flexDirection="column" padding={1} height={terminalHeight}>
			<Box marginBottom={1}>
				<Text bold color="cyan">Session Details</Text>
			</Box>

			<Box marginBottom={1} flexDirection="column">
				<Box flexDirection="row">
					<Text bold>Directory: </Text>
					<Text color="green">{session.directory}</Text>
				</Box>
				<Box flexDirection="row">
					<Text bold>Date: </Text>
					<Text>{session.timestamp.toLocaleString()}</Text>
				</Box>
				<Box flexDirection="row">
					<Text bold>Session ID: </Text>
					<Text dimColor>{session.id}</Text>
				</Box>
				<Box flexDirection="row">
					<Text bold>Messages: </Text>
					<Text>{conversationMessages.length}</Text>
				</Box>
			</Box>

			<Box marginBottom={1}>
				<Text bold>Conversation:</Text>
			</Box>

			<Box flexDirection="column" marginBottom={1} minHeight={maxVisibleMessages}>
				{visibleMessages.map((msg, displayIndex) => {
					const absoluteIndex = scrollOffset + displayIndex;
					const isSelected = absoluteIndex === selectedMessageIndex;
					const role = msg.message?.role || msg.type;
					const fullText = getFullTextContent(msg);

					// Skip messages with no text content
					if (!fullText) {
						return null;
					}

					// Clean up for inline preview - preserve single spaces but remove newlines
					const cleanText = fullText.replace(/\s+/g, ' ').trim();
					const availableWidth = terminalWidth - 29;
					const maxPreviewLength = Math.max(30, Math.min(availableWidth, 150));
					const preview = cleanText.slice(0, maxPreviewLength);
					const roleColor = role === 'user' ? 'yellow' : role === 'assistant' ? 'blue' : 'gray';

					return (
						<Box key={msg.uuid || displayIndex} marginBottom={0} flexWrap="nowrap">
							<Text
								color={isSelected ? 'white' : roleColor}
								bold
								backgroundColor={isSelected ? 'blue' : undefined}
							>
								{isSelected ? '> ' : '  '}{role.padEnd(8)}
							</Text>
							<Text
								wrap="truncate"
								color={isSelected ? 'white' : undefined}
								backgroundColor={isSelected ? 'blue' : undefined}
							>
								{' '}{preview}{preview.length < cleanText.length && '...'}
							</Text>
						</Box>
					);
				})}
				{/* Fill empty space for consistent layout */}
				{visibleMessages.length < maxVisibleMessages && Array.from({ length: maxVisibleMessages - visibleMessages.length }).map((_, i) => (
					<Box key={`empty-${i}`}>
						<Text> </Text>
					</Box>
				))}
			</Box>

			{conversationMessages.length > maxVisibleMessages && (
				<Box marginBottom={1}>
					<Text dimColor>
						Showing {scrollOffset + 1}-{Math.min(scrollOffset + maxVisibleMessages, conversationMessages.length)} of {conversationMessages.length} messages
					</Text>
				</Box>
			)}

			{/* Message preview panel */}
			{selectedMessage && (
				<Box marginBottom={1} flexDirection="column" borderStyle="single" borderColor="cyan" padding={1}>
					<Box marginBottom={1}>
						<Text bold color="cyan">
							{selectedMessage.message?.role || selectedMessage.type} ({selectedMessageIndex + 1}/{conversationMessages.length})
						</Text>
					</Box>
					<Box flexDirection="column" height={previewMaxLines} width={terminalWidth - 8}>
						<Text wrap="wrap">
							{(() => {
								const fullText = getFullTextContent(selectedMessage);
								const lines = fullText.split('\n');
								const displayLines = lines.slice(0, previewMaxLines);
								const needsEllipsis = lines.length > previewMaxLines;
								return displayLines.join('\n') + (needsEllipsis ? '\n...' : '');
							})()}
						</Text>
					</Box>
				</Box>
			)}

			<Box marginTop={1}>
				<Text dimColor>
					↑/↓: Navigate | Ctrl+U/D: Half-page | g/G: Top/Bottom | Enter: Fork in Claude | Esc: Back | Ctrl+C: Exit
				</Text>
			</Box>
		</Box>
	);
}
