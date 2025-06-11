import { AiChatDemo } from "@/app/_components/ai-chat-demo";
import { HydrateClient } from "@/trpc/server";
import TestPipelinePage from "./test-pipeline/page";

export default async function Home() {
	return (
		<HydrateClient>
			<main className="min-h-screen">
				{/* <AiChatDemo /> */}
				<TestPipelinePage />
			</main>
		</HydrateClient>
	);
}
