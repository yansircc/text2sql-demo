import type { PreSQL } from "@/server/api/routers/pre-sql";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface SQLResult {
	sql: string;
}

interface QuerySession {
	id: string;
	originalQuery: string;
	preSQL: PreSQL;
	sqlResult?: SQLResult;
	slimSchema?: any;
	timestamp: string;
	status: "preSQL-generated" | "sql-generating" | "sql-generated" | "error";
	error?: string;
}

interface AppState {
	// 当前会话
	currentSession: QuerySession | null;

	// 历史会话
	sessions: QuerySession[];

	// 操作方法
	setCurrentSession: (session: QuerySession) => void;
	addSession: (session: QuerySession) => void;
	updateCurrentSession: (updates: Partial<QuerySession>) => void;
	updateSessionById: (id: string, updates: Partial<QuerySession>) => void;
	clearCurrentSession: () => void;
	getSessionById: (id: string) => QuerySession | undefined;

	// 导航状态
	currentView: "input" | "result";
	setCurrentView: (view: "input" | "result") => void;
}

export const useAppStore = create<AppState>()(
	devtools(
		(set, get) => ({
			currentSession: null,
			sessions: [],
			currentView: "input",

			setCurrentSession: (session) => {
				set({ currentSession: session }, false, "setCurrentSession");
			},

			addSession: (session) => {
				set(
					(state) => ({
						sessions: [session, ...state.sessions],
						currentSession: session,
					}),
					false,
					"addSession",
				);
			},

			updateCurrentSession: (updates) => {
				set(
					(state) => {
						if (!state.currentSession) return state;

						const updatedSession = { ...state.currentSession, ...updates };

						return {
							currentSession: updatedSession,
							sessions: state.sessions.map((session) =>
								session.id === updatedSession.id ? updatedSession : session,
							),
						};
					},
					false,
					"updateCurrentSession",
				);
			},

			updateSessionById: (id, updates) => {
				set(
					(state) => ({
						sessions: state.sessions.map((session) =>
							session.id === id ? { ...session, ...updates } : session,
						),
						currentSession:
							state.currentSession?.id === id
								? { ...state.currentSession, ...updates }
								: state.currentSession,
					}),
					false,
					"updateSessionById",
				);
			},

			clearCurrentSession: () => {
				set({ currentSession: null }, false, "clearCurrentSession");
			},

			getSessionById: (id) => {
				return get().sessions.find((session) => session.id === id);
			},

			setCurrentView: (view) => {
				set({ currentView: view }, false, "setCurrentView");
			},
		}),
		{
			name: "app-store",
		},
	),
);
