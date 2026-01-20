import fs from 'fs/promises';
import path from 'path';
import { homedir } from 'os';

export interface SessionMessage {
	type: string;
	message?: {
		role: string;
		content: string | Array<{ type: string; text?: string; thinking?: string }>;
	};
	uuid?: string;
	timestamp?: string;
	cwd?: string;
	sessionId?: string;
}

export interface Session {
	id: string;
	directory: string;
	filePath: string;
	firstMessage: string;
	messages: SessionMessage[];
	timestamp: Date;
	cwd: string;
}

function extractTextContent(content: string | Array<{ type: string; text?: string; thinking?: string }>): string {
	if (typeof content === 'string') {
		return content;
	}
	if (Array.isArray(content)) {
		return content
			.map(item => {
				if (item.type === 'text' && item.text) return item.text;
				if (item.type === 'thinking' && item.thinking) return item.thinking;
				return '';
			})
			.join(' ');
	}
	return '';
}

function pathToDirectory(projectName: string): string {
	// Keep the encoded project name but strip the leading dash
	// We can't reliably decode because we don't know which dashes were originally
	// path separators vs dashes in the directory name (e.g., "infrastructure-as-ruby")
	if (projectName.startsWith('-')) {
		return projectName.substring(1);
	}
	return projectName;
}

export async function scanSessions(currentDir: string): Promise<Session[]> {
	const claudeDir = path.join(homedir(), '.claude', 'projects');

	try {
		await fs.access(claudeDir);
	} catch {
		return [];
	}

	const sessions: Session[] = [];
	const projectDirs = await fs.readdir(claudeDir);

	for (const projectDir of projectDirs) {
		const projectPath = path.join(claudeDir, projectDir);
		const stat = await fs.stat(projectPath);

		if (!stat.isDirectory()) continue;

		const files = await fs.readdir(projectPath);
		const sessionFiles = files.filter(f => f.endsWith('.jsonl'));

		for (const sessionFile of sessionFiles) {
			const filePath = path.join(projectPath, sessionFile);
			const sessionId = sessionFile.replace('.jsonl', '');

			try {
				const content = await fs.readFile(filePath, 'utf-8');
				const lines = content.trim().split('\n');
				const messages: SessionMessage[] = lines
					.map(line => {
						try {
							return JSON.parse(line);
						} catch {
							return null;
						}
					})
					.filter((msg): msg is SessionMessage => msg !== null);

				// Find the first user message
				const firstUserMessage = messages.find(
					msg => msg.type === 'user' && msg.message?.content
				);

				if (!firstUserMessage?.message?.content) continue;

				const encodedDirectory = pathToDirectory(projectDir);
				const firstMessage = extractTextContent(firstUserMessage.message.content);

				// Skip sessions with system/command messages or just "Warmup"
				if (!firstMessage || firstMessage.trim().length === 0) continue;
				const lowerMessage = firstMessage.toLowerCase().trim();
				if (lowerMessage === 'warmup') continue;
				if (lowerMessage === 'claim') continue;
				if (firstMessage.startsWith('<command-message>')) continue;
				if (firstMessage.startsWith('<command-name>')) continue;
				if (firstMessage.startsWith('{') && firstMessage.includes('"hooks"')) continue;
				if (firstMessage.length < 3) continue; // Skip very short messages

				const timestamp = firstUserMessage.timestamp
					? new Date(firstUserMessage.timestamp)
					: new Date(0);
				// Use the actual cwd from the session, fall back to encoded directory
				const cwd = firstUserMessage.cwd || encodedDirectory;
				// Use cwd for display purposes too since it's the real path
				const directory = cwd;

				sessions.push({
					id: sessionId,
					directory,
					filePath,
					firstMessage,
					messages,
					timestamp,
					cwd,
				});
			} catch (error) {
				// Skip sessions that can't be read
				console.error(`Error reading session ${sessionFile}:`, error);
			}
		}
	}

	// Calculate distance from current directory and sort
	const sortedSessions = sessions.map(session => {
		const distance = calculatePathDistance(currentDir, session.directory);
		return { ...session, distance };
	}).sort((a, b) => {
		// Sort by distance first, then by timestamp
		if (a.distance !== b.distance) {
			return a.distance - b.distance;
		}
		return b.timestamp.getTime() - a.timestamp.getTime();
	});

	return sortedSessions;
}

function calculatePathDistance(from: string, to: string): number {
	const fromParts = from.split('/').filter(p => p);
	const toParts = to.split('/').filter(p => p);

	// Find common prefix length
	let commonLength = 0;
	for (let i = 0; i < Math.min(fromParts.length, toParts.length); i++) {
		if (fromParts[i] === toParts[i]) {
			commonLength++;
		} else {
			break;
		}
	}

	// Distance is the number of steps to go up + steps to go down
	const distance = (fromParts.length - commonLength) + (toParts.length - commonLength);
	return distance;
}

export function getAllText(session: Session): string {
	const texts: string[] = [session.firstMessage];

	for (const msg of session.messages) {
		if (msg.message?.content) {
			texts.push(extractTextContent(msg.message.content));
		}
	}

	return texts.join('\n');
}
