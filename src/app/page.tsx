import { HydrateClient } from "@/trpc/server";
import TestPipelinePage from "./test-pipeline";

export default async function Home() {
	return (
		<HydrateClient>
			<main className="min-h-screen">
				<TestPipelinePage />
			</main>
		</HydrateClient>
	);
}
