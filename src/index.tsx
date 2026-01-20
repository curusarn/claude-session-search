#!/usr/bin/env node

import React, { useState, useEffect } from 'react';
import { render, Box, Text } from 'ink';
import { scanSessions, Session } from './utils/sessionScanner.js';
import { SearchView } from './components/SearchView.js';
import { DetailView } from './components/DetailView.js';
import { spawn } from 'child_process';

type View = 'search' | 'detail';

function App() {
	const [sessions, setSessions] = useState<Session[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [currentView, setCurrentView] = useState<View>('search');
	const [selectedSession, setSelectedSession] = useState<Session | null>(null);
	const [searchQuery, setSearchQuery] = useState('');

	useEffect(() => {
		const loadSessions = async () => {
			try {
				const cwd = process.cwd();
				const foundSessions = await scanSessions(cwd);
				setSessions(foundSessions);
				setLoading(false);
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Unknown error');
				setLoading(false);
			}
		};

		loadSessions();
	}, []);

	const handleSelectSession = (session: Session) => {
		setSelectedSession(session);
		setCurrentView('detail');
	};

	const handleBack = () => {
		setCurrentView('search');
	};

	const handleLaunch = (session: Session) => {
		// Launch claude in the session directory with the session ID
		const claudeProcess = spawn(
			'claude',
			['--dangerously-skip-permissions', '--session', session.id],
			{
				cwd: session.directory,
				stdio: 'inherit',
			}
		);

		claudeProcess.on('exit', (code) => {
			if (code !== 0) {
				console.error(`Claude exited with code ${code}`);
			}
			process.exit(code || 0);
		});

		// Exit the current process since we're launching claude
		process.exit(0);
	};

	if (loading) {
		return (
			<Box padding={1}>
				<Text>Loading sessions...</Text>
			</Box>
		);
	}

	if (error) {
		return (
			<Box padding={1}>
				<Text color="red">Error: {error}</Text>
			</Box>
		);
	}

	if (sessions.length === 0) {
		return (
			<Box padding={1}>
				<Text>No Claude sessions found.</Text>
			</Box>
		);
	}

	if (currentView === 'search') {
		return (
			<SearchView
				sessions={sessions}
				onSelectSession={handleSelectSession}
				initialQuery={searchQuery}
			/>
		);
	}

	if (currentView === 'detail' && selectedSession) {
		return (
			<DetailView
				session={selectedSession}
				onBack={handleBack}
				onLaunch={handleLaunch}
			/>
		);
	}

	return null;
}

render(<App />);
