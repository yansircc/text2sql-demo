import { AiChatDemo } from "@/app/_components/ai-chat-demo";
import { HydrateClient } from "@/trpc/server";

export default async function Home() {
	return (
		<HydrateClient>
			<main className="min-h-screen">
				<AiChatDemo />
			</main>
		</HydrateClient>
	);
}
